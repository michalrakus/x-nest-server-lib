import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {passportJwtSecret} from "jwks-rsa";
import {XEnvVar} from "../services/XEnvVars";
import {XUtils} from "../services/XUtils";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        // for X_AUTH=AUTH0
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

    validate(payload: unknown): unknown {
        //console.log("JwtStrategy.validate payload = " + JSON.stringify(payload));
        return payload;
    }
}
