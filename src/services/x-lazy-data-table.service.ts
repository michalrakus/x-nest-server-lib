import {HttpStatus, Injectable} from '@nestjs/common';
import {FindResult, XAggregateValues} from "../serverApi/FindResult";
import {DataSource, SelectQueryBuilder} from "typeorm";
import {FindParam, ResultType} from "../serverApi/FindParam";
import {FindRowByIdParam} from "./FindRowByIdParam";
import {Response} from "express";
import {ReadStream} from "fs";
import {RawSqlResultsToEntityTransformer} from "typeorm/query-builder/transformer/RawSqlResultsToEntityTransformer";
import {dateFormat, XUtilsCommon} from "../serverApi/XUtilsCommon";
import {CsvDecimalFormat, CsvParam, ExportParam, ExportType} from "../serverApi/ExportImportParam";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XField} from "../serverApi/XEntityMetadata";
import {XMainQueryData} from "../x-query-data/XMainQueryData";
import {XQueryData} from "../x-query-data/XQueryData";
import {XSubQueryData} from "../x-query-data/XSubQueryData";

@Injectable()
export class XLazyDataTableService {

    constructor(
        private readonly dataSource: DataSource,
        private readonly xEntityMetadataService: XEntityMetadataService
    ) {}

    async findRows(findParam : FindParam): Promise<FindResult> {
        //console.log("LazyDataTableService.findRows findParam = " + JSON.stringify(findParam));

        // TODO - optimalizacia - leftJoin-y sa mozu nahradit za join-y, ak je ManyToOne asociacia not null (join-y su rychlejsie ako leftJoin-y)

        const xMainQueryData: XMainQueryData = new XMainQueryData(this.xEntityMetadataService, findParam.entity, "t", findParam.filters, findParam.customFilter);

        let rowCount: number;
        const aggregateValues: XAggregateValues = {};
        if (findParam.resultType === ResultType.OnlyRowCount || findParam.resultType === ResultType.RowCountAndPagedRows) {
            //const xEntity: XEntity = this.xEntityMetadataService.getXEntity(findParam.entity);
            const selectQueryBuilder: SelectQueryBuilder<unknown> = this.dataSource.createQueryBuilder(xMainQueryData.xEntity.name, xMainQueryData.rootAlias);
            // povodne tu bol COUNT(1) ale koli where podmienkam na OneToMany asociaciach sme zmenili na COUNT(DISTINCT t0.id)
            // da sa zoptimalizovat, ze COUNT(DISTINCT t0.id) sa bude pouzivat len v pripade ze je pouzita where podmienka na OneToMany asociacii
            // (ale potom to treba nejako detekovat, zatial dame vzdy COUNT(DISTINCT t0.id))
            //selectQueryBuilder.select(`COUNT(DISTINCT ${rootAlias}.${xEntity.idField})`, "count");
            selectQueryBuilder.select(`COUNT(1)`, "count");
            // aggregate fields
            if (findParam.aggregateItems) {
                for (const aggregateItem of findParam.aggregateItems) {
                    const [xQueryData, fieldNew]: [XQueryData, string] = xMainQueryData.getQueryForPathField(aggregateItem.field);
                    const dbField: string = xQueryData.getFieldFromPathField(fieldNew);
                    if (xQueryData.isMainQueryData()) {
                        // ako alias pouzivame aggregateItem.field, moze mat aj "." (napr. assoc1.field1), DB to zvlada ak sa pouziju `assoc1.field1`, mozno to bude treba prerobit
                        selectQueryBuilder.addSelect(`${aggregateItem.aggregateType}(${dbField})`, aggregateItem.field);
                    }
                    else {
                        // vytvorime subquery, pre kazdy field samostatne, ak by sme to chceli efektivnejsie, museli by sme urobit samostatny select
                        // ale tomuto samostatnemu selectu by sme museli komplikovane pridavat where podmienky z main query
                        const xSubQueryData: XSubQueryData = xQueryData as XSubQueryData;
                        const selectSubQueryBuilder: SelectQueryBuilder<unknown> = xSubQueryData.createQueryBuilder(selectQueryBuilder, `${aggregateItem.aggregateType}(${dbField})`);
                        // alias obsahuje "." !
                        // tu uz druhykrat pouzivame agregacnu funkciu - pre SUM, MIN, MAX je to ok, ale pri AVG to ovplyvni vysledok!
                        selectQueryBuilder.addSelect(`${aggregateItem.aggregateType}(${selectSubQueryBuilder.getQuery()})`, aggregateItem.field);
                    }
                }
            }

            for (const [field, alias] of xMainQueryData.assocAliasMap.entries()) {
                selectQueryBuilder.leftJoin(field, alias);
            }
            if (xMainQueryData.where !== "") {
                selectQueryBuilder.where(xMainQueryData.where, xMainQueryData.params);
            }
            else {
                selectQueryBuilder.where("1 = 1");// aby zafungovalo pripadne pridanie selectQueryBuilder.andWhereExists
            }

            for (const [assocOneToMany, xSubQueryData] of xMainQueryData.assocXSubQueryDataMap.entries()) {
                // pridame podmienku EXISTS (subquery)
                // EXISTS pridame len vtedy ak vyplnenim nejakej polozky vo filtri (alebo cez custom filter) vznikla nejaka where podmienka
                // (subquery moze vzniknut aj napr. cez SUM stlpca na OneToMany asociacii, vtedy ale EXISTS nechceme, lebo hlavny select funguje cez LEFT JOIN,
                // vybera aj zaznamy ktore nemaju detail a my chceme aby COUNT naratal presne tolko zaznamov, kolko vracia hlavny select)
                if (xSubQueryData.where !== "") {
                    const selectSubQueryBuilder: SelectQueryBuilder<unknown> = xSubQueryData.createQueryBuilder(selectQueryBuilder, `1`);
                    selectQueryBuilder.andWhereExists(selectSubQueryBuilder);
                }
            }

            const rowOne = await selectQueryBuilder.getRawOne();
            rowCount = rowOne.count;
            if (findParam.aggregateItems) {
                for (const aggregateItem of findParam.aggregateItems) {
                    aggregateValues[aggregateItem.field] = rowOne[aggregateItem.field];
                }
            }

            //console.log("XLazyDataTableService.readLazyDataTable rowCount = " + rowCount);
        }

        let rowList: any[];
        if (findParam.resultType === ResultType.RowCountAndPagedRows || findParam.resultType === ResultType.AllRows) {
            xMainQueryData.addSelectItems(findParam.fields);
            xMainQueryData.addOrderByItems(findParam.multiSortMeta);

            const selectQueryBuilder: SelectQueryBuilder<unknown> = this.createQueryBuilderFromXMainQuery(xMainQueryData);

            if (findParam.resultType === ResultType.RowCountAndPagedRows) {
                selectQueryBuilder.skip(findParam.first);
                selectQueryBuilder.take(findParam.rows);
            }

            rowList = await selectQueryBuilder.getMany();

            if (findParam.resultType === ResultType.AllRows) {
                rowCount = rowList.length;
            }
        }

        const findResult: FindResult = {rowList: rowList, totalRecords: rowCount, aggregateValues: aggregateValues};
        return findResult;
    }

    // metoda hlavne na zjednotenie spolocneho kodu
    createQueryBuilderFromXMainQuery(xMainQueryData: XMainQueryData): SelectQueryBuilder<unknown> {

        // TODO - selectovat len stlpce ktore treba - nepodarilo sa, viac v TODO.txt
        // TODO - tabulky pridane pri vytvoreni xMainQueryData.orderByItems nemusime selectovat, staci ich joinovat, ale koli jednoduchosti ich tiez selectujeme
        const selectQueryBuilder: SelectQueryBuilder<unknown> = this.dataSource.createQueryBuilder(xMainQueryData.xEntity.name, xMainQueryData.rootAlias);
        for (const [field, alias] of xMainQueryData.assocAliasMap.entries()) {
            selectQueryBuilder.leftJoinAndSelect(field, alias);
        }
        // najoinujeme aj tabulky cez pridane cez oneToMany asociacie (lebo mozno potrebujeme nacitat fieldy z tychto tabuliek)
        let where: string = xMainQueryData.where;
        let params: {} = xMainQueryData.params;
        for (const [assocOneToMany, xSubQueryData] of xMainQueryData.assocXSubQueryDataMap.entries()) {
            selectQueryBuilder.leftJoinAndSelect(assocOneToMany, xSubQueryData.rootAlias);
            for (const [field, alias] of xSubQueryData.assocAliasMap.entries()) {
                selectQueryBuilder.leftJoinAndSelect(field, alias);
            }
            where = XQueryData.whereItemAnd(where, xSubQueryData.where);
            params = {...params, ...xSubQueryData.params}; // TODO - nedojde k prepisaniu params? ak ano, druha hodnota prepise tu predchadzajucu
        }
        if (where !== "") {
            selectQueryBuilder.where(where, params);
        }
        selectQueryBuilder.orderBy(xMainQueryData.orderByItems);

        return selectQueryBuilder;
    }

    // docasne sem dame findRowById, lebo pouzivame podobne joinovanie ako pri citani dat pre lazy tabulky
    // (v buducnosti mozme viac zjednotit s lazy tabulkou)
    async findRowById(findParam: FindRowByIdParam): Promise<any> {

        const xMainQueryData: XMainQueryData = new XMainQueryData(this.xEntityMetadataService, findParam.entity, "t", undefined, undefined);
        xMainQueryData.addSelectItems(findParam.fields);

        const selectQueryBuilder : SelectQueryBuilder<unknown> = this.createQueryBuilderFromXMainQuery(xMainQueryData);
        selectQueryBuilder.whereInIds([findParam.id])

        const rows: any[] = await selectQueryBuilder.getMany();
        if (rows.length !== 1) {
            throw "findRowById - expected rows = 1, but found " + rows.length + " rows";
        }
        return rows[0];
    }

    async export(exportParam: ExportParam, res: Response) {
        if (exportParam.exportType === ExportType.Csv) {
            await this.exportCsv(exportParam, res);
        }
        else if (exportParam.exportType === ExportType.Json) {
            await this.exportJson(exportParam, res);
        }
    }

    private async exportCsv(exportParam: ExportParam, res: Response) {

        const selectQueryBuilder: SelectQueryBuilder<unknown> = this.createSelectQueryBuilder(exportParam);
        const readStream: ReadStream = await selectQueryBuilder.stream();

        // potrebujeme zoznam xField-ov, aby sme vedeli urcit typ fieldu
        const xFieldList: XField[] = [];
        const xEntity = this.xEntityMetadataService.getXEntity(exportParam.entity);
        for (const field of exportParam.fields) {
            xFieldList.push(this.xEntityMetadataService.getXFieldByPath(xEntity, field));
        }

        res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
        res.charset = "utf8"; // default encoding

        if (exportParam.csvParam.useHeaderLine) {
            const csvRow: string = this.createHeaderLine(exportParam.csvParam);
            res.write(csvRow, "utf8");
        }

        readStream.on('data', data => {
            const entityObj = this.transformToEntity(data, selectQueryBuilder);
            const rowStr: string = this.convertToCsv(entityObj, exportParam.fields, xFieldList, exportParam.csvParam);
            res.write(rowStr, "utf8");
        });

        readStream.on('end', () => {
            res.status(HttpStatus.OK);
            res.end();
        });
    }

    private async exportJson(exportParam: ExportParam, res: Response) {

        const selectQueryBuilder: SelectQueryBuilder<unknown> = this.createSelectQueryBuilder(exportParam);
        const readStream: ReadStream = await selectQueryBuilder.stream();

        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
        res.charset = "utf8"; // default encoding

        res.write("[", "utf8");

        let firstRow = true;

        readStream.on('data', data => {
            const entityObj = this.transformToEntity(data, selectQueryBuilder);
            let rowStr: string = "";
            if (firstRow) {
                firstRow = false;
            }
            else {
                rowStr += ",";
            }
            rowStr += XUtilsCommon.newLine;
            rowStr += XUtilsCommon.objectAsJSON(entityObj);
            res.write(rowStr, "utf8");
        });

        readStream.on('end', () => {
            res.write(XUtilsCommon.newLine + "]", "utf8");
            res.status(HttpStatus.OK);
            res.end();
        });
    }

    private createSelectQueryBuilder(exportParam: ExportParam): SelectQueryBuilder<unknown> {

        const xMainQueryData: XMainQueryData = new XMainQueryData(this.xEntityMetadataService, exportParam.entity, "t", exportParam.filters, exportParam.customFilter);
        xMainQueryData.addSelectItems(exportParam.fields);
        xMainQueryData.addOrderByItems(exportParam.multiSortMeta);
        return this.createQueryBuilderFromXMainQuery(xMainQueryData);
    }

    private transformToEntity(data: any, selectQueryBuilder: SelectQueryBuilder<unknown>): any {
        // pozor, tato transformacia vracia niektore decimaly (napr. Car.price) ako string, to asi nie je standard
        const transformer = new RawSqlResultsToEntityTransformer(selectQueryBuilder.expressionMap, selectQueryBuilder.connection.driver, [], [], undefined);
        const entityList: any[] = transformer.transform([data], selectQueryBuilder.expressionMap.mainAlias!);
        return entityList[0];
    }

    private convertToCsv(entityObj: any, fields: string[], xFieldList: XField[], csvParam: CsvParam): string {
        let csvRow: string = "";
        for (const [index, field] of fields.entries()) {
            const xField = xFieldList[index];
            const value = XUtilsCommon.getValueByPath(entityObj, field);
            // value should be at least null (no undefined)
            let valueStr: string;
            if (value !== null && value !== undefined) {
                if (value instanceof Date) {
                    // TODO - ak pre datetime nastavime vsetky zlozky casu na 00:00:00, tak sformatuje hodnotu ako datum a spravi chybu pri zapise do DB - zapise  1:00:00
                    if (value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0) {
                        valueStr = dateFormat(value, 'yyyy-mm-dd');
                    }
                    else {
                        // jedna sa o datetime
                        valueStr = dateFormat(value, 'yyyy-mm-dd HH:MM:ss');
                    }
                }
                // niektore decimal hodnoty neprichadzaju ako number (typeof value nie je 'number' ale 'string') preto pouzijeme xField
                else if (xField.type === "decimal") {
                    if (csvParam.csvDecimalFormat === CsvDecimalFormat.Comma) {
                        valueStr = value.toString().replace('.', ','); // 123456,78
                    }
                    else {
                        // csvParam.csvDecimalFormat === CsvDecimalFormat.Dot
                        valueStr = value.toString(); // 123456.78
                    }
                }
                else {
                    valueStr = value.toString();
                }
            }
            else if (value === null) {
                valueStr = "null";
            }
            else {
                valueStr = "";
            }
            valueStr = this.processCsvItem(valueStr, csvParam.csvSeparator);
            if (csvRow.length > 0) {
                csvRow += csvParam.csvSeparator;
            }
            csvRow += valueStr;
        }
        csvRow += XUtilsCommon.newLine;
        return csvRow;
    }

    private createHeaderLine(csvParam: CsvParam): string {
        let csvRow: string = "";
        for (const header of csvParam.headers) {
            const valueStr = this.processCsvItem(header, csvParam.csvSeparator);
            if (csvRow.length > 0) {
                csvRow += csvParam.csvSeparator;
            }
            csvRow += valueStr;
        }
        csvRow += XUtilsCommon.newLine;
        return csvRow;
    }

    private processCsvItem(valueStr: string, csvSeparator: string): string {
        valueStr = valueStr.replace(/"/g, '""'); // ekvivalent pre regexp /"/g je: new RegExp('"', 'g')
        // aj tu pouzivam XUtils.csvSeparator
        if (valueStr.search(new RegExp(`("|${csvSeparator}|\n)`, 'g')) >= 0) {
            valueStr = '"' + valueStr + '"'
        }
        return valueStr;
    }
}
