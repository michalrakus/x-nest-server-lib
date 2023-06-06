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
    RowCountAndPagedRows,
    AllRows
}

export interface XCustomFilterValues {
    [key: string]: any;
}

export interface XCustomFilter {
    filter: string;
    values: XCustomFilterValues;
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
    customFilter?: XCustomFilter;
    multiSortMeta?: DataTableSortMeta[]; // typ []
    entity: string;
    fields?: string[];
    aggregateItems?: XAggregateItem[];
}
