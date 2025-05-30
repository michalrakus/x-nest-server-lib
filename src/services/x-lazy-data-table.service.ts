import {Injectable, StreamableFile} from '@nestjs/common';
import {FindResult, XAggregateValues} from "../serverApi/FindResult";
import {DataSource, SelectQueryBuilder} from "typeorm";
import {
    FindParam,
    ResultType, XCustomFilterItem,
    XFullTextSearch,
    XLazyAutoCompleteSuggestionsRequest
} from "../serverApi/FindParam";
import {FindRowByIdParam} from "./FindRowByIdParam";
import {Response} from "express";
import {
    ExportCsvParam,
    ExportExcelParam,
    ExportJsonParam,
    LazyDataTableQueryParam
} from "../serverApi/ExportImportParam";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XMainQueryData} from "../x-query-data/XMainQueryData";
import {XQueryData} from "../x-query-data/XQueryData";
import {XSubQueryData} from "../x-query-data/XSubQueryData";
import {XExportColumn} from "./x-export.service";
import {XExportExcelService} from "./x-export-excel.service";
import {XExportJsonService} from "./x-export-json.service";
import {XExportCsvService} from "./x-export-csv.service";
import {numberFromString} from "../serverApi/XUtilsConversions";
import {DataTableSortMeta} from "../serverApi/PrimeFilterSortMeta";
import {XAssoc, XEntity} from "../serverApi/XEntityMetadata";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";

@Injectable()
export class XLazyDataTableService {

    constructor(
        private readonly dataSource: DataSource,
        private readonly xEntityMetadataService: XEntityMetadataService,
        private readonly xExportCsvService: XExportCsvService,
        private readonly xExportExcelService: XExportExcelService,
        private readonly xExportJsonService: XExportJsonService
    ) {
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
                        selectQueryBuilder.addSelect(`${aggregateItem.aggregateFunction}(${dbField})`, aggregateItem.field);
                    }
                    else {
                        // vytvorime subquery, pre kazdy field samostatne, ak by sme to chceli efektivnejsie, museli by sme urobit samostatny select
                        // ale tomuto samostatnemu selectu by sme museli komplikovane pridavat where podmienky z main query
                        const xSubQueryData: XSubQueryData = xQueryData as XSubQueryData;
                        const selectSubQueryBuilder: SelectQueryBuilder<unknown> = xSubQueryData.createQueryBuilder(selectQueryBuilder, `${aggregateItem.aggregateFunction}(${dbField})`);
                        // alias obsahuje "." !
                        // tu uz druhykrat pouzivame agregacnu funkciu - pre SUM, MIN, MAX je to ok, ale pri AVG to ovplyvni vysledok!
                        selectQueryBuilder.addSelect(`${aggregateItem.aggregateFunction}(${selectSubQueryBuilder.getQuery()})`, aggregateItem.field);
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

    // sorts all oneToMany assocs with cascade (insert and update) by id - it is default sorting used by XFormDataTable2 on the frontend
    // helper method to avoid explicit sorting, used usually after XLazyDataTableService.findRowById
    sortCascadeAssocsByIdField(xEntity: XEntity, row: any) {
        const assocOneToManyList: XAssoc[] = this.xEntityMetadataService.getXAssocList(xEntity, ["one-to-many"]).filter((assoc: XAssoc) => assoc.isCascadeInsert && assoc.isCascadeUpdate);
        for (const assoc of assocOneToManyList) {
            const assocRowList: any[] = row[assoc.name];
            const xEntityAssoc: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);
            // not all associations must be read from DB (if join is missing that assocRowList is undefined)
            if (assocRowList) {
                row[assoc.name] = XUtilsCommon.arraySort(assocRowList, xEntityAssoc.idField);
            }
        }
    }

    // ************** podpora pre export ******************

    // poznamka: ak by sa tieto funkcie (alebo ich cast) dali presunut do export servisov, bolo by fajn...

    async exportExcel(exportExcelParam: ExportExcelParam): Promise<StreamableFile> {

        const [selectQueryBuilder, existsToManyAssoc]: [SelectQueryBuilder<unknown>, boolean] = this.createSelectQueryBuilder(exportExcelParam.queryParam);
        const rowList: any[] = await selectQueryBuilder.getMany();

        const columns: XExportColumn[] = [];
        for (const [index, field] of exportExcelParam.queryParam.fields.entries()) {
            const header: string = exportExcelParam.excelCsvParam.headers ? exportExcelParam.excelCsvParam.headers[index] : "";
            let width: number | undefined = undefined;
            const widthStr: string | undefined = exportExcelParam.widths[index]; // prichadza napr. '7.75rem'
            if (widthStr && widthStr.endsWith('rem')) {
                width = numberFromString(widthStr.substring(0, widthStr.length - 'rem'.length)) ?? undefined;
                width = width ? width * 1.1 : undefined; // stlpce pre datumy su uzke, tak este prenasobime bulharskou konstantou
            }
            columns.push({header: header, field: field, width: width});
        }

        return this.xExportExcelService.exportBase(
            exportExcelParam.queryParam.entity,
            columns,
            exportExcelParam.excelCsvParam.headers !== undefined,
            exportExcelParam.excelCsvParam.toManyAssocExport,
            exportExcelParam.excelCsvParam.fieldsToDuplicateValues,
            exportExcelParam.queryParam.entity,
            rowList
        );
    }

    exportCsv(exportCsvParam: ExportCsvParam, res: Response): Promise<void> {

        const columns: XExportColumn[] = [];
        for (const [index, field] of exportCsvParam.queryParam.fields.entries()) {
            const header: string = exportCsvParam.excelCsvParam.headers ? exportCsvParam.excelCsvParam.headers[index] : "";
            columns.push({header: header, field: field});
        }

        const [selectQueryBuilder, existsToManyAssoc]: [SelectQueryBuilder<unknown>, boolean] = this.createSelectQueryBuilder(exportCsvParam.queryParam);
        if (existsToManyAssoc) {
            return this.xExportCsvService.exportUsingList(exportCsvParam, columns, selectQueryBuilder, res);
        } else {
            return this.xExportCsvService.exportUsingStream(exportCsvParam, columns, selectQueryBuilder, res);
        }
    }

    exportJson(exportJsonParam: ExportJsonParam, res: Response): Promise<void> {

        const headerCharset: string = "UTF-8";
        res.setHeader(`Content-Type`, `application/json; charset=${headerCharset}`);
        res.charset = headerCharset; // default encoding, pouziva sa pravdepodobne ak neni setnuty charset v 'Content-Type' (pozri riadok vyssie)

        const [selectQueryBuilder, existsToManyAssoc]: [SelectQueryBuilder<unknown>, boolean] = this.createSelectQueryBuilder(exportJsonParam.queryParam);
        if (existsToManyAssoc) {
            return this.xExportJsonService.exportJsonUsingList(selectQueryBuilder, res);
        }
        else {
            return this.xExportJsonService.exportJsonUsingStream(selectQueryBuilder, res);
        }
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
    // ************** fetch rows - zodpoveda metode XUtils.fetchRows na frontend-e ******************

    async fetchRows(entity: string, customFilterItems?: XCustomFilterItem[] | undefined, multiSortMeta?: DataTableSortMeta[] | undefined, fields?: string[]): Promise<any[]> {
        const findParam: FindParam = {resultType: ResultType.AllRows, entity: entity, customFilterItems: customFilterItems, multiSortMeta: multiSortMeta, fields: fields};
        const findResult: FindResult = await this.findRows(findParam);
        return findResult.rowList;
    }


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
