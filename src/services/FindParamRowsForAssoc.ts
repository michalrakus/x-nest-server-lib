// deprecated - mal by sa pouzivat findParamRows
export interface FindParamRowsForAssoc {
    entity: string;
    assocField: string;
    displayField: string; // moze byt null, vtedy sa nepouziva
    filter: String; // moze byt null, vtedy sa nepouziva (pouziva sa vzdy spolu s displayField)
    // TODO - pre optimalizaciu pridat displayField a citat len id + displayField?
}
