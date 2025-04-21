import {HttpStatus, Injectable} from "@nestjs/common";
import {Response} from "express";
import {
    CsvDecimalFormat,
    CsvEncoding,
    CsvParam, ExcelCsvParam,
    ExportCsvParam,
    XMultilineExportType
} from "../serverApi/ExportImportParam";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";
import {dateFormat, datetimeFormat, numberFromModel} from "../serverApi/XUtilsConversions";
// poznamka - ked tu bolo: import iconv from "iconv-lite"; tak to nefungovalo a zevraj to suvisi s nestjs
import * as iconv from "iconv-lite";
import {XExportColumn, XExportService} from "./x-export.service";
import {SelectQueryBuilder} from "typeorm";
import {ReadStream} from "fs";
import {XEntity} from "../serverApi/XEntityMetadata";
import {XUtilsMetadataCommon} from "../serverApi/XUtilsMetadataCommon";

// pomocna trieda
export class XCsvWriter {

    csvParam: CsvParam;
    res: Response;

    constructor(csvParam: CsvParam, res: Response) {
        this.csvParam = csvParam;
        this.res = res;
    }

    writeRow(...valueList: any) {
        let csvRow: string = "";
        let firstItem: boolean = true;
        for (const value of valueList) {

            let valueStr: string = this.convertToStr(value);
            valueStr = this.processCsvItem(valueStr);

            if (firstItem) {
                firstItem = false;
            }
            else {
                csvRow += this.csvParam.csvSeparator;
            }
            csvRow += valueStr;
        }
        csvRow += XUtilsCommon.newLine;
        this.res.write(iconv.encode(csvRow, this.csvParam.csvEncoding)); // neviem ci toto je idealny sposob ako pouzivat iconv, ale funguje...
    }

    // must be called at the end of export (after calls writeRow(...))
    end() {
        this.res.status(HttpStatus.OK);
        this.res.end();
    }

    // po spravnosti by sa mala diat konverzia v XExportService.exportRow volanim convertValueBase, lebo tam mame metadata o typoch (fractionDigits, ci je date/datetime),
    // tu zas mame info ci decimal cisla konvertovat do formatu 123456.78 alebo 123456,78 (v metode numberAsCsv)
    private convertToStr(value: any): string {

        let valueStr: string;
        if (value === null || value === undefined) {
            valueStr = ""; // TODO - pripadne dorobit do dialogu volbu, ze null -> "null", ak by sme chceli rozlisovat od prazdneho string-u
        }
        else if (typeof value === 'number') {
            valueStr = this.numberAsCsv(value);
        }
        else if (value instanceof Date) {
            // TODO - ak pre datetime nastavime vsetky zlozky casu na 00:00:00, tak sformatuje hodnotu ako datum a spravi chybu pri zapise do DB - zapise  1:00:00
            if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
                valueStr = dateFormat(value, 'yyyy-MM-dd');
            }
            else {
                // jedna sa o datetime
                valueStr = datetimeFormat(value, 'yyyy-MM-dd HH:mm:ss');
            }
        }
        else {
            valueStr = value.toString();
        }
        return valueStr;
    }

    private processCsvItem(valueStr: string): string {
        // moj stary Excel 2010 nechcel nacitavat subor ktory obsahoval v bunke retazec ID
        if (valueStr === "ID") {
            valueStr = '"' + valueStr + '"';
        }
        else {
            valueStr = valueStr.replace(/"/g, '""'); // ekvivalent pre regexp /"/g je: new RegExp('"', 'g')
            // aj tu pouzivam XUtils.csvSeparator
            if (valueStr.search(new RegExp(`("|${this.csvParam.csvSeparator}|\n)`, 'g')) >= 0) {
                valueStr = '"' + valueStr + '"';
            }
        }
        return valueStr;
    }

    // helper for formatting numbers
    number(value: any): string {
        const numberValue: number | null = numberFromModel(value); // niekedy zevraj prichadzaju stringy z DB, tak pre istotu volame numberFromModel
        return this.numberAsCsv(numberValue);
    }

    // fcia numberAsUI vracia format 123,456,78 co nechceme, preto mame numberAsCsv
    numberAsCsv(value: number | null): string {
        let valueStr: string = "";
        // valueStr should be for example 123456,78
        if (value !== null) {
            //valueStr = value.toFixed(fractionDigits ?? 2); // vrati 123456.78 a tiez zaokruhluje (co nam vyhovuje :-)
            valueStr = value.toString(); // vrati 123456.78 - vytvori tolko desatinnych miest kolko des. miest ma hodnota (netreba nam fractionDigits)
            if (this.csvParam.csvDecimalFormat === CsvDecimalFormat.Comma) {
                valueStr = valueStr.replace('.', ','); // result 123456,78
            }
            // pre this.csvParam.csvDecimalFormat === CsvDecimalFormat.Dot ponechame 123456.78
        }
        return valueStr;
    }
}

@Injectable()
export class XExportCsvService extends XExportService {

    // simple api for custom export
    export(csvParam: CsvParam, columns: XExportColumn[], entity: string | undefined, rows: any[], res: Response) {
        this.exportBase(csvParam, columns, true, XMultilineExportType.Multiline, undefined, entity, rows, res);
    }

    // extended api for custom export
    // TODO - nepouzivame stream ale zapisujeme do res: Response, nevraciame Promise<StreamableFile> - je to take zvlastne, nie je to moc pekne
    // (ak to chceme mat poriadne, asi by sme mali mat 2 rest metody v controlleri - jednu na stream (pouziva res: Response) a druhu na list (vracia Promise<StreamableFile>))
    exportBase(csvParam: CsvParam, columns: XExportColumn[], createHeaders: boolean, multilineExportType: XMultilineExportType, fieldsToDuplicateValues: string[] | undefined, entity: string | undefined, rows: any[], res: Response) {

        const xCsvWriter: XCsvWriter = this.startExport(csvParam, columns, createHeaders, res);

        const xEntity: XEntity | undefined = entity ? XUtilsMetadataCommon.getXEntity(entity) : undefined;

        for (const row of rows) {
            this.exportRowToCsv(columns, multilineExportType, fieldsToDuplicateValues, xEntity, row, xCsvWriter);
        }

        xCsvWriter.end();
    }

    async exportUsingList(exportCsvParam: ExportCsvParam, columns: XExportColumn[], selectQueryBuilder: SelectQueryBuilder<unknown>, res: Response): Promise<void> {

        const rowList: any[] = await selectQueryBuilder.getMany();

        const excelCsvParam: ExcelCsvParam = exportCsvParam.excelCsvParam;
        this.exportBase(exportCsvParam.csvParam, columns, excelCsvParam.headers !== undefined, excelCsvParam.toManyAssocExport, excelCsvParam.fieldsToDuplicateValues, exportCsvParam.queryParam.entity, rowList, res);
    }

    async exportUsingStream(exportCsvParam: ExportCsvParam, columns: XExportColumn[], selectQueryBuilder: SelectQueryBuilder<unknown>, res: Response): Promise<void> {

        const xCsvWriter: XCsvWriter = this.startExport(exportCsvParam.csvParam, columns, exportCsvParam.excelCsvParam.headers !== undefined, res);

        const readStream: ReadStream = await selectQueryBuilder.stream();

        const xEntity = XUtilsMetadataCommon.getXEntity(exportCsvParam.queryParam.entity);

        readStream.on('data', data => {
            const entityObj = this.transformToEntity(data, selectQueryBuilder);
            this.exportRowToCsv(columns, exportCsvParam.excelCsvParam.toManyAssocExport, exportCsvParam.excelCsvParam.fieldsToDuplicateValues, xEntity, entityObj, xCsvWriter);
        });

        readStream.on('end', () => {
            xCsvWriter.end();
        });
    }

    startExport(csvParam: CsvParam, columns: XExportColumn[], createHeaders: boolean, res: Response): XCsvWriter {

        const headerCharset: string = XExportCsvService.getHeaderCharset(csvParam.csvEncoding); // napr. UTF-8, windows-1250

        res.setHeader("Content-Type", `text/csv; charset=${headerCharset}`);
        res.charset = headerCharset; // default encoding - pravdepodobne setne tuto hodnotu do charset=<res.charset> v header-i "Content-Type"
        // ak neni atribut charset definovany explicitne - TODO - odskusat

        const xCsvWriter: XCsvWriter = new XCsvWriter(csvParam, res);

        if (createHeaders) {
            xCsvWriter.writeRow(...columns.map((value: XExportColumn) => value.header));
        }

        // because of using streams, the programmer has to call xCsvWriter.end() explicitly
        //res.status(HttpStatus.OK);
        //res.end();

        return xCsvWriter;
    }

    static getHeaderCharset(csvEncoding: CsvEncoding): string {
        let headerCharset: string;
        switch (csvEncoding) {
            case CsvEncoding.Utf8:
                headerCharset = "UTF-8";
                break;
            case CsvEncoding.Win1250:
                headerCharset = "windows-1250";
                break;
            default:
                throw `HeaderCharset for csvEncoding "${csvEncoding}" not implemented`;
        }
        return headerCharset;
    }

    // helper
    private exportRowToCsv(columns: XExportColumn[], multilineExportType: XMultilineExportType, fieldsToDuplicateValues: string[], xEntity: XEntity, row: any, xCsvWriter: XCsvWriter) {
        // metoda this.exportRow skonvertuje hodnoty na typy (napr. number, Date) a xCsvWriter.writeRow skonvertuje typy na string
        const resultRowList: Array<Array<any>> = this.exportRow(columns, multilineExportType, fieldsToDuplicateValues, xEntity, row);
        for (const resultRow of resultRowList) {
            xCsvWriter.writeRow(...resultRow);
        }
    }
}
