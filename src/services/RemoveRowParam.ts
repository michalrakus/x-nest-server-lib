// TODO - move to common (serverApi)
export interface RemoveRowParam {
    entity: string;
    id: number;
    assocsToRemove?: string[]; // list of *toOne, *toMany associations of the entity, (detail) rows on these associations will be also removed
    modifXUser?: any; // user who removes the row, written into x_audit_row when the entity is audited
}
