import {DataTableFilterMetaData, DataTableOperatorFilterMetaData, DataTableSortMeta} from "./PrimeFilterSortMeta";

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

// XCustomFilter is used usually in frontend, to the backend is always sent the array XCustomFilterItem[], because we want it the same way like other attributes
// but it is used sometimes also in backend, for example in statistical module
export type XCustomFilter = XCustomFilterItem | XCustomFilterItem[];

// additional match modes (extension to primereact enum FilterMatchMode)
export enum XFilterMatchMode {
    X_AUTO_COMPLETE = 'xAutoComplete'
}

// in some special cases (e.g. match mode xAutoComplete) we use separated sql condition that is different from standard filter item (field, match mode, value)
// filter item is needed for UI, but for for DB we use sometimes another (field, match mode, value) and for easier life we use the whole sql condition created on frontend
export interface XDataTableFilterMetaData extends DataTableFilterMetaData {
    customFilterItems?: XCustomFilterItem[];
}

// x version of primereact's DataTableFilterMeta
export interface XDataTableFilterMeta {
    /**
     * Extra options.
     */
    [key: string]: XDataTableFilterMetaData | DataTableOperatorFilterMetaData;
}

export interface XFullTextSearch {
    fields?: string[]; // stlpce na ktorych sa vykona search, ak undefined, tak sa pouziju FindParam.fields
    value: string; // hodnoty oddelene space-om, rozdelia sa a budu vo where podmienke pouzite cez AND (ak nie je splitValue = false)
    splitValue: boolean; // ci rozdelit "value" by space (default true)
    matchMode: 'startsWith' | 'contains' | 'endsWith' | 'equals'; // zatial tieto (podmnozina z DataTableFilterMetaData), default bude 'contains'
}

export enum XAggregateFunction {
    Min = "MIN",
    Max = "MAX",
    Sum = "SUM",
    Avg = "AVG"
}

// aggregate items used for lazy tables, for group by queries there is more complex XAggregateItem
export interface XSimpleAggregateItem {
    field: string;
    aggregateFunction: XAggregateFunction;
}

export interface FindParam {
    resultType: ResultType;
    first?: number;
    rows?: number; // page size
    filters?: XDataTableFilterMeta;
    fullTextSearch?: XFullTextSearch;
    customFilterItems?: XCustomFilterItem[];
    multiSortMeta?: DataTableSortMeta[]; // typ []
    entity: string;
    fields?: string[];
    aggregateItems?: XSimpleAggregateItem[];
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
