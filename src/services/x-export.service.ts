import {HttpStatus, Injectable} from "@nestjs/common";
import {Response} from "express";
import {CsvDecimalFormat, CsvEncoding, CsvParam, ExportParam} from "../serverApi/ExportImportParam";
import {dateFormat, XUtilsCommon} from "../serverApi/XUtilsCommon";
import {numberFromModel} from "../serverApi/XUtilsConversions";
// poznamka - ked tu bolo: import iconv from "iconv-lite"; tak to nefungovalo a zevraj to suvisi s nestjs
import * as iconv from "iconv-lite";

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

    private convertToStr(value: any): string {

        let valueStr: string;
        if (value === null || value === undefined) {
            valueStr = ""; // TODO - pripadne dorobit do dialogu volbu, ze null -> "null", ak by sme chceli rozlisovat od prazdneho string-u
        }
        else if (typeof value === 'number') {
            // pokus o automatiku, aby programator pri custom exporte nemusel formatovat decimal hodnoty - zaokruhluje na 2 desatiny!
            // pri generickom exporte uz sem pride string
            valueStr = this.numberAsCsv(value);
        }
        else if (value instanceof Date) {
            // pouziva sa aj pri generickom exporte
            // TODO - ak pre datetime nastavime vsetky zlozky casu na 00:00:00, tak sformatuje hodnotu ako datum a spravi chybu pri zapise do DB - zapise  1:00:00
            if (value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0) {
                valueStr = dateFormat(value, 'yyyy-mm-dd');
            }
            else {
                // jedna sa o datetime
                valueStr = dateFormat(value, 'yyyy-mm-dd HH:MM:ss');
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
    number(value: any, fractionDigits?: number): string {
        const numberValue: number | null = numberFromModel(value); // niekedy zevraj prichadzaju stringy z DB, tak pre istotu volame numberFromModel
        return this.numberAsCsv(numberValue, fractionDigits);
    }

    // fcia numberAsUI vracia format 123,456,78 co nechceme, preto mame numberAsCsv
    numberAsCsv(value: number | null, fractionDigits?: number): string {
        let valueStr: string = "";
        // valueStr should be for example 123456,78
        if (value !== null) {
            valueStr = value.toFixed(fractionDigits ?? 2); // vrati 123456.78 a tiez zaokruhluje (co nam vyhovuje :-)
            if (this.csvParam.csvDecimalFormat === CsvDecimalFormat.Comma) {
                valueStr = valueStr.replace('.', ','); // result 123456,78
            }
            // pre this.csvParam.csvDecimalFormat === CsvDecimalFormat.Dot ponechame 123456.78
        }
        return valueStr;
    }
}

@Injectable()
export class XExportService {

    async exportCsv(exportParam: ExportParam, res: Response, writeCsv: (queryParam: any, xCsvWriter: XCsvWriter) => Promise<void>) {

        const headerCharset: string = XExportService.getHeaderCharset(exportParam.csvParam.csvEncoding); // napr. UTF-8, windows-1250

        res.setHeader("Content-Type", `text/csv; charset=${headerCharset}`);
        res.charset = headerCharset; // default encoding - pravdepodobne setne tuto hodnotu do charset=<res.charset> v header-i "Content-Type"
        // ak neni atribut charset definovany explicitne - TODO - odskusat

        const xCsvWriter: XCsvWriter = new XCsvWriter(exportParam.csvParam, res);

        if (exportParam.csvParam.useHeaderLine) {
            xCsvWriter.writeRow(...exportParam.csvParam.headers);
        }

        await writeCsv(exportParam.queryParam, xCsvWriter);

        // because of using streams, the programmer has to call xCsvWriter.end() explicitly
        //res.status(HttpStatus.OK);
        //res.end();
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
}
