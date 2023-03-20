// Filter/Sort types copied from Primereact (the same types shoud be used in frontend and also in backend)

// Filter
export enum FilterMatchMode {
    STARTS_WITH = 'startsWith',
    CONTAINS = 'contains',
    NOT_CONTAINS = 'notContains',
    ENDS_WITH = 'endsWith',
    EQUALS = 'equals',
    NOT_EQUALS = 'notEquals',
    IN = 'in',
    LESS_THAN = 'lt',
    LESS_THAN_OR_EQUAL_TO = 'lte',
    GREATER_THAN = 'gt',
    GREATER_THAN_OR_EQUAL_TO = 'gte',
    BETWEEN = 'between',
    DATE_IS = 'dateIs',
    DATE_IS_NOT = 'dateIsNot',
    DATE_BEFORE = 'dateBefore',
    DATE_AFTER = 'dateAfter',
    CUSTOM = 'custom'
}

export enum FilterOperator {
    AND = 'and',
    OR = 'or'
}

export enum SortOrder {
    DESC = -1,
    UNSORTED = 0,
    ASC = 1
}

/**
 * Custom datatable sort meta
 */
export interface DataTableSortMeta {
    /**
     * Column field to sort against.
     */
    field: string;
    /**
     * Sort order as integer.
     */
    order: 1 | 0 | -1 | null | undefined;
}

/**
 * Custom datatable filter metadata.
 */
export interface DataTableFilterMetaData {
    /**
     * Value to filter against.
     */
    value: any;
    /**
     * Type of filter match.
     */
    matchMode: 'startsWith' | 'contains' | 'notContains' | 'endsWith' | 'equals' | 'notEquals' | 'in' | 'lt' | 'lte' | 'gt' | 'gte' | 'between' | 'dateIs' | 'dateIsNot' | 'dateBefore' | 'dateAfter' | 'custom' | undefined;
}

/**
 * Custom datatable operator filter metadata.
 */
export interface DataTableOperatorFilterMetaData {
    /**
     * Operator to use for filtering.
     */
    operator: string;
    /**
     * Operator to use for filtering.
     */
    constraints: DataTableFilterMetaData[];
}

/**
 * Custom datatable filter meta.
 */
export interface DataTableFilterMeta {
    /**
     * Extra options.
     */
    [key: string]: DataTableFilterMetaData | DataTableOperatorFilterMetaData;
}
