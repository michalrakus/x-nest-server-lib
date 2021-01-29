export interface XEntityMap {
    [name: string]: XEntity;
}

export interface XEntity {
    name: string;
    idField: string;
    fieldMap: XFieldMap;
    assocToOneMap: XAssocMap;
    assocToManyMap: XAssocMap;
}

export interface XFieldMap {
    [name: string]: XField;
}

export interface XAssocMap {
    [name: string]: XAssoc;
}

export interface XField {
    name: string;
    type: string;
    isNullable: boolean;
    length?: number;
    precision?: number;
    scale?: number;
}

export interface XAssoc {
    name: string;
    entityName: string; // entita na druhej strane asociacie
    inverseAssocName?: string; // opacna asociacia
}
