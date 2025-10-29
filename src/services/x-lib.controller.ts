import {
    Body,
    Request,
    Controller,
    Post,
    Res, StreamableFile
} from '@nestjs/common';
import {XLibService} from "./x-lib.service";
import {FindResult} from "../serverApi/FindResult";
import {XLazyDataTableService} from "./x-lazy-data-table.service";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XEntityMap} from "../serverApi/XEntityMetadata";
import {FindParam, XLazyAutoCompleteSuggestionsRequest} from "../serverApi/FindParam";
import {FindParamRowsForAssoc} from "./FindParamRowsForAssoc";
import {SaveRowParam} from "./SaveRowParam";
import {RemoveRowParam} from "./RemoveRowParam";
import {XBrowseMetaMap} from "../serverApi/XBrowseMetadata";
import {XBrowseFormMetadataService} from "./x-browse-form-metadata.service";
import {Response} from 'express';
import {ExportCsvParam, ExportExcelParam, ExportJsonParam} from "../serverApi/ExportImportParam";
import {FindParamRows} from "./FindParamRows";
import {XPostLoginRequest, XPostLoginResponse} from "../serverApi/XPostLoginIfc";
import {
    XFindRowByIdRequest,
    XFindRowByIdResponse,
    XGetSequenceValueRequest,
    XGetSequenceValueResponse, XUnlockRowRequest
} from "../serverApi/x-lib-api";

@Controller()
export class XLibController {
    constructor(
        private readonly xLibService: XLibService,
        private readonly xLazyDataTableService: XLazyDataTableService,
        private readonly xEntityMetadataService: XEntityMetadataService,
        private readonly xBrowseFormMetadataService: XBrowseFormMetadataService) {}

    @Post('lazyDataTableFindRows')
    async lazyDataTableFindRows(@Body() body: FindParam): Promise<FindResult> {
        const findResult: FindResult = await this.xLazyDataTableService.findRows(body);
        return findResult;
    }

    @Post('x-lazy-data-table-export-excel')
    async lazyDataTableExportExcel(@Body() body: ExportExcelParam): Promise<StreamableFile> {
        // pri exceli zatial nepouzivame stream-y, mozno v buducnosti dorobime (lib-ka exceljs stream-y podporuje)
        return await this.xLazyDataTableService.exportExcel(body);
    }

    @Post('x-lazy-data-table-export-csv')
    async lazyDataTableExportCsv(@Body() body: ExportCsvParam, @Res() res: Response) {
        // toto je pouzitie express-u (nizsia vrstva ako nestjs) - Response je z express-u
        // viac na https://docs.nestjs.com/controllers#getting-up-and-running
        // je potrebne menezovat response explicitne

        // response menezujeme explicitne, lebo chceme data do responsu streamovat
        // kod je spraveny podla:
        // https://medium.com/developers-arena/streams-piping-and-their-error-handling-in-nodejs-c3fd818530b6
        // netusim, ci sa tym nepreplni pamet... zostane metoda write stat ak klient neodobera data?

        // metoda export zapisuje do "res"
        await this.xLazyDataTableService.exportCsv(body, res);
    }

    @Post('x-lazy-data-table-export-json')
    async lazyDataTableExportJson(@Body() body: ExportJsonParam, @Res() res: Response) {
        // podobne ako pri lazyDataTableExportCsv podporujeme stream-y
        await this.xLazyDataTableService.exportJson(body, res);
    }

    @Post('x-lazy-auto-complete-suggestions')
    lazyAutoCompleteSuggestions(@Body() body: XLazyAutoCompleteSuggestionsRequest): Promise<FindResult> {
        return this.xLazyDataTableService.lazyAutoCompleteSuggestions(body);
    }

    /**
     * @deprecated - lepsie je pouzit findRows
     */
    @Post('findRowsForAssoc')
    async findRowsForAssoc(@Body() body: FindParamRowsForAssoc): Promise<any[]> {
        const rows: any[] = await this.xLibService.findRowsForAssoc(body);
        return rows;
    }

    @Post('findRows')
    async findRows(@Body() body: FindParamRows): Promise<any[]> {
        return await this.xLibService.findRows(body);
    }

    @Post('x-find-row-by-id')
    async findRowById(@Body() body: XFindRowByIdRequest): Promise<XFindRowByIdResponse> {
        return await this.xLazyDataTableService.findRowById(body);
    }

    @Post('saveRow')
    async saveRow(@Body() body: SaveRowParam): Promise<any> {
        return await this.xLibService.saveRow(body);
    }

    @Post('x-unlock-row')
    async unlockRow(@Body() body: XUnlockRowRequest) {
        await this.xLibService.unlockRow(body);
    }

    @Post('removeRow')
    async removeRow(@Body() body: RemoveRowParam) {
//        try {
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

    // old authentication
    // @Post('userAuthentication')
    // async userAuthentication(@Body() body: XUserAuthenticationRequest): Promise<XUserAuthenticationResponse> {
    //     return await this.xLibService.userAuthentication(body);
    // }

    // old authentication - change password
    // @Post('userChangePassword')
    // async userChangePassword(@Body() body: {username: string; passwordNew: string;}) {
    //     await this.xLibService.userChangePassword(body);
    // }

    @Post('post-login')
    async postLogin(@Request() req, @Body() xPostLoginRequest: XPostLoginRequest): Promise<XPostLoginResponse> {
        return await this.xLibService.postLogin(req.user, xPostLoginRequest);
    }

    @Post('userSaveRow')
    async userSaveRow(@Body() body: SaveRowParam) {
        await this.xLibService.userSaveRow(body);
    }

    // helper functions - maybe better XUtilsController

    @Post('x-get-sequence-value')
    async getSequenceValue(@Body() xGetSequenceValueRequest: XGetSequenceValueRequest): Promise<XGetSequenceValueResponse> {
        return {value: await this.xLibService.getSequenceValue(xGetSequenceValueRequest.name)};
    }

    @Post('x-get-param-value')
    async getParamValue(@Body() request: {code: string;}): Promise<{value: string;}> {
        return {value: await this.xLibService.getParamValue(request.code)};
    }

    @Post('getXEntityMap')
    async getXEntityMap(@Body() body: any): Promise<XEntityMap> {
        console.log("************************* zavolany getXEntityMap *******************************************");
        return this.xEntityMetadataService.getXEntityMap();
    }

    @Post('getXBrowseMetaMap')
    async getXBrowseMetaMap(@Body() body: any): Promise<XBrowseMetaMap> {
        console.log("*********************** zavolany getXBrowseMetaMap *****************************************");
        return this.xBrowseFormMetadataService.getXBrowseMetaMap();
    }
}
