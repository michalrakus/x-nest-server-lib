export interface FilterValue {
    value : string;
    matchMode : 'startsWith' | 'equals'; // matchMode ma konstanty napr. startsWith
}

export interface Filters {
    [field: string]: FilterValue; // specialny typ pre object (dictionary) ktory ma dynamicky pocet propertiesov
}

export interface SortMeta {
    field : string;
    order : 1 | -1; // hodnoty 1 alebo -1
}

export interface FindParam {
    first : number;
    rows : number; // page size
    filters : Filters;
    multiSortMeta : SortMeta[]; // typ []
    entity: string;
    fields: string[];
}
