import {ExceptionFilter, Catch, ArgumentsHost, HttpStatus, HttpException} from '@nestjs/common';
import { Request, Response } from 'express';
import {QueryFailedError} from "typeorm";
import {XAppError} from "./XAppError";

@Catch()
export class XExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {

        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status;
        let responseBody;
        if (exception instanceof HttpException) {
            // default nest exception
            status = exception.getStatus();
            responseBody = {
                statusCode: status,
                message: exception.message,
                exceptionName: exception.name
            };
        }
        else if (exception instanceof QueryFailedError) {
            // tuto exception hadze TypeORM ak nezbehne nejake query
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            responseBody = {
                statusCode: status,
                message: exception.message,
                exceptionName: exception.name,
                sqlMessage: (exception as any).sqlMessage,
                sql: (exception as any).sql
            };
        }
        else if (exception instanceof Error) {
            // default (toto by mohlo ist aj v produkcii pre vsetky pripady)
            // tadeto ide aj XAppError
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            responseBody = {
                statusCode: status,
                message: exception.message,
                exceptionName: exception.name
                //stacktrace: exception.stack
            };
            // XAppError netreba logovat
            if (!(exception instanceof XAppError)) {
                console.log(exception.stack);
            }
        }
        else {
            // exception typu string alebo number (throw 'nieco', resp. throw 300)
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            responseBody = {
                statusCode: status,
                message: exception,
                exceptionName: "Unknown exception (string/number)"
            };
        }

        console.log("XExceptionFilter responseBody = " + JSON.stringify(responseBody));

        response
            .status(status)
            .json(responseBody);
    }
}