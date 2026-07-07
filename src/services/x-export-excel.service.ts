import {Injectable, StreamableFile} from "@nestjs/common";
import {XExportColumn, XExportService} from "./x-export.service";
import {Buffer} from "buffer";
import {Readable} from "stream";
import {ToManyAssocExportType} from "../serverApi/ExportImportParam";
import {XEntity} from "../serverApi/XEntityMetadata";
import {XUtilsMetadataCommon} from "../serverApi/XUtilsMetadataCommon";
import * as ExcelJS from "exceljs";
import * as cheerio from "cheerio";

interface RichTextRun {
    text: string;
    font?: Partial<ExcelJS.Font>;
}

@Injectable()
export class XExportExcelService extends XExportService {

    // simple api for custom export
    export(worksheetName: string, columns: XExportColumn[], entity: string | undefined, rows: any[]): Promise<StreamableFile> {
        return this.exportBase(
            worksheetName,
            columns,
            true,
            undefined,
            ToManyAssocExportType.Singleline,
            undefined,
            entity,
            rows
        );
    }

    // extended api for custom export
    exportBase(
        worksheetName: string,
        columns: XExportColumn[],
        createHeaders: boolean,
        formatRow: (row: any, excelRow: ExcelJS.Row) => void | undefined,
        toManyAssocExportType: ToManyAssocExportType,
        fieldsToDuplicateValues: string[] | undefined,
        entity: string | undefined,
        rows: any[]
    ): Promise<StreamableFile> {

        const xEntity: XEntity | undefined = entity ? XUtilsMetadataCommon.getXEntity(entity) : undefined;

        if (xEntity && toManyAssocExportType === ToManyAssocExportType.Multiline) {
            // we set textFormat to multiline if the column displays toMany assoc and the textFormat is not set
            for (const column of columns) {
                if (!column.contentType // textFormat is not set
                    && typeof column.field === 'string' // column does not use function
                    && XUtilsMetadataCommon.getXFieldByPathBase(xEntity, column.field) // field exists in metadata model
                    && XUtilsMetadataCommon.hasPathToManyAssoc(xEntity, column.field)) { // field has at least one toMany assoc
                    column.contentType = "multiline";
                }
            }
        }

        const workbook: ExcelJS.Workbook = new ExcelJS.Workbook();
        const worksheet: ExcelJS.Worksheet = this.createWorksheet(workbook, worksheetName, createHeaders);

        if (createHeaders) {
            worksheet.columns = columns.map((value: XExportColumn) => {return {header: value.header, width: value.width ?? this.computeWidth(value.header)};});
        }

        for (const row of rows) {
            //convertObject(entity, row, true, AsUIType.Text); // pomeni row!
            const resultRowList: Array<Array<any>> = this.exportRow(columns, toManyAssocExportType, fieldsToDuplicateValues, xEntity, row);
            for (const resultRow of resultRowList) {
                const excelRow: ExcelJS.Row = worksheet.addRow(resultRow);
                // wrapping and formating if textFormat is multiline or html
                for (const [columnIndex, column] of columns.entries()) {
                    const excelColumnIndex: number = columnIndex + 1; // excel column index starts with 1

                    if (column.contentType === "html") {
                        const cell: ExcelJS.Cell = excelRow.getCell(excelColumnIndex);
                        if (cell.value !== null) {
                            // cell.value should be string
                            cell.value = {richText: this.htmlToRichText(cell.value.toString())};
                            // wrapping causes that the height of the cell will be adjusted so all the text will be visible
                            cell.alignment = {
                                wrapText: true
                                //vertical: 'top',
                                //horizontal: 'left',
                            };
                        }
                    }
                    else if (column.contentType === "multiline") {
                        const cell: ExcelJS.Cell = excelRow.getCell(excelColumnIndex);
                        cell.alignment = {
                            wrapText: true
                        };
                    }
                }
                // custom formatting (can be used e.g. to set some color of the row according to row data)
                if (formatRow) {
                    formatRow(row, excelRow);
                }
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

    /**
     * Converts a CSS width string (px or rem) to an Excel column width unit.
     *
     * Excel's column width is measured in "characters" of the default font
     * (Calibri 11 by default, where the widest digit ≈ 7px, aka MDW - Maximum Digit Width).
     * The standard conversion formula (used internally by Excel/OOXML) is:
     *
     *   excelWidth = (pixels - 5) / MDW
     *
     * where 5 is the fixed cell padding in pixels, and MDW = 7 for Calibri 11.
     */

    static MDW: number = 7; // Maximum Digit Width in px, for default Calibri 11 font
    static REM_TO_PX: number = 14; // standard browser default (1rem = 16px), we use 14px for 1rem

    cssWidthToPixels(cssWidth: string): number {
        const trimmed = cssWidth.trim();

        if (trimmed.endsWith('rem')) {
            const rem = parseFloat(trimmed);
            return rem * XExportExcelService.REM_TO_PX;
        }

        if (trimmed.endsWith('px')) {
            return parseFloat(trimmed);
        }

        //throw new Error(`Unsupported CSS unit in width: "${cssWidth}"`);
        console.log(`warning - unsupported CSS unit in width: "${cssWidth}"`);
        return parseFloat(trimmed);
    }

    pixelsToExcelWidth(pixels: number): number {
        // Excel formula: width = (pixels - 5) / MDW, rounded to 2 decimals
        const width = (pixels - 5) / XExportExcelService.MDW;
        return Math.max(0, Math.round(width * 100) / 100);
    }

    cssWidthToExcelWidth(cssWidth: string): number {
        return this.pixelsToExcelWidth(this.cssWidthToPixels(cssWidth));
    }

    // created by claude.ai
    htmlToRichText(html: string): RichTextRun[] {
        const $ = cheerio.load(html);
        const runs: RichTextRun[] = [];

        $('body').children().each((i, el) => {
            if (i > 0) runs.push({ text: '\n' }); // paragraph spacing

            const walk = (node: any, font: Partial<ExcelJS.Font> = {}) => {
                $(node).contents().each((_, child) => {
                    if (child.type === 'text') {
                        const text = $(child).text();
                        if (text) runs.push({ text, font: Object.keys(font).length ? font : undefined });
                    } else if (child.type === 'tag') {
                        const newFont = { ...font };
                        if (child.tagName === 'strong' || child.tagName === 'b') newFont.bold = true;
                        if (child.tagName === 'em' || child.tagName === 'i') newFont.italic = true;
                        walk(child, newFont);
                    }
                });
            };
            walk(el);
        });

        return runs;
    }
}
