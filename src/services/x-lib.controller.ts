import {Body, Headers, Controller, Post} from '@nestjs/common';
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

@Controller()
export class XLibController {
    constructor(
        private readonly xLibService: XLibService,
        private readonly xLazyDataTableService: XLazyDataTableService,
        private readonly xEntityMetadataService: XEntityMetadataService) {}

    @Post('lazyDataTableFindRows')
    async lazyDataTableFindRows(@Body() body: FindParam, @Headers('Authorization') headerAuth: string): Promise<FindResult> {
        // musime dat await, lebo vo vnutri je tiez await (kod "za" await v xLibService.checkAuthentication by zbehol az po zbehnuti celej tejto metody, ak by tu nebol await
        await this.xLibService.checkAuthentication(headerAuth);

        const findResult: FindResult = await this.xLazyDataTableService.findRows(body);
        const response: Promise<FindResult> = Promise.resolve(findResult);
        return response;
    }

    @Post('findRowsForAssoc')
    async findRowsForAssoc(@Body() body: FindParamRowsForAssoc, @Headers('Authorization') headerAuth: string): Promise<any[]> {
        await this.xLibService.checkAuthentication(headerAuth);
        const rows: any[] = await this.xLibService.findRowsForAssoc(body);
        return rows;
    }

    // @Post('getAssocName')
    // getAssocName(@Body() body: GetAssocNameParam): Promise<any> {
    //     return this.xLibService.getAssocName(body);
    // }

    @Post('findRowById')
    async findRowById(@Body() body: FindRowByIdParam, @Headers('Authorization') headerAuth: string): Promise<any> {
        await this.xLibService.checkAuthentication(headerAuth);
        return this.xLazyDataTableService.findRowById(body);
    }

    @Post('addRow')
    async addRow(@Body() body: SaveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.xLibService.checkAuthentication(headerAuth);
        this.xLibService.addRow(body);
    }

    @Post('saveRow')
    async saveRow(@Body() body: SaveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.xLibService.checkAuthentication(headerAuth);
        this.xLibService.saveRow(body);
    }

    @Post('removeRow')
    async removeRow(@Body() body: RemoveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.xLibService.checkAuthentication(headerAuth);
        this.xLibService.removeRow(body);
    }

    @Post('userAuthentication')
    userAuthentication(@Body() body: XUserAuthenticationRequest, @Headers('Authorization') headerAuth: string): Promise<XUserAuthenticationResponse> {
        this.xLibService.checkAuthenticationPublic(headerAuth);
        return this.xLibService.userAuthentication(body);
    }

    @Post('getXEntityMap')
    async getXEntityMap(@Body() body: any, @Headers('Authorization') headerAuth: string): Promise<XEntityMap> {
        console.log("************************* zavolany getXEntityMap *******************************************");
        await this.xLibService.checkAuthentication(headerAuth);
        return this.xEntityMetadataService.getXEntityMap();
    }
}
