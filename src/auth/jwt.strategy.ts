import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {passportJwtSecret} from "jwks-rsa";
import {XAuth, XEnvVar} from "../services/XEnvVars";
import {XUtils} from "../services/XUtils";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'x-jwt-strategy') {
    constructor() {
        if (XUtils.getEnvVarValue(XEnvVar.X_AUTH) === XAuth.AUTH0) {
            super({
                secretOrKeyProvider: passportJwtSecret({
                    cache: true,
                    rateLimit: true,
                    jwksRequestsPerMinute: 5,
                    jwksUri: `https://${XUtils.getEnvVarValue(XEnvVar.X_AUTH0_DOMAIN)}/.well-known/jwks.json`,
                }),

                jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
                audience: XUtils.getEnvVarValue(XEnvVar.X_AUTH0_AUDIENCE),
                issuer: `https://${XUtils.getEnvVarValue(XEnvVar.X_AUTH0_DOMAIN)}/`,
                algorithms: ['RS256'],
            });
        }
        else if (XUtils.getEnvVarValue(XEnvVar.X_AUTH) === XAuth.MS_ENTRA_ID) {
            super({
                secretOrKeyProvider: passportJwtSecret({
                    cache: true,
                    rateLimit: true,
                    jwksRequestsPerMinute: 5,
                    jwksUri: `https://login.microsoftonline.com/${XUtils.getEnvVarValue(XEnvVar.X_MS_ENTRA_ID_TENANT_ID)}/discovery/v2.0/keys`
                }),

                jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
                audience: XUtils.getEnvVarValue(XEnvVar.X_MS_ENTRA_ID_AUDIENCE),
                issuer: `https://login.microsoftonline.com/${XUtils.getEnvVarValue(XEnvVar.X_MS_ENTRA_ID_TENANT_ID)}/v2.0`,
                algorithms: ['RS256'],
            });
        }
        else {
            throw `JwtStrategy: authentication not implemented for X_AUTH = ${XUtils.getEnvVarValue(XEnvVar.X_AUTH)}`;
        }
    }

    validate(payload: unknown): unknown {
        //console.log("JwtStrategy.validate payload = " + JSON.stringify(payload));
        return payload;
    }
}
