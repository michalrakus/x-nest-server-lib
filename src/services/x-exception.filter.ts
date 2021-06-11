import {ExceptionFilter, Catch, ArgumentsHost, HttpStatus, HttpException} from '@nestjs/common';
import { Request, Response } from 'express';
import {QueryFailedError} from "typeorm";

@Catch(Error)
export class XExceptionFilter implements ExceptionFilter {
    catch(exception: Error, host: ArgumentsHost) {
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
        else {
            // default (toto by mohlo ist aj v produkcii pre vsetky pripady)
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            responseBody = {
                statusCode: status,
                message: exception.message,
                exceptionName: exception.name
            };
        }

        response
            .status(status)
            .json(responseBody);
    }
}