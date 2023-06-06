import {XQueryData} from "./XQueryData";
import {SelectQueryBuilder} from "typeorm";

export class XSubQueryData extends XQueryData {

    entity: string;
    assocToOneWhereItem: string; // condition to link subquery with main query,
    // example: "t1.assocY = t0.id", where:
    // t1 is rootAlias
    // assocY is ManyToOne inverse assoc to OneToMany assoc in xAssocSubQueryDataList (in key)
    // t0 is root alias of the main table
    // id is PK field of the main table

    // key from xAssocSubQueryDataList is used for creating left join (t0.assocXList, <rootAlias>)) in the main query selecting data (detail rows must be selected using left join)
    // assocToOneWhereItem is used to create real SQL subquery - using EXISTS in where condition in count/sum aggregate query or direct in select clause to sum field from detail row

    constructor(entity: string, rootAlias: string, assocToOneWhereItem: string) {
        super(rootAlias);
        this.entity = entity;
        this.assocToOneWhereItem = assocToOneWhereItem;
    }

    isMainQueryData(): boolean {
        return false;
    }

    createQueryBuilder(selectQueryBuilder: SelectQueryBuilder<unknown>, selection: string): SelectQueryBuilder<unknown> {
        const selectSubQueryBuilder: SelectQueryBuilder<unknown> = selectQueryBuilder.subQuery();
        selectSubQueryBuilder.select(selection);
        selectSubQueryBuilder.from(this.entity, this.rootAlias);
        selectSubQueryBuilder.where(this.assocToOneWhereItem);
        if (this.where !== "") {
            selectSubQueryBuilder.andWhere(this.where, this.params);
        }
        return selectSubQueryBuilder;
    }
}