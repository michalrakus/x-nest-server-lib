import { Injectable } from '@nestjs/common';
import {FindResult} from "../serverApi/FindResult";
import {getRepository, OrderByCondition, SelectQueryBuilder} from "typeorm";
import {Filters, FindParam, SortMeta} from "../serverApi/FindParam";
import {FindRowByIdParam} from "./FindRowByIdParam";

@Injectable()
export class LazyDataTableService {

    async findRows(findParam : FindParam): Promise<FindResult> {
        console.log("LazyDataTableService.findRows findParam = " + JSON.stringify(findParam));

        // TODO - optimalizacia - leftJoin-y sa mozu nahradit za join-y, ak je ManyToOne asociacia not null (join-y su rychlejsie ako leftJoin-y)

        const assocMap: Map<string, string> = new Map<string, string>();

        // TODO - krajsi nazov aliasu?
        const rootAlias: string = "t0";

        const {where, params} = this.createWhere(rootAlias, findParam.filters, assocMap);

        const repository = getRepository(findParam.entity);

        let selectQueryBuilder : SelectQueryBuilder<unknown> = repository.createQueryBuilder(rootAlias);
        selectQueryBuilder.select("COUNT(1)", "count");
        for (const [field, alias] of assocMap.entries()) {
            selectQueryBuilder.leftJoin(field, alias);
        }
        selectQueryBuilder.where(where, params);

        const { count } = await selectQueryBuilder.getRawOne();

        console.log("Pokus1Service.readLazyDataTable count = " + count);

        const selectItems: string[] = this.createSelectItems(rootAlias, findParam.fields, assocMap);
        const orderByCondition : OrderByCondition = this.createOrderByCondition(rootAlias, findParam.multiSortMeta, assocMap);

        // TODO - selectovat len stlpce ktore treba - nepodarilo sa, viac v TODO.txt
        selectQueryBuilder = repository.createQueryBuilder(rootAlias);
        for (const [field, alias] of assocMap.entries()) {
            selectQueryBuilder.leftJoinAndSelect(field, alias);
        }
        selectQueryBuilder.where(where, params);
        selectQueryBuilder.orderBy(orderByCondition);
        selectQueryBuilder.skip(findParam.first);
        selectQueryBuilder.take(findParam.rows);

        const rowList: any[] = await selectQueryBuilder.getMany();

        const findResult: FindResult = {rowList: rowList, totalRecords: count};
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

    createWhere(rootAlias : string, filters : Filters, assocMap : Map<string, string>) : {where: string; params: {};} {
        let where : string = "";
        let params : {} = {};
        for (const [key, value] of Object.entries(filters)) {
            if (where !== "") {
                where += " AND ";
            }
            const field : string = this.getFieldFromPath(rootAlias + "." + key, assocMap);
            // TODO - pouzit paramName :1, :2, :3, ... ?
            const paramName = field; // TODO - moze paramName obsahovat "."
            if (value.matchMode === "startsWith") {
                where += `${field} LIKE :${paramName}`;
                params[paramName] = value.value + "%";
            }
            else if (value.matchMode === "equals") {
                where += `${field} = :${paramName}`;
                params[paramName] = value.value;
            }
        }
        return {where: where, params: params};
    }

    createOrderByCondition(rootAlias : string, multiSortMeta : SortMeta[], assocMap : Map<string, string>) : OrderByCondition {
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

        const repository = getRepository(findParam.entity);

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
}
