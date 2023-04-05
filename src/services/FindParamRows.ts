import {DataTableFilterMeta, DataTableSortMeta} from "../serverApi/PrimeFilterSortMeta";

export interface FindParamRows {
    entity: string;
    displayField?: string; // moze byt undefined, vtedy sa nepouziva
    filter?: String; // moze byt undefined, vtedy sa nepouziva (pouziva sa vzdy spolu s displayField)
    filters?: DataTableFilterMeta; // standardny filter, mal by nahradit displayField + filter
    sortMeta?: DataTableSortMeta; // zatial len taketo jednoduche sortovanie (moze byt undefined)
}
