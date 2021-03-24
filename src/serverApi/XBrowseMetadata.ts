// the key in XBrowseMetaMap is <entity> or <entity>_<browseId> (if browseId !== undefined)
import {XBrowseMeta} from "../administration/x-browse-meta.entity";

export interface XBrowseMetaMap {
    [name: string]: XBrowseMeta;
}

/*
// zodpoveda priblizne props na XLazyDataTable
export interface XBrowseMeta {
    idXBrowseMeta?: number; // hodnota undefined (?) sa pouziva pri inserte do DB
    entity: string;
    browseId?: string;
    rows?: number;
    columnMetaList: XColumnMeta[];
}

// zodpoveda typu XLazyColumnProps
export interface XColumnMeta {
    idXColumnMeta?: number; // hodnota undefined (?) sa pouziva pri inserte do DB
    field: string;
    header?: any;
    align?: "left" | "center" | "right";
    dropdownInFilter: boolean;
    width?: string;
    columnOrder?: number;
}
*/
