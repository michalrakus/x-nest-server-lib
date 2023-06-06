export interface XAggregateValues {
    [key: string]: any;
}

export interface FindResult {
    rowList?: any[];
    totalRecords?: number;
    aggregateValues?: XAggregateValues;
}
