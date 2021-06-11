import {SortMeta} from "../serverApi/FindParam";

export interface FindParamRows {
    entity: string;
    displayField?: string; // moze byt undefined, vtedy sa nepouziva
    filter?: String; // moze byt undefined, vtedy sa nepouziva (pouziva sa vzdy spolu s displayField)
    sortMeta?: SortMeta; // zatial len taketo jednoduche sortovanie (moze byt undefined)
}
