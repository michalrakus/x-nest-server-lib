import {XQueryData} from "./XQueryData";
import {XEntityMetadataService} from "../services/x-entity-metadata.service";
import {OrderByCondition} from "typeorm";
import {XSubQueryData} from "./XSubQueryData";
import {DataTableFilterMeta, DataTableSortMeta} from "../serverApi/PrimeFilterSortMeta";
import {XCustomFilterItem} from "../serverApi/FindParam";
import {XAssoc, XEntity} from "../serverApi/XEntityMetadata";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";

export class XMainQueryData extends XQueryData {

    // helper members
    xEntityMetadataService: XEntityMetadataService;
    xEntity: XEntity;

    // key in this map is main table alias with OneToMany assoc that creates this XSubQueryData, e.g. "t0.assocXList"
    assocXSubQueryDataMap: Map<string, XSubQueryData>;
    selectItems: string[]; // not used now
    orderByItems: OrderByCondition;

    constructor(xEntityMetadataService: XEntityMetadataService, entity: string, rootAlias: string, filters: DataTableFilterMeta | undefined, customFilterItems: XCustomFilterItem[] | undefined) {
        super(rootAlias);
        this.xEntityMetadataService = xEntityMetadataService;
        this.xEntity = this.xEntityMetadataService.getXEntity(entity);
        this.assocXSubQueryDataMap = new Map<string, XSubQueryData>();
        this.selectItems = [];
        this.orderByItems = {};

        //console.log("filters = " + JSON.stringify(filters));
        //console.log("customFilterItems = " + JSON.stringify(customFilterItems));
        this.addFilters(filters);
        this.addCustomFilterItems(customFilterItems);
    }

    isMainQueryData(): boolean {
        return true;
    }

    addFilters(filters: DataTableFilterMeta | undefined) {
        if (filters) {
            for (const [filterField, filterValue] of Object.entries(filters)) {
                // test this.isFilterValueNotNull je tu hlavne na to aby sa nevytvarali zbytocne join-y pri SELECT COUNT(1)
                if (this.isFilterValueNotNull(filterValue)) {
                    const [xQueryData, filterFieldNew]: [XQueryData, string] = this.getQueryForPathField(filterField);
                    xQueryData.addFilterField(filterFieldNew, filterValue);
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
        // example of xCustomFilterItem.filter: ([assocField1.field2] BETWEEN :value1 AND :value2) AND ([field3] IN (:...values3))
        // fields in [] will be replaced with <table alias>.<column>
        let where: string = xCustomFilterItem.where;
        let match: string;
        let xQueryDataForItem: XQueryData | null = null;
        while ((match = XUtilsCommon.findFirstMatch(/\[[a-zA-Z0-9_.]+\]/, where)) != null) {
            const filterField: string = match.substring(1, match.length - 1); // remove []
            const [xQueryData, filterFieldNew]: [XQueryData, string] = this.getQueryForPathField(filterField);
            if (xQueryDataForItem === null) {
                xQueryDataForItem = xQueryData;
            } else if (xQueryData !== xQueryDataForItem) {
                throw `Custom filter (or custom filter item) "${xCustomFilterItem.where}" must use the same query for all fields (all fields must use the same OneToMany assoc or OneToMany assoc cannot be used). Please divide your custom filter into more custom filters in form of array [filter1, filter2, ...].`;
            }
            const dbField: string = xQueryDataForItem.getFieldFromPathField(filterFieldNew);
            where = where.replaceAll(match, dbField);
        }
        if (xQueryDataForItem === null) {
            throw `Custom filter (or custom filter item) "${xCustomFilterItem.where}" - no field was found. Example of custom filter: [fieldX] = :valueX`;
        }
        xQueryDataForItem.addWhereItem(where);
        xQueryDataForItem.addParams(xCustomFilterItem.params);
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
            xSubQueryData = new XSubQueryData(xAssocOneToMany.entityName, aliasSubQuery, assocToOneWhereItem);
            this.assocXSubQueryDataMap.set(aliasAssocOneToMany, xSubQueryData);
        }
        return xSubQueryData;
    }
}