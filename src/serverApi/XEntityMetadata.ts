export interface XEntityMap {
    [name: string]: XEntity;
}

export interface XEntity {
    name: string;
    idField: string;
    fieldMap: XFieldMap;
    assocMap: XAssocMap;
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
    width?: number;
}

// copy of RelationMetadata.RelationType
export type XRelationType = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

export interface XAssoc {
    relationType: XRelationType;
    name: string;
    entityName: string; // entita na druhej strane asociacie
    inverseAssocName?: string; // opacna asociacia
    isCascadeInsert: boolean;
    isCascadeUpdate: boolean;
    isCascadeRemove: boolean;
    isNullable: boolean; // pouzivane (zatial) len pre *ToOne asociacie
}
