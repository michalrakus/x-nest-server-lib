import {Injectable, StreamableFile} from "@nestjs/common";
import {XExportColumn, XExportService} from "./x-export.service";
import {Buffer} from "buffer";
import {Readable} from "stream";
import {XMultilineExportType} from "../serverApi/ExportImportParam";
import {XEntity} from "../serverApi/XEntityMetadata";
import {XUtilsMetadataCommon} from "../serverApi/XUtilsMetadataCommon";
import * as ExcelJS from "exceljs";

@Injectable()
export class XExportExcelService extends XExportService {

    // simple api for custom export
    export(worksheetName: string, columns: XExportColumn[], entity: string | undefined, rows: any[]): Promise<StreamableFile> {
        return this.exportBase(worksheetName, columns, true, XMultilineExportType.Singleline, undefined, entity, rows);
    }

    // extended api for custom export
    exportBase(worksheetName: string, columns: XExportColumn[], createHeaders: boolean, multilineExportType: XMultilineExportType, fieldsToDuplicateValues: string[] | undefined, entity: string | undefined, rows: any[]): Promise<StreamableFile> {

        const workbook: ExcelJS.Workbook = new ExcelJS.Workbook();
        const worksheet: ExcelJS.Worksheet = this.createWorksheet(workbook, worksheetName, createHeaders);

        if (createHeaders) {
            worksheet.columns = columns.map((value: XExportColumn) => {return {header: value.header, width: value.width ?? this.computeWidth(value.header)};});
        }

        const xEntity: XEntity | undefined = entity ? XUtilsMetadataCommon.getXEntity(entity) : undefined;

        for (const row of rows) {
            //convertObject(entity, row, true, AsUIType.Text); // pomeni row!
            const resultRowList: Array<Array<any>> = this.exportRow(columns, multilineExportType, fieldsToDuplicateValues, xEntity, row);
            for (const resultRow of resultRowList) {
                worksheet.addRow(resultRow);
            }
        }

        // header - bold, blue bg
        if (createHeaders) {
            this.highlightHeaderRow(worksheet);
        }

        return this.createStreamableFile(workbook);
    }

    createWorksheet(workbook: ExcelJS.Workbook, worksheetName: string, createFrozenRow?: boolean): ExcelJS.Worksheet {
        createFrozenRow = createFrozenRow ?? true; // default true
        return workbook.addWorksheet(worksheetName, createFrozenRow ? {
            views: [{ state: "frozen", ySplit: 1 }] // header row frozen
        } : undefined);
    }

    highlightHeaderRow(worksheet: ExcelJS.Worksheet) {
        const headerRow: ExcelJS.Row = worksheet.getRow(1);
        // Iterate over all non-null cells in a row
        headerRow.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
            cell.font = {bold: true};
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {argb: 'FFCCECFF'} // toto je svetlomodra background farba, absolutne netusim preco je zapisana vo fgColor
            }
        });
    }

    async createStreamableFile(workbook: ExcelJS.Workbook): Promise<StreamableFile> {
        //const buffer: ExcelJS.Buffer = await workbook.xlsx.writeBuffer();
        const buffer: Buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
        //await workbook.xlsx.write(stream);

        return new StreamableFile(Readable.from(buffer));
    }

    private computeWidth(header: string): number | undefined {
        let width: number | undefined = undefined;
        if (header.length > 0) {
            width = header.length * 1 + 1; // zatial takto jednoducho
        }
        return width;
    }
}
