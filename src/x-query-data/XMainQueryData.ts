import {XQueryData} from "./XQueryData";
import {XEntityMetadataService} from "../services/x-entity-metadata.service";
import {OrderByCondition, SelectQueryBuilder} from "typeorm";
import {XSubQueryData} from "./XSubQueryData";
import {DataTableFilterMeta, DataTableSortMeta} from "../serverApi/PrimeFilterSortMeta";
import {
    XCustomFilterItem,
    XDataTableFilterMeta,
    XDataTableFilterMetaData,
    XFullTextSearch
} from "../serverApi/FindParam";
import {XAssoc, XEntity} from "../serverApi/XEntityMetadata";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";

export class XMainQueryData extends XQueryData {

    // key in this map is main table alias with OneToMany assoc that creates this XSubQueryData, e.g. "t0.assocXList"
    assocXSubQueryDataMap: Map<string, XSubQueryData>;
    selectItems: string[]; // not used now
    fullTextSearch: XFullTextSearch | undefined;
    orderByItems: OrderByCondition;

    constructor(xEntityMetadataService: XEntityMetadataService, entity: string, rootAlias: string, filters: DataTableFilterMeta | undefined, fullTextSearch: XFullTextSearch | undefined, customFilterItems: XCustomFilterItem[] | undefined) {
        super(xEntityMetadataService, entity, rootAlias);
        this.assocXSubQueryDataMap = new Map<string, XSubQueryData>();
        this.selectItems = [];
        this.fullTextSearch = fullTextSearch;
        this.orderByItems = {};

        //console.log("filters = " + JSON.stringify(filters));
        //console.log("customFilterItems = " + JSON.stringify(customFilterItems));
        this.addFilters(filters);
        this.processFullTextSearch();
        this.addCustomFilterItems(customFilterItems);
    }

    isMainQueryData(): boolean {
        return true;
    }

    // ******************* methods for creating data in member variables  ********************

    addFilters(filters: XDataTableFilterMeta | undefined) {
        if (filters) {
            for (const [filterField, filterValue] of Object.entries(filters)) {
                // test this.isFilterValueNotNull je tu hlavne na to aby sa nevytvarali zbytocne join-y pri SELECT COUNT(1)
                if (this.isFilterValueNotNull(filterValue)) {
                    if (!('operator' in filterValue) && (filterValue as XDataTableFilterMetaData).customFilterItems) {
                        // for simple condition, if there is customFilterItems (used when autocomplete is used), we use customFilterItems
                        this.addCustomFilterItems((filterValue as XDataTableFilterMetaData).customFilterItems);
                    }
                    else {
                        const [xQueryData, filterFieldNew]: [XQueryData, string] = this.getQueryForPathField(filterField);
                        xQueryData.addFilterField(filterFieldNew, filterValue);
                    }
                }
            }
        }
    }

    processFullTextSearch() {
        if (this.fullTextSearch) {
            const fields: string[] = this.fullTextSearch.fields;
            if (fields) {
                for (const field of fields) {
                    const [prefix, fieldOnly]: [string | null, string] = XUtilsCommon.getPrefixAndField(field);
                    const [xQueryData, filterFieldNew]: [XQueryData, string] = this.getQueryForPathField(fieldOnly);
                    xQueryData.addFtsField(prefix, filterFieldNew);
                }
            }
        }
    }

    addCustomFilterItems(customFilterItems: XCustomFilterItem[] | undefined) {
        if (customFilterItems) {
            // kedze fieldy v custom filtri mozu patrit do rozlicnych queries (mozu byt pouzite OneToMany asociacie),
            // mame tu specialnu podporu pre custom filtre zlozene z viacerych items
            // musi byt splnena podmienka, ze vsetky fieldy v danom item patria do jednej query
            // (vsetky fieldy su z main query (ziadna OneToMany asociacia) alebo vsetky fieldy pouzivaju tu istu OneToMany asociaciu)
            for (const customFilterItem of customFilterItems) {
                this.addCustomFilterItem(customFilterItem);
            }
        }
    }

    addSelectItems(fields: string[] | undefined) {
        // TODO - ked sa budu this.selectFields pouzivat, treba nacitat defaultny zoznam "fields" z entity
        // this.selectFields sa sice momentalne nepouzivaju ale dolezite je ze sa joinuju pripadne asociovane tabulky (plni sa this.assocAliasMap)
        if (fields) {
            for (const field of fields) {
                const [xQueryData, fieldNew]: [XQueryData, string] = this.getQueryForPathField(field);
                const dbField: string = xQueryData.getFieldFromPathField(fieldNew);
                // path "<asociacia>.*FAKE*" sa pouziva ak chceme nacitat asociaciu a nemame konkretny field ktory chceme nacitat
                // momentalne sa pouziva len v XToOneAssocButton
                if (!dbField.endsWith('*FAKE*')) {
                    // poznamka2: je v poriadku ze do XMainQueryData.selectItems zapisujeme aj pripadne fieldy zo subquery
                    // - subquery sa joinuje k hlavnemu select-u, vezba fieldu na prislusnu tabulku je vyriesena cez alias
                    this.selectItems.push(dbField);
                }
            }
        }
    }

    addOrderByItems(multiSortMeta: DataTableSortMeta[] | undefined) {
        if (multiSortMeta) {
            for (const sortMeta of multiSortMeta) {
                const [xQueryData, fieldNew]: [XQueryData, string] = this.getQueryForPathField(sortMeta.field);
                const dbField: string = xQueryData.getFieldFromPathField(fieldNew);
                // tuto je velmi zvlastne ze sa dbField zapisuje do map-u ale funguje to zevraj na takom principe ze javascript
                // si pamata poradie zapisu do this.orderByItems a v tom istom poradi tento map aj iteruje pri pouziti this.orderByItems
                // poznamka2: je v poriadku ze do XMainQueryData.orderByItems zapisujeme aj pripadne fieldy zo subquery
                // - subquery sa joinuje k hlavnemu select-u, vezba fieldu na prislusnu tabulku je vyriesena cez alias
                this.orderByItems[dbField] = (sortMeta.order === 1 ? "ASC" : "DESC");
            }
        }
    }

    private addCustomFilterItem(xCustomFilterItem: XCustomFilterItem) {
        const [sqlExpWithAliases, xQueryData] = this.replacePathFieldQueryData(xCustomFilterItem.where);
        xQueryData.addWhereItem(sqlExpWithAliases);
        xQueryData.addParams(xCustomFilterItem.params);
    }

    replacePathFieldQueryData(sqlExpParam: string): [string, XQueryData] {
        // example of sql expression (e.g. where condition or subselect):
        // ([assocField1.field2] BETWEEN :value1 AND :value2) AND ([field3] IN (:...values3))
        // fields in [] will be replaced with <table alias>.<column>
        let sqlExp: string = sqlExpParam;
        let match: string;
        let xQueryDataForItem: XQueryData | null = null;
        while ((match = XUtilsCommon.findFirstMatch(/\[[a-zA-Z0-9_.]+\]/, sqlExp)) != null) {
            const filterField: string = match.substring(1, match.length - 1); // remove []
            const [xQueryData, filterFieldNew]: [XQueryData, string] = this.getQueryForPathField(filterField);
            if (xQueryDataForItem === null) {
                xQueryDataForItem = xQueryData;
            } else if (xQueryData !== xQueryDataForItem) {
                throw `Custom filter (or custom filter item) "${sqlExpParam}" must use the same query for all fields (all fields must use the same OneToMany assoc or OneToMany assoc cannot be used). Please divide your custom filter into more custom filters in form of array [filter1, filter2, ...].`;
            }
            const dbField: string = xQueryDataForItem.getFieldFromPathField(filterFieldNew);
            sqlExp = sqlExp.replaceAll(match, dbField);
        }
        if (xQueryDataForItem === null) {
            throw `Custom filter (or custom filter item) "${sqlExpParam}" - no field was found. Example of custom filter: [fieldX] = :valueX`;
        }
        return [sqlExp, xQueryDataForItem];
    }

    // api function
    getDBFieldForPathField(pathField: string): string {
        const [xQueryData, fieldNew]: [XQueryData, string] = this.getQueryForPathField(pathField);
        return xQueryData.getFieldFromPathField(fieldNew);
    }

    // api function
    replacePathField(pathFieldOrPathFieldExp: string): string {
        // simple version returning only string (can be used as api function for application code)
        // works for single path field as well as for expression with path fields (e.g. [assocA.attrB] = 'abc')
        let sqlExp: string;
        if (XUtilsCommon.isPathField(pathFieldOrPathFieldExp)) {
            sqlExp = this.getDBFieldForPathField(pathFieldOrPathFieldExp);
        }
        else {
            const [sqlExpWithAliases, xQueryData] = this.replacePathFieldQueryData(pathFieldOrPathFieldExp);
            sqlExp = sqlExpWithAliases;
        }
        return sqlExp;
    }

    getQueryForPathField(pathField: string): [XQueryData, string] {
        // ak mame OneToMany asociaciu, vytvorime/pouzijeme subquery
        const [field, restPath]: [string, string | null] = XUtilsCommon.getFieldAndRestPath(pathField);
        if (restPath !== null) {
            const xAssoc: XAssoc = this.xEntityMetadataService.getXAssoc(this.xEntity, field);
            if (xAssoc.relationType === "one-to-many") {
                const xSubQueryData: XSubQueryData = this.getXSubQueryData(xAssoc);
                //console.log("created subquery for pathField = " + pathField);
                return [xSubQueryData, restPath];
            }
        }
        return [this, pathField];
    }

    getXSubQueryData(xAssocOneToMany: XAssoc): XSubQueryData {
        const aliasAssocOneToMany: string = `${this.rootAlias}.${xAssocOneToMany.name}`;
        let xSubQueryData: XSubQueryData = this.assocXSubQueryDataMap.get(aliasAssocOneToMany);
        if (xSubQueryData === undefined) {
            const aliasSubQuery: string = "ts" + (this.assocXSubQueryDataMap.size + 1).toString();
            const assocToOneWhereItem: string = `${aliasSubQuery}.${xAssocOneToMany.inverseAssocName} = ${this.rootAlias}.${this.xEntity.idField}`;
            xSubQueryData = new XSubQueryData(this.xEntityMetadataService, xAssocOneToMany.entityName, aliasSubQuery, assocToOneWhereItem);
            this.assocXSubQueryDataMap.set(aliasAssocOneToMany, xSubQueryData);
        }
        return xSubQueryData;
    }

    // ******************* methods for processing created data - creating where items, creating SelectQueryBuilder ********************

    /**
     * @param mainQueryBuilderForExistsSubQueries - if not undefined, method creates EXISTS where items for subqueries (used for COUNT/SUM/... selects)
     */
    createFtsWhereItem(mainQueryBuilderForExistsSubQueries: SelectQueryBuilder<unknown> | undefined): string | "" {

        let ftsWhere: string | "" = "";
        if (this.fullTextSearch) {
            const ftsValueFromParam: string = this.fullTextSearch.value;
            let ftsValueList: string[];
            let ftsSeparator: string;
            if (this.fullTextSearch.splitValue) {
                if (ftsValueFromParam.trim() === '') {
                    ftsValueList = [ftsValueFromParam]; // podporujeme aj hladanie napr. troch medzier '   ' - chceme to?
                }
                else {
                    ftsValueList = ftsValueFromParam.split(' ').filter((value: string) => value !== ''); // nechceme pripadne prazdne retazce ''
                }
                ftsSeparator = XQueryData.xFtsSeparator; // separator | - hlavne koli pripadnym startsWith, startsEnd, equals operatorom
            }
            else {
                ftsValueList = [ftsValueFromParam]; // no split by space
                ftsSeparator = " "; // ak by sme medzi stlpcami nepouzili space, tak by pri zadani dvoch a viac hodnot netrafilo hodnotu vytvorenu z dvoch (a viac) stlpcov
            }
            for (const ftsValue of ftsValueList) {
                // vezmeme podmienku z main query
                let ftsWhereForValue: string | "" = this.createFtsWhereItemForQuery(ftsValue, ftsSeparator);
                // vezmeme podmienky zo subqueries
                for (const [assocOneToMany, xSubQueryData] of this.assocXSubQueryDataMap.entries()) {
                    ftsWhereForValue = XQueryData.whereItemOr(ftsWhereForValue, xSubQueryData.createFtsWhereItemForSubQuery(mainQueryBuilderForExistsSubQueries, ftsValue, ftsSeparator));
                }
                if (ftsWhereForValue !== "") {
                    ftsWhereForValue = `(${ftsWhereForValue})`; // pripadne OR-y uzatvorkujeme
                }
                ftsWhere = XQueryData.whereItemAnd(ftsWhere, ftsWhereForValue);
            }
        }
        return ftsWhere;
    }
}