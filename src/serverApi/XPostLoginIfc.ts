// fieldy na sychronizaciu (zatial len username)
import {XUser} from "./XUser";

export interface XPostLoginRequest {
    username?: string;
}

export interface XPostLoginResponse {
    xUser?: XUser;
}
