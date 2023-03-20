import {HttpStatus, Injectable} from '@nestjs/common';
import {FindResult} from "../serverApi/FindResult";
import {DataSource, OrderByCondition, SelectQueryBuilder} from "typeorm";
import {FindParam, ResultType} from "../serverApi/FindParam";
import {FindRowByIdParam} from "./FindRowByIdParam";
import {Response} from "express";
import {ReadStream} from "fs";
import {RawSqlResultsToEntityTransformer} from "typeorm/query-builder/transformer/RawSqlResultsToEntityTransformer";
import {dateFormat, XUtilsCommon} from "../serverApi/XUtilsCommon";
import {CsvDecimalFormat, CsvParam, ExportParam, ExportType} from "../serverApi/ExportImportParam";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XField} from "../serverApi/XEntityMetadata";
import {
    DataTableFilterMeta, DataTableFilterMetaData,
    DataTableOperatorFilterMetaData,
    DataTableSortMeta, FilterMatchMode
} from "../serverApi/PrimeFilterSortMeta";

@Injectable()
export class XLazyDataTableService {

    constructor(
        private readonly dataSource: DataSource,
        private readonly xEntityMetadataService: XEntityMetadataService
    ) {}

    async findRows(findParam : FindParam): Promise<FindResult> {
        //console.log("LazyDataTableService.findRows findParam = " + JSON.stringify(findParam));

        // TODO - optimalizacia - leftJoin-y sa mozu nahradit za join-y, ak je ManyToOne asociacia not null (join-y su rychlejsie ako leftJoin-y)

        const assocMap: Map<string, string> = new Map<string, string>();

        // TODO - krajsi nazov aliasu?
        const rootAlias: string = "t0";

        const {where, params} = this.createWhere(rootAlias, findParam.filters, assocMap);
        //console.log("LazyDataTableService.findRows where = " + JSON.stringify(where) + ", params = " + JSON.stringify(params));

        const repository = this.dataSource.getRepository(findParam.entity);

        let selectQueryBuilder : SelectQueryBuilder<unknown>;

        let rowCount: number;
        if (findParam.resultType === ResultType.OnlyRowCount || findParam.resultType === ResultType.RowCountAndPagedRows) {
            selectQueryBuilder = repository.createQueryBuilder(rootAlias);
            selectQueryBuilder.select("COUNT(1)", "count");
            for (const [field, alias] of assocMap.entries()) {
                selectQueryBuilder.leftJoin(field, alias);
            }
            selectQueryBuilder.where(where, params);

            const rowOne = await selectQueryBuilder.getRawOne();
            rowCount = rowOne.count;
            //console.log("XLazyDataTableService.readLazyDataTable rowCount = " + rowCount);
        }

        let rowList: any[];
        if (findParam.resultType === ResultType.RowCountAndPagedRows || findParam.resultType === ResultType.AllRows) {
            const selectItems: string[] = this.createSelectItems(rootAlias, findParam.fields, assocMap);
            const orderByCondition : OrderByCondition = this.createOrderByCondition(rootAlias, findParam.multiSortMeta, assocMap);

            // TODO - selectovat len stlpce ktore treba - nepodarilo sa, viac v TODO.txt
            selectQueryBuilder = repository.createQueryBuilder(rootAlias);
            for (const [field, alias] of assocMap.entries()) {
                selectQueryBuilder.leftJoinAndSelect(field, alias);
            }
            selectQueryBuilder.where(where, params);
            selectQueryBuilder.orderBy(orderByCondition);

            if (findParam.resultType === ResultType.RowCountAndPagedRows) {
                selectQueryBuilder.skip(findParam.first);
                selectQueryBuilder.take(findParam.rows);
            }

            rowList = await selectQueryBuilder.getMany();

            if (findParam.resultType === ResultType.AllRows) {
                rowCount = rowList.length;
            }
        }

        const findResult: FindResult = {rowList: rowList, totalRecords: rowCount};
        return Promise.resolve(findResult);
    }

    // pozor! metoda vytvara (meni) "assocMap"
    createSelectItems(rootAlias : string, fields : string[], assocMap : Map<string, string>) : string[] {
        const selectItems : string[] = [];
        for (const field of fields) {
            const lastField: string = this.getFieldFromPath(rootAlias + "." + field, assocMap); // metoda modifikuje assocMap
            // ak chceme nacitat OneToMany asociaciu, tak pouzijeme path "<asociacia>.*FAKE*", tym zabezpecime aby sa nacitala aj asociacia aj ked nezadame konkretny atribut
            // je to take male docasne hotfix riesenie
            if (lastField !== '*FAKE*') {
                selectItems.push();
            }
        }
        return selectItems;
    }

    getFieldFromPath(path : string, assocMap : Map<string, string>) : string {
        // ak sa jedna o koncovy atribut (napr. t2.attrib), tak ho vratime
        const posDot : number = path.indexOf(".");
        if (posDot == -1) {
            // TODO - moze byt?
            throw "Unexpected error - path " + path + " has no alias";
        }
        const posDotSecond : number = path.indexOf(".", posDot + 1);
        if (posDotSecond == -1) {
            return path;
        }
        // jedna sa o path
        const assoc : string = path.substring(0, posDotSecond);
        const remainingPath : string = path.substring(posDotSecond + 1);

        let aliasForAssoc : string = assocMap.get(assoc);
        if (aliasForAssoc === undefined) {
            // asociaciu este nemame pridanu, pridame ju
            // TODO - krajsi nazov aliasu?
            aliasForAssoc = "t" + (assocMap.size + 1).toString();
            assocMap.set(assoc, aliasForAssoc);
        }
        // ziskame atribut zo zvysnej path
        return this.getFieldFromPath(aliasForAssoc + "." + remainingPath, assocMap);
    }

    // param assocMap is modified inside the function!
    createWhere(rootAlias: string, filters: DataTableFilterMeta, assocMap: Map<string, string>): {where: string; params: {};} {
        //console.log("LazyDataTableService.findRows filters = " + JSON.stringify(filters));
        let where : string = "";
        let params : {} = {};
        for (const [filterField, filterValue] of Object.entries(filters)) {
            let whereItems: string = "";
            if ('operator' in filterValue) {
                // composed condition
                const operatorFilterItem: DataTableOperatorFilterMetaData = filterValue;
                const whereOperator = " " + operatorFilterItem.operator.toUpperCase() + " "; // AND or OR
                for (const [index, filterItem] of operatorFilterItem.constraints.entries()) {
                    const whereItem: string = this.createWhereItem(rootAlias, filterField, filterItem, index, assocMap, params);
                    if (whereItem !== "") {
                        if (whereItems !== "") {
                            whereItems += whereOperator;
                        }
                        whereItems += "(" + whereItem + ")";
                    }
                }
            }
            else {
                // simple condition
                const filterItem: DataTableFilterMetaData = filterValue;
                whereItems = this.createWhereItem(rootAlias, filterField, filterItem, undefined, assocMap, params);
            }
            // if there was some condition for current filterField, add it to the result
            if (whereItems !== "") {
                if (where !== "") {
                    where += " AND ";
                }
                where += "(" + whereItems + ")";
            }
        }
        return {where: where, params: params};
    }

    // params assocMap, params are modified inside the function!
    createWhereItem(rootAlias: string, filterField: string, filterItem: DataTableFilterMetaData, paramIndex: number | undefined, assocMap: Map<string, string>, params: {}): string {
        let whereItem: string = "";
        // podmienka filterItem.value !== '' je workaround, spravne by bolo na frontende menit '' na null v onChange metode filter input-u
        // problem je, ze nemame custom input filter, museli by sme ho dorobit (co zas nemusi byt az taka hrozna robota)
        if (filterItem.value !== null && filterItem.value !== '') {
            const field: string = this.getFieldFromPath(rootAlias + "." + filterField, assocMap);
            // TODO - pouzit paramName :1, :2, :3, ... ?
            let paramName: string = field; // paramName obsahuje "." (napr. t2.attrib)
            if (paramIndex !== undefined) {
                paramName += "_" + paramIndex;
            }
            switch (filterItem.matchMode) {
                case FilterMatchMode.STARTS_WITH:
                    whereItem = this.createWhereItemBase(field, "LIKE", paramName, `${filterItem.value}%`, params);
                    break;
                case FilterMatchMode.CONTAINS:
                    whereItem = this.createWhereItemBase(field, "LIKE", paramName, `%${filterItem.value}%`, params);
                    break;
                case FilterMatchMode.NOT_CONTAINS:
                    whereItem = this.createWhereItemBase(field, "NOT LIKE", paramName, `%${filterItem.value}%`, params);
                    break;
                case FilterMatchMode.ENDS_WITH:
                    whereItem = this.createWhereItemBase(field, "LIKE", paramName, `%${filterItem.value}`, params);
                    break;
                case FilterMatchMode.EQUALS:
                    whereItem = this.createWhereItemBase(field, "=", paramName, filterItem.value, params);
                    break;
                case FilterMatchMode.NOT_EQUALS:
                    whereItem = this.createWhereItemBase(field, "<>", paramName, filterItem.value, params);
                    break;
                // case FilterMatchMode.IN:
                //     // TODO
                //     //whereItem = `${field} IN (:...${paramName})`;
                //     //params[paramName] = <value list>;
                //     break;
                case FilterMatchMode.LESS_THAN:
                    whereItem = this.createWhereItemBase(field, "<", paramName, filterItem.value, params);
                    break;
                case FilterMatchMode.LESS_THAN_OR_EQUAL_TO:
                    whereItem = this.createWhereItemBase(field, "<=", paramName, filterItem.value, params);
                    break;
                case FilterMatchMode.GREATER_THAN:
                    whereItem = this.createWhereItemBase(field, ">", paramName, filterItem.value, params);
                    break;
                case FilterMatchMode.GREATER_THAN_OR_EQUAL_TO:
                    whereItem = this.createWhereItemBase(field, ">=", paramName, filterItem.value, params);
                    break;
                // case FilterMatchMode.BETWEEN:
                //     // TODO
                //     break;
                default:
                    console.log(`FilterMatchMode "${filterItem.matchMode}" not implemented`);
            }
        }
        return whereItem;
    }

    createWhereItemBase(field: string, sqlOperator: string, paramName: string, paramValue: any, params: {}): string {
        const whereItem: string = `${field} ${sqlOperator} :${paramName}`;
        params[paramName] = paramValue;
        return whereItem;
    }

    createOrderByCondition(rootAlias : string, multiSortMeta : DataTableSortMeta[], assocMap : Map<string, string>) : OrderByCondition {
        let orderByItems : OrderByCondition = {};
        for (const sortMeta of multiSortMeta) {
            const field : string = this.getFieldFromPath(rootAlias + "." + sortMeta.field, assocMap);
            orderByItems[field] = (sortMeta.order === 1 ? "ASC" : "DESC");
        }
        return orderByItems;
    }

    // docasne sem dame findRowById, lebo pouzivame podobne joinovanie ako pri citani dat pre lazy tabulky
    // (v buducnosti mozme viac zjednotit s lazy tabulkou)
    async findRowById(findParam: FindRowByIdParam): Promise<any> {

        // TODO - optimalizacia - leftJoin-y sa mozu nahradit za join-y, ak je ManyToOne asociacia not null (join-y su rychlejsie ako leftJoin-y)

        const assocMap: Map<string, string> = new Map<string, string>();

        // TODO - krajsi nazov aliasu?
        const rootAlias: string = "t0";

        const repository = this.dataSource.getRepository(findParam.entity);

        const selectItems: string[] = this.createSelectItems(rootAlias, findParam.fields, assocMap);

        // TODO - selectovat len stlpce ktore treba - nepodarilo sa, viac v TODO.txt
        const selectQueryBuilder : SelectQueryBuilder<unknown> = repository.createQueryBuilder(rootAlias);
        for (const [field, alias] of assocMap.entries()) {
            selectQueryBuilder.leftJoinAndSelect(field, alias);
        }
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

        const assocMap: Map<string, string> = new Map<string, string>();

        // TODO - krajsi nazov aliasu?
        const rootAlias: string = "t0";

        const {where, params} = this.createWhere(rootAlias, exportParam.filters, assocMap);

        const repository = this.dataSource.getRepository(exportParam.entity);

        if (exportParam.exportType === ExportType.Csv) {
            const selectItems: string[] = this.createSelectItems(rootAlias, exportParam.fields, assocMap);
        }
        const orderByCondition: OrderByCondition = this.createOrderByCondition(rootAlias, exportParam.multiSortMeta, assocMap);

        // TODO - selectovat len stlpce ktore treba - nepodarilo sa, viac v TODO.txt
        const selectQueryBuilder: SelectQueryBuilder<unknown> = repository.createQueryBuilder(rootAlias);
        for (const [field, alias] of assocMap.entries()) {
            selectQueryBuilder.leftJoinAndSelect(field, alias);
        }
        selectQueryBuilder.where(where, params);
        selectQueryBuilder.orderBy(orderByCondition);

        return selectQueryBuilder;
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
