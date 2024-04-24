import {XMultilineExportType} from "../serverApi/ExportImportParam";
import {XEntity, XField} from "../serverApi/XEntityMetadata";
import {XUtilsMetadataCommon} from "../serverApi/XUtilsMetadataCommon";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";
import {AsUIType, convertValueBase} from "../serverApi/XUtilsConversions";
import {SelectQueryBuilder} from "typeorm";
import {RawSqlResultsToEntityTransformer} from "typeorm/query-builder/transformer/RawSqlResultsToEntityTransformer";

// struktury pouzivane pre export do excelu a do csv

// typ fieldu - ide ako parameter do funkcie convertValue
// mal by sa pouzivat ako typ pre XField.type namiesto string-u ale v sucasnosti moze ist do XField.type hocico, takze zatial len tu pouzivame

export type XFieldType = "string" | "decimal" | "date" | "datetime" | "interval" | "boolean";

export interface XExportColumn {
    header: string;
    field: string | ((row: any) => any);
    type?: XFieldType; // explicitne zadany typ - pouziva sa, ak nemame metadatovy XField
    width?: number;
}

export abstract class XExportService {

    // funkcia pouzivana v XExportExcelService a XExportCsvService
    exportRow(columns: XExportColumn[], multilineExportType: XMultilineExportType, fieldsToDuplicateValues: string[] | undefined, xEntity: XEntity | undefined, row: any): Array<Array<any>> {

        // vytvarany excel/csv row je tvoreny stlpcami - standardne ma stlpec presne 1 hodnotu,
        // ak sa vsak jedna o field dotahovany cez one-to-many asociaciu, ma dany stlpec vsetky hodnoty dotiahnute cez danu asociaciu (moze byt aj 0 hodnot)
        // dlzku najdlhsieho stlpca si zapiseme do "maxColumnIndex"
        const columnList: Array<any[]> = new Array<any[]>(columns.length);
        let maxColumnLength: number = 1;
        for (const [columnIndex, xExportColumn] of columns.entries()) {

            let fieldType: string | undefined = xExportColumn.type;
            let scale: number | undefined = undefined;
            let value: any | any[];
            if (typeof xExportColumn.field === 'function') {
                value = xExportColumn.field(row);
            } else {
                // mame field - xExportColumn.field je typu string
                // ak nemame explicitny typ a mame zadanu entitu, skusime najst typ v metadatach
                if (!fieldType) {
                    if (xEntity) {
                        const xField: XField | undefined = XUtilsMetadataCommon.getXFieldByPathBase(xEntity, xExportColumn.field);
                        if (xField) {
                            fieldType = xField.type;
                            scale = xField.scale; // pouzivane pri decimal a date
                        }
                    }
                }

                value = XUtilsCommon.getValueOrValueListByPath(row, xExportColumn.field);
            }

            let columnValues: any[];
            let columnValuesProcessed: boolean = false;
            if (Array.isArray(value)) {
                columnValues = value;

                if (multilineExportType === XMultilineExportType.Singleline) {
                    // zlucime vsetky hodnoty do jednej string hodnoty
                    if (fieldType) {
                        // TODO - ak nemame k dispozicii metadata, tak nam moze chybat scale
                        //  - ak s tym bude problem, treba dorobit zadavanie scale explicitne (podobne ako sa zadava fieldType)
                        columnValues = columnValues.map((value: any) => convertValueBase(fieldType, scale, value, true, AsUIType.Text));
                    }
                    else {
                        // nepozname typ, neni dobre takto to pouzivat, vzdy by mal byt zadany typ
                        columnValues = columnValues.map((value: any) => (value !== null && value !== undefined) ? value.toString() : "");
                    }
                    // columnValues je pole string-ov, mozme zlucit
                    columnValues = [columnValues.join(", ")];
                    // dalsiu konverziu uz nechceme
                    columnValuesProcessed = true;
                }
            } else {
                columnValues = [value]; // stlpec s jednou hodnotou v prvom riadku
            }

            if (!columnValuesProcessed) {
                if (fieldType) {
                    columnValues = columnValues.map((value: any) => convertValueBase(fieldType, scale, value, true, AsUIType.Excel));
                }
            }

            if (columnValues.length > maxColumnLength) {
                maxColumnLength = columnValues.length;
            }

            // skonvertujeme hodnoty, ak je to potrebne
            //columnValues = this.convertValues(columnValues, xFieldList[index], xCsvWriter);

            // ulozime si stlpec do pola stlpcov
            columnList[columnIndex] = columnValues;
        }

        // "matrix" mame hotovy, vytvorime riadky
        const resultRowList: Array<Array<any>> = new Array<Array<any>>(maxColumnLength);
        for (let rowIndex: number = 0; rowIndex < maxColumnLength; rowIndex++) {
            const rowValues: Array<any> = new Array<any>(columns.length);
            for (const [index, columnValues] of columnList.entries()) {
                let csvValue: any;
                if (rowIndex < columnValues.length) {
                    csvValue = columnValues[rowIndex];
                }
                else {
                    csvValue = ""; // prazdna bunka (default)

                    // ak mame zadane stlpce, v ktorych chceme duplikovat hodnoty, tak zduplikujeme hodnotu z prveho riadku (master zaznam)
                    // (nemalo by sa jednat o toMany stlpce)
                    if (fieldsToDuplicateValues) {
                        const field: string | ((row: any) => any) = columns[index].field;
                        if (typeof field === 'string') {
                            if (fieldsToDuplicateValues.includes(field)) {
                                if (columnValues.length > 0) {
                                    csvValue = columnValues[0];
                                }
                            }
                        }
                    }
                }
                rowValues[index] = csvValue;
            }
            // a zapiseme riadok
            resultRowList[rowIndex] = rowValues;
        }
        return resultRowList;
    }

    // ak bude treba, presunut do XUtils
    protected transformToEntity(data: any, selectQueryBuilder: SelectQueryBuilder<unknown>): any {
        // pozor, tato transformacia vracia niektore decimaly (napr. Car.price) ako string, to asi nie je standard
        const transformer = new RawSqlResultsToEntityTransformer(selectQueryBuilder.expressionMap, selectQueryBuilder.connection.driver, [], [], undefined);
        const entityList: any[] = transformer.transform([data], selectQueryBuilder.expressionMap.mainAlias!);
        return entityList[0];
    }
}
