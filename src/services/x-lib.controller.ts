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
import {XBrowseMetaMap} from "../serverApi/XBrowseMetadata";
import {XBrowseFormMetadataService} from "./x-browse-form-metadata.service";

@Controller()
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
        return await this.xLazyDataTableService.findRowById(body);
    }

    @Post('saveRow')
    async saveRow(@Body() body: SaveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.xLibService.checkAuthentication(headerAuth);
        await this.xLibService.saveRow(body);
    }

    @Post('removeRow')
    async removeRow(@Body() body: RemoveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.xLibService.checkAuthentication(headerAuth);
        await this.xLibService.removeRow(body);
    }

    @Post('userAuthentication')
    async userAuthentication(@Body() body: XUserAuthenticationRequest, @Headers('Authorization') headerAuth: string): Promise<XUserAuthenticationResponse> {
        this.xLibService.checkAuthenticationPublic(headerAuth);
        return await this.xLibService.userAuthentication(body);
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
