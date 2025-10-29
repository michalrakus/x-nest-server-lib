import {XUser} from "./XUser";

// misc api used in lib

export interface XGetSequenceValueRequest {
    name: string;
}

export interface XGetSequenceValueResponse {
    value: number;
}

export interface XtRunDocTemplateRequest {
    xtDocTemplateId: number;
    rowId: number; // id of the row in DB that is going to be used for creating document from template
    xUser?: XUser; // current user
}

// TODO - move to the right place
export interface XFindRowByIdRequest {
    entity: string;
    fields: string[];
    id: number;
    lockDate?: Date; // if defined, pessimistic locking is used (and lockXUser is also defined)
    lockXUser?: XUser;
    overwriteLock?: boolean; // if true, then existing (old) lock will be overwritten by this new one
}

export interface XFindRowByIdResponse {
    row: any;
    lockAcquired?: boolean; // true if the lock was acquired (row was not locked), false if the row was already locked (info about lock is in "row"), used only by pessimistic locking
}

export interface XUnlockRowRequest {
    entity: string;
    id: number;
    lockDate: Date; // unlock only if the same lockDate/lockXUser found (newer lockDate stays)
    lockXUser: XUser;
}
