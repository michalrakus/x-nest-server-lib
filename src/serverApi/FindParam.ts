import {DataTableFilterMeta, DataTableSortMeta} from "./PrimeFilterSortMeta";

// TODO - replaced with DataTableFilterMetaData
// export interface FilterValue {
//     value : string;
//     matchMode : 'startsWith' | 'equals'; // matchMode ma konstanty napr. startsWith
// }

// TODO - replaced with DataTableFilterMeta
// export interface Filters {
//     [field: string]: FilterValue; // specialny typ pre object (dictionary) ktory ma dynamicky pocet propertiesov
// }

// TODO - replace with DataTableSortMeta
// export interface SortMeta {
//     field : string;
//     order : 1 | -1; // hodnoty 1 alebo -1
// }

export enum ResultType {
    OnlyRowCount,
    OnlyPagedRows,
    RowCountAndPagedRows,
    AllRows
}

export interface XParams {
    [key: string]: any;
}

export interface XCustomFilterItem {
    where: string;
    params: XParams;
}

// XCustomFilter is used only in frontend, to the backend is always sent the array XCustomFilterItem[], because we want it the same way like other attributes
export type XCustomFilter = XCustomFilterItem | XCustomFilterItem[];

export interface XFullTextSearch {
    fields?: string[]; // stlpce na ktorych sa vykona search, ak undefined, tak sa pouziju FindParam.fields
    value: string; // hodnoty oddelene space-om, rozdelia sa a budu vo where podmienke pouzite cez AND (ak nie je splitValue = false)
    splitValue: boolean; // ci rozdelit "value" by space (default true)
    matchMode: 'startsWith' | 'contains' | 'endsWith' | 'equals'; // zatial tieto (podmnozina z DataTableFilterMetaData), default bude 'contains'
}

export enum XAggregateType {
    Min = "MIN",
    Max = "MAX",
    Sum = "SUM",
    Avg = "AVG"
}

export interface XAggregateItem {
    field: string;
    aggregateType: XAggregateType;
}

export interface FindParam {
    resultType: ResultType;
    first?: number;
    rows?: number; // page size
    filters?: DataTableFilterMeta;
    fullTextSearch?: XFullTextSearch;
    customFilterItems?: XCustomFilterItem[];
    multiSortMeta?: DataTableSortMeta[]; // typ []
    entity: string;
    fields?: string[];
    aggregateItems?: XAggregateItem[];
}

// TODO - idealne spravit x-query-api.ts a tam supnut vsetky Request/Response typy ktore vytvaraju joiny, where podmienky (FindParam.ts, FindResult.ts, ...)
// taky jednoduchsi FindParam
export interface XLazyAutoCompleteSuggestionsRequest {
    maxRows: number;
    fullTextSearch?: XFullTextSearch;
    entity: string;
    filterItems?: XCustomFilterItem[];
    multiSortMeta?: DataTableSortMeta[]; // typ []
    fields?: string[];
}
