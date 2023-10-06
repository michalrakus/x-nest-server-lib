import {ExecutionContext, Injectable} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {Reflector} from "@nestjs/core";
import {IS_PUBLIC_KEY} from "./public";
import {Observable} from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('x-jwt-strategy') {

    constructor(private reflector: Reflector) {
        super();
    }

    // code necessary for decorator @Public
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        return super.canActivate(context);
    }
}
