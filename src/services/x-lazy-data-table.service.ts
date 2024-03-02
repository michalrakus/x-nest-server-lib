import {HttpStatus, Injectable} from '@nestjs/common';
import {FindResult, XAggregateValues} from "../serverApi/FindResult";
import {DataSource, SelectQueryBuilder} from "typeorm";
import {
    FindParam,
    ResultType,
    XCustomFilterItem,
    XFullTextSearch,
    XLazyAutoCompleteSuggestionsRequest
} from "../serverApi/FindParam";
import {FindRowByIdParam} from "./FindRowByIdParam";
import {Response} from "express";
import {ReadStream} from "fs";
import {RawSqlResultsToEntityTransformer} from "typeorm/query-builder/transformer/RawSqlResultsToEntityTransformer";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";
import {ExportParam, ExportType, LazyDataTableQueryParam} from "../serverApi/ExportImportParam";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XAssoc, XEntity, XField} from "../serverApi/XEntityMetadata";
import {XMainQueryData} from "../x-query-data/XMainQueryData";
import {XQueryData} from "../x-query-data/XQueryData";
import {XSubQueryData} from "../x-query-data/XSubQueryData";
import {XCsvWriter, XExportService} from "./x-export.service";
import {XUtils} from "./XUtils";
import {stringAsDB} from "../serverApi/XUtilsConversions";

@Injectable()
export class XLazyDataTableService {

    constructor(
        private readonly dataSource: DataSource,
        private readonly xEntityMetadataService: XEntityMetadataService,
        private readonly xExportService: XExportService
    ) {
        this.writeCsv = this.writeCsv.bind(this);
    }

    async findRows(findParam : FindParam): Promise<FindResult> {
        //console.log("LazyDataTableService.findRows findParam = " + JSON.stringify(findParam));

        // TODO - optimalizacia - leftJoin-y sa mozu nahradit za join-y, ak je ManyToOne asociacia not null (join-y su rychlejsie ako leftJoin-y)

        this.createDefaultFieldsForFullTextSearch(findParam.fullTextSearch, findParam.fields);
        const xMainQueryData: XMainQueryData = new XMainQueryData(this.xEntityMetadataService, findParam.entity, "t", findParam.filters, findParam.fullTextSearch, findParam.customFilterItems);

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

            // pridame pripadne where podmienky pre full-text search
            // k existujucej where podmienke cez AND pridame:
            // (<main-query full-text cond> OR EXISTS <sub-query-1 full-text cond> OR EXISTS <sub-query-2 full-text cond> OR ...)
            // -> a tuto celu podmienku pridame (cez AND) tolkokrat kolko mame hodnot z inputu pre full-text search
            // (t.j. ak mame na vstupe "Janko Mrkvicka", tak jedna where podmienka bude pre "Janko" a druha pre "Mrkvicka" a budu spojene cez AND)
            // param selectQueryBuilder = bude vytvarat EXISTS podmienky pre subqueries
            const ftsWhereItem: string | "" = xMainQueryData.createFtsWhereItem(selectQueryBuilder);
            if (ftsWhereItem !== "") {
                selectQueryBuilder.andWhere(`(${ftsWhereItem})`);
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
        if (findParam.resultType === ResultType.OnlyPagedRows || findParam.resultType === ResultType.RowCountAndPagedRows || findParam.resultType === ResultType.AllRows) {
            xMainQueryData.addSelectItems(findParam.fields);
            xMainQueryData.addOrderByItems(findParam.multiSortMeta);

            const selectQueryBuilder: SelectQueryBuilder<unknown> = this.createQueryBuilderFromXMainQuery(xMainQueryData);

            if (findParam.resultType === ResultType.OnlyPagedRows || findParam.resultType === ResultType.RowCountAndPagedRows) {
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
    // TODO - nema ist do XMainQueryData? mal by ale potom aj vytvraranie query builder pre COUNT/SUM select by malo ist do XMainQueryData, zatial nechame
    createQueryBuilderFromXMainQuery(xMainQueryData: XMainQueryData): SelectQueryBuilder<unknown> {

        // TODO - selectovat len stlpce ktore treba - nepodarilo sa, viac v TODO.txt
        // TODO - tabulky pridane pri vytvoreni xMainQueryData.orderByItems nemusime selectovat, staci ich joinovat, ale koli jednoduchosti ich tiez selectujeme
        // TODO - podobne aj tabulky pridane cez custom filter alebo cez full-text search ktory obsahuje ine stlpce ako su v browse - tie tiez nepotrebujeme selectovat,
        // t.j. netreba volat leftJoinAndSelect(field, alias), staci volat leftJoin(field, alias) - chcelo by to okrem alias-u si zapisovat aj ci treba aj select (boolean hodnotu)
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

        // param undefined = nechceme EXISTS, chceme klasicke where podmienky
        where = XQueryData.whereItemAnd(where, xMainQueryData.createFtsWhereItem(undefined));

        if (where !== "") {
            selectQueryBuilder.where(where, params);
        }
        selectQueryBuilder.orderBy(xMainQueryData.orderByItems);

        return selectQueryBuilder;
    }

    // docasne sem dame findRowById, lebo pouzivame podobne joinovanie ako pri citani dat pre lazy tabulky
    // (v buducnosti mozme viac zjednotit s lazy tabulkou)
    async findRowById(findParam: FindRowByIdParam): Promise<any> {

        const xMainQueryData: XMainQueryData = new XMainQueryData(this.xEntityMetadataService, findParam.entity, "t", undefined, undefined, undefined);
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
            await this.xExportService.exportCsv(exportParam, res, this.writeCsv);
        }
        else if (exportParam.exportType === ExportType.Json) {
            await this.exportJson(exportParam.queryParam, res);
        }
    }

    writeCsv(queryParam: LazyDataTableQueryParam, xCsvWriter: XCsvWriter): Promise<void> {

        const [selectQueryBuilder, existsToManyAssoc]: [SelectQueryBuilder<unknown>, boolean] = this.createSelectQueryBuilder(queryParam);
        if (existsToManyAssoc) {
            return this.writeCsvUsingList(queryParam, selectQueryBuilder, xCsvWriter);
        } else {
            return this.writeCsvUsingStream(queryParam, selectQueryBuilder, xCsvWriter);
        }
    }

    async writeCsvUsingStream(queryParam: LazyDataTableQueryParam, selectQueryBuilder: SelectQueryBuilder<unknown>, xCsvWriter: XCsvWriter): Promise<void> {

        const readStream: ReadStream = await selectQueryBuilder.stream();

        // potrebujeme zoznam xField-ov, aby sme vedeli urcit typ fieldu
        const xFieldList: XField[] = this.createXFieldList(queryParam);

        readStream.on('data', data => {
            const entityObj = this.transformToEntity(data, selectQueryBuilder);
            this.writeSimpleObjectRowToCsv(entityObj, queryParam.fields, xFieldList, xCsvWriter);
        });

        readStream.on('end', () => {
            xCsvWriter.end();
        });
    }

    async writeCsvUsingList(queryParam: LazyDataTableQueryParam, selectQueryBuilder: SelectQueryBuilder<unknown>, xCsvWriter: XCsvWriter): Promise<void> {

        const rowList: any[] = await selectQueryBuilder.getMany();

        const xEntity = this.xEntityMetadataService.getXEntity(queryParam.entity);

        // potrebujeme zoznam xField-ov, aby sme vedeli urcit typ fieldu
        const xFieldList: XField[] = this.createXFieldList(queryParam);

        for (const row of rowList) {
            this.writeObjectRowToCsv(row, queryParam.fields, xEntity, xFieldList, xCsvWriter);
        }

        xCsvWriter.end();
    }

    private writeSimpleObjectRowToCsv(entityObj: any, fields: string[], xFieldList: XField[], xCsvWriter: XCsvWriter) {
        const csvValues: Array<any> = new Array<any>(fields.length);
        for (const [index, field] of fields.entries()) {
            let value: any = XUtilsCommon.getValueByPath(entityObj, field);
            // skonvertujeme hodnotu, ak je to potrebne
            [value] = this.convertValues([value], xFieldList[index], xCsvWriter);
            csvValues[index] = value;
        }
        // a zapiseme riadok
        xCsvWriter.writeRow(...csvValues);
    }

    private writeObjectRowToCsv(entityObj: any, fields: string[], xEntity: XEntity, xFieldList: XField[], xCsvWriter: XCsvWriter) {
        // vytvarany csv row je tvoreny stlpcami - standardne ma stlpec presne 1 hodnotu,
        // ak sa vsak jedna o field dotahovany cez one-to-many asociaciu, ma dany stlpec vsetky hodnoty dotiahnute cez danu asociaciu (moze byt aj 0 hodnot)
        // dlzku najdlhsieho stlpca si zapiseme do "maxColumnIndex"
        // (zatial) funguje len pre one-to-many asociacie ktore su na zaciatku "path" - TODO - poriest rekurzivne
        const columnList: Array<any[]> = new Array<any[]>(fields.length);
        let maxColumnLength: number = 1;
        for (const [index, path] of fields.entries()) {
            let columnValues: any[] = undefined;
            // ak mame OneToMany asociaciu, musime nacitat zoznam hodnot
            const [field, restPath]: [string, string | null] = XUtilsCommon.getFieldAndRestPath(path);
            if (restPath !== null) {
                const xAssoc: XAssoc = this.xEntityMetadataService.getXAssoc(xEntity, field);
                if (xAssoc.relationType === "one-to-many") {
                    const assocRowList: any[] = entityObj[xAssoc.name];
                    if (!Array.isArray(assocRowList)) {
                        throw `Unexpected error - row list not found on one-to-many assoc ${xAssoc.name}`;
                    }
                    columnValues = assocRowList.map<any>((row) => XUtilsCommon.getValueByPath(row, restPath));
                    if (columnValues.length > maxColumnLength) {
                        maxColumnLength = columnValues.length;
                    }
                }
            }
            if (columnValues === undefined) {
                // nemame one-to-many asociaciu, jedna sa o standardny atribut
                // zapiseme si pole o dlzky 1
                columnValues = [XUtilsCommon.getValueByPath(entityObj, path)];
            }
            // skonvertujeme hodnoty, ak je to potrebne
            columnValues = this.convertValues(columnValues, xFieldList[index], xCsvWriter);
            // ulozime si stlpec do pola stlpcov
            columnList[index] = columnValues;
        }
        // "matrix" mame hotovy, vytvorime csv riadky
        for (let rowIndex: number = 0; rowIndex < maxColumnLength; rowIndex++) {
            const csvValues: Array<any> = new Array<any>(fields.length);
            for (const [index, columnValues] of columnList.entries()) {
                let csvValue: any;
                if (rowIndex < columnValues.length) {
                    csvValue = columnValues[rowIndex];
                }
                else {
                    csvValue = ""; // prazdna bunka
                }
                csvValues[index] = csvValue;
            }
            // a zapiseme riadok
            xCsvWriter.writeRow(...csvValues);
        }
    }

    private convertValues(values: any[], xField: XField, xCsvWriter: XCsvWriter): any[] {
        // kedze niektore decimal hodnoty neprichadzaju ako number (typeof value nie je 'number' ale 'string') preto pouzijeme xField
        // (je to pravdepodobne dosledok pouzitia nestandardej transformToEntity ale stalo sa to napr. aj v skch-finance v BudgetReportService
        if (xField.type === "decimal") {
            // skonvertujeme rovno na string
            values = values.map<any>((value) => (value !== null && value !== undefined) ? xCsvWriter.number(value, xField.scale) : value);
        }
        return values;
    }

    private createXFieldList(queryParam: LazyDataTableQueryParam): XField[] {
        const xFieldList: XField[] = [];
        const xEntity = this.xEntityMetadataService.getXEntity(queryParam.entity);
        for (const field of queryParam.fields) {
            xFieldList.push(this.xEntityMetadataService.getXFieldByPath(xEntity, field));
        }
        return xFieldList;
    }

    private exportJson(queryParam: LazyDataTableQueryParam, res: Response): Promise<void> {

        const headerCharset: string = "UTF-8";
        res.setHeader(`Content-Type`, `application/json; charset=${headerCharset}`);
        res.charset = headerCharset; // default encoding, pouziva sa pravdepodobne ak neni setnuty charset v 'Content-Type' (pozri riadok vyssie)

        const [selectQueryBuilder, existsToManyAssoc]: [SelectQueryBuilder<unknown>, boolean] = this.createSelectQueryBuilder(queryParam);
        if (existsToManyAssoc) {
            return this.exportJsonUsingList(selectQueryBuilder, res);
        }
        else {
            return this.exportJsonUsingStream(selectQueryBuilder, res);
        }
    }

    private async exportJsonUsingList(selectQueryBuilder: SelectQueryBuilder<unknown>, res: Response): Promise<void> {

        const rowList: any[] = await selectQueryBuilder.getMany();

        res.write(XUtilsCommon.objectAsJSON(rowList), "utf8");

        res.status(HttpStatus.OK);
        res.end();
    }

    private async exportJsonUsingStream(selectQueryBuilder: SelectQueryBuilder<unknown>, res: Response): Promise<void> {

        const readStream: ReadStream = await selectQueryBuilder.stream();

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

    private createSelectQueryBuilder(queryParam: LazyDataTableQueryParam): [SelectQueryBuilder<unknown>, boolean] {

        this.createDefaultFieldsForFullTextSearch(queryParam.fullTextSearch, queryParam.fields);
        const xMainQueryData: XMainQueryData = new XMainQueryData(this.xEntityMetadataService, queryParam.entity, "t", queryParam.filters, queryParam.fullTextSearch, queryParam.customFilterItems);
        xMainQueryData.addSelectItems(queryParam.fields);
        xMainQueryData.addOrderByItems(queryParam.multiSortMeta);
        return [this.createQueryBuilderFromXMainQuery(xMainQueryData), xMainQueryData.assocXSubQueryDataMap.size > 0];
    }

    private createDefaultFieldsForFullTextSearch(fullTextSearch: XFullTextSearch | undefined, fields: string[] | undefined) {
        if (fullTextSearch) {
            if (!fullTextSearch.fields) {
                fullTextSearch.fields = fields; // ako default stlpce pouzijeme stlpce browsu
            }
        }
    }

    private transformToEntity(data: any, selectQueryBuilder: SelectQueryBuilder<unknown>): any {
        // pozor, tato transformacia vracia niektore decimaly (napr. Car.price) ako string, to asi nie je standard
        const transformer = new RawSqlResultsToEntityTransformer(selectQueryBuilder.expressionMap, selectQueryBuilder.connection.driver, [], [], undefined);
        const entityList: any[] = transformer.transform([data], selectQueryBuilder.expressionMap.mainAlias!);
        return entityList[0];
    }

    // ************** podpora pre autocomplete ******************

    async lazyAutoCompleteSuggestions(suggestionsRequest: XLazyAutoCompleteSuggestionsRequest): Promise<FindResult> {

        const findParamRows: FindParam = {
            resultType: ResultType.OnlyPagedRows,
            first: 0,
            rows: suggestionsRequest.maxRows,
            entity: suggestionsRequest.entity,
            fullTextSearch: suggestionsRequest.fullTextSearch,
            customFilterItems: suggestionsRequest.filterItems,
            multiSortMeta: suggestionsRequest.multiSortMeta,
            fields: suggestionsRequest.fields
        };
        return await this.findRows(findParamRows);
    }

/*  stary nepouzivany sposob - ma vzdy 2 drahe selecty (cca 200 ms na tabulke klientov kazdy select):
    async lazyAutoCompleteSuggestionsOld(suggestionsRequest: XLazyAutoCompleteSuggestionsRequest): Promise<FindResult> {

        const findParamCount: FindParam = {
            resultType: ResultType.OnlyRowCount,
            entity: suggestionsRequest.entity,
            fullTextSearch: suggestionsRequest.fullTextSearch,
            customFilterItems: suggestionsRequest.filterItems
        };
        let findResult: FindResult = await this.findRows(findParamCount);
        if (findResult.totalRecords <= suggestionsRequest.maxRows) {
            const findParamRows: FindParam = {
                resultType: ResultType.AllRows,
                entity: suggestionsRequest.entity,
                fullTextSearch: suggestionsRequest.fullTextSearch,
                customFilterItems: suggestionsRequest.filterItems,
                multiSortMeta: suggestionsRequest.multiSortMeta,
                fields: suggestionsRequest.fields
            };
            findResult = await this.findRows(findParamRows);
        }
        return findResult;
    }
*/
    // ************** stary nepouzivany export ******************
/*
    private async exportCsv(exportParam: ExportParam, res: Response) {

        const selectQueryBuilder: SelectQueryBuilder<unknown> = this.createSelectQueryBuilder(exportParam.queryParam);
        const readStream: ReadStream = await selectQueryBuilder.stream();

        // potrebujeme zoznam xField-ov, aby sme vedeli urcit typ fieldu
        const xFieldList: XField[] = [];
        const xEntity = this.xEntityMetadataService.getXEntity(exportParam.queryParam.entity);
        for (const field of exportParam.queryParam.fields) {
            xFieldList.push(this.xEntityMetadataService.getXFieldByPath(xEntity, field));
        }

        const headerCharset: string = XExportService.getHeaderCharset(exportParam.csvParam.csvEncoding); // napr. UTF-8, windows-1250
        const iconvCharset: CsvEncoding = exportParam.csvParam.csvEncoding; // napr. utf-8, win1250

        res.setHeader("Content-Type", `text/csv; charset=${headerCharset}`);
        res.charset = headerCharset; // default encoding - pravdepodobne setne tuto hodnotu do charset=<res.charset> v header-i "Content-Type"
        // ak neni atribut charset definovany explicitne - TODO - odskusat

        if (exportParam.csvParam.useHeaderLine) {
            const csvRow: string = this.createHeaderLineOld(exportParam.csvParam);
            res.write(iconv.encode(csvRow, iconvCharset)); // neviem ci toto je idealny sposob ako pouzivat iconv, ale funguje...
        }

        readStream.on('data', data => {
            const entityObj = this.transformToEntity(data, selectQueryBuilder);
            const rowStr: string = this.convertToCsvOld(entityObj, exportParam.queryParam.fields, xFieldList, exportParam.csvParam);
            res.write(iconv.encode(rowStr, iconvCharset));
        });

        readStream.on('end', () => {
            res.status(HttpStatus.OK);
            res.end();
        });
    }

    private convertToCsvOld(entityObj: any, fields: string[], xFieldList: XField[], csvParam: CsvParam): string {
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
            valueStr = this.processCsvItemOld(valueStr, csvParam.csvSeparator);
            if (csvRow.length > 0) {
                csvRow += csvParam.csvSeparator;
            }
            csvRow += valueStr;
        }
        csvRow += XUtilsCommon.newLine;
        return csvRow;
    }

    private createHeaderLineOld(csvParam: CsvParam): string {
        let csvRow: string = "";
        for (const header of csvParam.headers) {
            const valueStr = this.processCsvItemOld(header, csvParam.csvSeparator);
            if (csvRow.length > 0) {
                csvRow += csvParam.csvSeparator;
            }
            csvRow += valueStr;
        }
        csvRow += XUtilsCommon.newLine;
        return csvRow;
    }

    private processCsvItemOld(valueStr: string, csvSeparator: string): string {
        // moj stary Excel 2010 nechcel nacitavat subor ktory obsahoval v bunke retazec ID
        if (valueStr === "ID") {
            valueStr = '"' + valueStr + '"';
        }
        else {
            valueStr = valueStr.replace(/"/g, '""'); // ekvivalent pre regexp /"/g je: new RegExp('"', 'g')
            // aj tu pouzivam XUtils.csvSeparator
            if (valueStr.search(new RegExp(`("|${csvSeparator}|\n)`, 'g')) >= 0) {
                valueStr = '"' + valueStr + '"';
            }
        }
        return valueStr;
    }
 */
}
