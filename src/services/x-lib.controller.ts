import {Body, Headers, Controller, Post, Res, HttpStatus, UseFilters, HttpException} from '@nestjs/common';
import {XLibService} from "./x-lib.service";
import {FindResult} from "../serverApi/FindResult";
import {XLazyDataTableService} from "./x-lazy-data-table.service";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XEntityMap} from "../serverApi/XEntityMetadata";
import {XUserAuthenticationRequest, XUserAuthenticationResponse} from "../serverApi/XUserAuthenticationIfc";
import {FindParam} from "../serverApi/FindParam";
import {FindParamRowsForAssoc} from "./FindParamRowsForAssoc";
import {FindRowByIdParam} from "./FindRowByIdParam";
import {SaveRowParam} from "./SaveRowParam";
import {RemoveRowParam} from "./RemoveRowParam";
import {XBrowseMetaMap} from "../serverApi/XBrowseMetadata";
import {XBrowseFormMetadataService} from "./x-browse-form-metadata.service";
import {Response} from 'express';
import {ExportParam} from "../serverApi/ExportImportParam";
import {XExceptionFilter} from "./x-exception.filter";
import {FindParamRows} from "./FindParamRows";

@Controller()
@UseFilters(XExceptionFilter)
export class XLibController {
    constructor(
        private readonly xLibService: XLibService,
        private readonly xLazyDataTableService: XLazyDataTableService,
        private readonly xEntityMetadataService: XEntityMetadataService,
        private readonly xBrowseFormMetadataService: XBrowseFormMetadataService) {}

    @Post('lazyDataTableFindRows')
    async lazyDataTableFindRows(@Body() body: FindParam, @Headers('Authorization') headerAuth: string): Promise<FindResult> {
        // musime dat await, lebo vo vnutri je tiez await (kod "za" await v xLibService.checkAuthentication by zbehol az po zbehnuti celej tejto metody, ak by tu nebol await
        await this.xLibService.checkAuthentication(headerAuth);

        const findResult: FindResult = await this.xLazyDataTableService.findRows(body);
        return findResult;
    }

    @Post('lazyDataTableExport')
    async lazyDataTableExport(@Body() body: ExportParam, @Headers('Authorization') headerAuth: string, @Res() res: Response) {
        await this.xLibService.checkAuthentication(headerAuth);

        // toto je pouzitie express-u (nizsia vrstva ako nestjs) - Response je z express-u
        // viac na https://docs.nestjs.com/controllers#getting-up-and-running
        // je potrebne menezovat response explicitne

        // response menezujeme explicitne, lebo chceme data do responsu streamovat
        // kod je spraveny podla:
        // https://medium.com/developers-arena/streams-piping-and-their-error-handling-in-nodejs-c3fd818530b6
        // netusim, ci sa tym nepreplni pamet... zostane metoda write stat ak klient neodobera data?

        // metoda export zapisuje do "res"
        await this.xLazyDataTableService.export(body, res);
    }

    // deprecated - lepsie je pouzit findRows
    @Post('findRowsForAssoc')
    async findRowsForAssoc(@Body() body: FindParamRowsForAssoc, @Headers('Authorization') headerAuth: string): Promise<any[]> {
        await this.xLibService.checkAuthentication(headerAuth);
        const rows: any[] = await this.xLibService.findRowsForAssoc(body);
        return rows;
    }

    @Post('findRows')
    async findRows(@Body() body: FindParamRows, @Headers('Authorization') headerAuth: string): Promise<any[]> {
        await this.xLibService.checkAuthentication(headerAuth);
        return await this.xLibService.findRows(body);
    }

    @Post('findRowById')
    async findRowById(@Body() body: FindRowByIdParam, @Headers('Authorization') headerAuth: string): Promise<any> {
        await this.xLibService.checkAuthentication(headerAuth);
        return await this.xLazyDataTableService.findRowById(body);
    }

    @Post('saveRow')
    async saveRow(@Body() body: SaveRowParam, @Headers('Authorization') headerAuth: string): Promise<any> {
        await this.xLibService.checkAuthentication(headerAuth);
        return await this.xLibService.saveRow(body);
    }

    @Post('removeRow')
    async removeRow(@Body() body: RemoveRowParam, @Headers('Authorization') headerAuth: string) {
//        try {
            await this.xLibService.checkAuthentication(headerAuth);
            await this.xLibService.removeRow(body);
        // }
        // catch(error) {
        //     console.log("mame chybu *************");
        //     console.log(error);
        //     console.log(JSON.stringify(error));
        //     console.log(error.toString());
        //     console.log("*************");
        //     console.log(error.sqlMessage);
        //     console.log(error.sql);
        //     //throw new HttpException('*** Forbidden ***', HttpStatus.FORBIDDEN);
        //     throw error;
        // }
    }

    @Post('userAuthentication')
    async userAuthentication(@Body() body: XUserAuthenticationRequest, @Headers('Authorization') headerAuth: string): Promise<XUserAuthenticationResponse> {
        this.xLibService.checkAuthenticationPublic(headerAuth);
        return await this.xLibService.userAuthentication(body);
    }

    @Post('userChangePassword')
    async userChangePassword(@Body() body: {username: string; passwordNew: string;}, @Headers('Authorization') headerAuth: string) {
        await this.xLibService.checkAuthentication(headerAuth);
        await this.xLibService.userChangePassword(body);
    }

    @Post('userSaveRow')
    async userSaveRow(@Body() body: SaveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.xLibService.checkAuthentication(headerAuth);
        await this.xLibService.userSaveRow(body);
    }

    @Post('getXEntityMap')
    async getXEntityMap(@Body() body: any, @Headers('Authorization') headerAuth: string): Promise<XEntityMap> {
        console.log("************************* zavolany getXEntityMap *******************************************");
        await this.xLibService.checkAuthentication(headerAuth);
        return this.xEntityMetadataService.getXEntityMap();
    }

    @Post('getXBrowseMetaMap')
    async getXBrowseMetaMap(@Body() body: any, @Headers('Authorization') headerAuth: string): Promise<XBrowseMetaMap> {
        console.log("*********************** zavolany getXBrowseMetaMap *****************************************");
        await this.xLibService.checkAuthentication(headerAuth);
        return this.xBrowseFormMetadataService.getXBrowseMetaMap();
    }
}
