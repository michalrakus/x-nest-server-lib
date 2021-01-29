import {Body, Headers, Controller, Post} from '@nestjs/common';
import {Pokus1Service} from "./pokus1.service";
import {FindResult} from "../serverApi/FindResult";
import {LazyDataTableService} from "./lazy-data-table.service";
import {EntityMetadataService} from "./entity-metadata.service";
import {XEntityMap} from "../serverApi/XEntityMetadata";
import {XUserAuthenticationRequest, XUserAuthenticationResponse} from "../serverApi/XUserAuthenticationIfc";
import {FindParam} from "../serverApi/FindParam";
import {FindParamRowsForAssoc} from "./FindParamRowsForAssoc";
import {FindRowByIdParam} from "./FindRowByIdParam";
import {SaveRowParam} from "./SaveRowParam";
import {RemoveRowParam} from "./RemoveRowParam";

@Controller()
export class Pokus1Controller {
    constructor(
        private readonly pokus1Service: Pokus1Service,
        private readonly lazyDataTableService: LazyDataTableService,
        private readonly entityMetadataService: EntityMetadataService) {}

    @Post('lazyDataTableFindRows')
    async lazyDataTableFindRows(@Body() body: FindParam, @Headers('Authorization') headerAuth: string): Promise<FindResult> {
        // musime dat await, lebo vo vnutri je tiez await (kod "za" await v pokus1Service.checkAuthentication by zbehol az po zbehnuti celej tejto metody, ak by tu nebol await
        await this.pokus1Service.checkAuthentication(headerAuth);

        const findResult: FindResult = await this.lazyDataTableService.findRows(body);
        const response: Promise<FindResult> = Promise.resolve(findResult);
        return response;
    }

    @Post('findRowsForAssoc')
    async findRowsForAssoc(@Body() body: FindParamRowsForAssoc, @Headers('Authorization') headerAuth: string): Promise<any[]> {
        await this.pokus1Service.checkAuthentication(headerAuth);
        const rows: any[] = await this.pokus1Service.findRowsForAssoc(body);
        return rows;
    }

    // @Post('getAssocName')
    // getAssocName(@Body() body: GetAssocNameParam): Promise<any> {
    //     return this.pokus1Service.getAssocName(body);
    // }

    @Post('findRowById')
    async findRowById(@Body() body: FindRowByIdParam, @Headers('Authorization') headerAuth: string): Promise<any> {
        await this.pokus1Service.checkAuthentication(headerAuth);
        return this.lazyDataTableService.findRowById(body);
    }

    @Post('addRow')
    async addRow(@Body() body: SaveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.pokus1Service.checkAuthentication(headerAuth);
        this.pokus1Service.addRow(body);
    }

    @Post('saveRow')
    async saveRow(@Body() body: SaveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.pokus1Service.checkAuthentication(headerAuth);
        this.pokus1Service.saveRow(body);
    }

    @Post('removeRow')
    async removeRow(@Body() body: RemoveRowParam, @Headers('Authorization') headerAuth: string) {
        await this.pokus1Service.checkAuthentication(headerAuth);
        this.pokus1Service.removeRow(body);
    }

    @Post('userAuthentication')
    userAuthentication(@Body() body: XUserAuthenticationRequest, @Headers('Authorization') headerAuth: string): Promise<XUserAuthenticationResponse> {
        this.pokus1Service.checkAuthenticationPublic(headerAuth);
        return this.pokus1Service.userAuthentication(body);
    }

    @Post('getXEntityMap')
    async getXEntityMap(@Body() body: any, @Headers('Authorization') headerAuth: string): Promise<XEntityMap> {
        console.log("************************* zavolany getXEntityMap *******************************************");
        await this.pokus1Service.checkAuthentication(headerAuth);
        return this.entityMetadataService.getXEntityMap();
    }
}
