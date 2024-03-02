import {XQueryData} from "./XQueryData";
import {SelectQueryBuilder} from "typeorm";
import {XEntityMetadataService} from "../services/x-entity-metadata.service";

export class XSubQueryData extends XQueryData {

    assocToOneWhereItem: string; // condition to link subquery with main query,
    // example: "t1.assocY = t0.id", where:
    // t1 is rootAlias
    // assocY is ManyToOne inverse assoc to OneToMany assoc in xAssocSubQueryDataList (in key)
    // t0 is root alias of the main table
    // id is PK field of the main table

    // key from xAssocSubQueryDataList is used for creating left join (t0.assocXList, <rootAlias>)) in the main query selecting data (detail rows must be selected using left join)
    // assocToOneWhereItem is used to create real SQL subquery - using EXISTS in where condition in count/sum aggregate query or direct in select clause to sum field from detail row

    constructor(xEntityMetadataService: XEntityMetadataService, entity: string, rootAlias: string, assocToOneWhereItem: string) {
        super(xEntityMetadataService, entity, rootAlias);
        this.assocToOneWhereItem = assocToOneWhereItem;
    }

    isMainQueryData(): boolean {
        return false;
    }

    createQueryBuilder(selectQueryBuilder: SelectQueryBuilder<unknown>, selection: string): SelectQueryBuilder<unknown> {
        const selectSubQueryBuilder: SelectQueryBuilder<unknown> = selectQueryBuilder.subQuery();
        selectSubQueryBuilder.select(selection);
        selectSubQueryBuilder.from(this.xEntity.name, this.rootAlias);
        for (const [field, alias] of this.assocAliasMap.entries()) {
            selectSubQueryBuilder.leftJoin(field, alias);
        }
        selectSubQueryBuilder.where(this.assocToOneWhereItem);
        if (this.where !== "") {
            selectSubQueryBuilder.andWhere(this.where, this.params);
        }
        return selectSubQueryBuilder;
    }

    createQueryBuilderForFts(selectQueryBuilder: SelectQueryBuilder<unknown>, selection: string, ftsValue: string, ftsSeparator: string): SelectQueryBuilder<unknown> | undefined {
        let selectSubQueryBuilder: SelectQueryBuilder<unknown> | undefined = undefined;
        if (this.ftsFieldList.length > 0) {
            selectSubQueryBuilder = selectQueryBuilder.subQuery();
            selectSubQueryBuilder.select(selection);
            selectSubQueryBuilder.from(this.xEntity.name, this.rootAlias);
            for (const [field, alias] of this.assocAliasMap.entries()) {
                selectSubQueryBuilder.leftJoin(field, alias);
            }
            selectSubQueryBuilder.where(this.assocToOneWhereItem);
            // if (this.where !== "") {
            //     selectSubQueryBuilder.andWhere(this.where, this.params);
            // }
            selectSubQueryBuilder.andWhere(this.createFtsWhereItemForQuery(ftsValue, ftsSeparator), {});
        }
        return selectSubQueryBuilder;
    }

    createFtsWhereItemForSubQuery(mainQueryBuilderForExistsSubQueries: SelectQueryBuilder<unknown> | undefined, ftsValue: string, ftsSeparator: string): string | "" {
        let where: string | "" = "";
        if (mainQueryBuilderForExistsSubQueries) {
            // pridame podmienku EXISTS (subquery)
            const selectSubQueryBuilder: SelectQueryBuilder<unknown> = this.createQueryBuilderForFts(mainQueryBuilderForExistsSubQueries, `1`, ftsValue, ftsSeparator);
            if (selectSubQueryBuilder) {
                where = `EXISTS (${selectSubQueryBuilder.getQuery()})`;
            }
        }
        else {
            where = this.createFtsWhereItemForQuery(ftsValue, ftsSeparator);
        }
        return where;
    }
}