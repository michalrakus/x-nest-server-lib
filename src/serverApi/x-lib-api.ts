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
