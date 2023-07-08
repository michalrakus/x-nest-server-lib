// pomocna struktura - ukladame si sem id-cka zaznamov ktore neskor vymazeme
// poradie id-ciek je dolezite aby nam mazanie zaznamov nepadlo na fk-constraintoch
// hromadime id-cka s rovnakou entity, pre 1 item XEntityRowIdList bude vygenerovany 1 DELETE FROM
// nie je to dokonala optimalizacia ale na vecsinu pripadov nam staci...

export interface XEntityRowIdList {
    entity: string;
    rowIdList: Array<any>;
}

export class XRowIdListToRemove {

    entityRowIdListList: Array<XEntityRowIdList>;

    constructor() {
        this.entityRowIdListList = new Array<XEntityRowIdList>();
    }

    addRowId(entity: string, rowId: any) {
        if (this.entityRowIdListList.length > 0) {
            const lastItem: XEntityRowIdList = this.entityRowIdListList[this.entityRowIdListList.length - 1];
            if (entity === lastItem.entity) {
                lastItem.rowIdList.push(rowId);
            }
            else {
                // zmenila sa entita, vytvorime novy zaznam
                this.addNewEntityItem(entity, rowId);
            }
        }
        else {
            this.addNewEntityItem(entity, rowId);
        }
    }

    private addNewEntityItem(entity: string, rowId: any) {
        const newEntityItem: XEntityRowIdList = {entity: entity, rowIdList: new Array<any>()};
        newEntityItem.rowIdList.push(rowId);
        this.entityRowIdListList.push(newEntityItem);
    }
}
