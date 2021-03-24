import { Injectable } from '@nestjs/common';
import {
    EntityMetadata,
    getManager,
    getRepository,
    SelectQueryBuilder
} from "typeorm";
import {RelationMetadata} from "typeorm/metadata/RelationMetadata";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XAssocMap, XEntity} from "../serverApi/XEntityMetadata";
import {XUser} from "../administration/xuser.entity";
import {XUserAuthenticationRequest, XUserAuthenticationResponse} from "../serverApi/XUserAuthenticationIfc";
import {XUtils} from "./XUtils";
import {FindParamRowsForAssoc} from "./FindParamRowsForAssoc";
import {SaveRowParam} from "./SaveRowParam";
import {RemoveRowParam} from "./RemoveRowParam";

@Injectable()
export class XLibService {

    constructor(
        private readonly xEntityMetadataService: XEntityMetadataService
    ) {}

    async findRowsForAssoc(findParamRows : FindParamRowsForAssoc): Promise<any[]> {
        const repository = getRepository(findParamRows.entity);
        const entityMetadata: EntityMetadata = repository.metadata
        const relationMetadata: RelationMetadata = entityMetadata.findRelationWithPropertyPath(findParamRows.assocField);
        if (relationMetadata === undefined) {
            throw "Unexpected error - RelationMetadata for property " + findParamRows.assocField + " not found for entity " + findParamRows.entity;
        }
        const repositoryForAssoc = getRepository(relationMetadata.type);
        const selectQueryBuilder : SelectQueryBuilder<unknown> = repositoryForAssoc.createQueryBuilder("t0");
        if (findParamRows.displayField !== undefined && findParamRows.displayField !== null && findParamRows.filter !== undefined && findParamRows.filter !== null) {
            selectQueryBuilder.where("t0." + findParamRows.displayField + " LIKE :filter", {filter: findParamRows.filter + "%"});
        }

        const rows: any[] = await selectQueryBuilder.getMany();
        return rows;
    }

    async saveRow(row: SaveRowParam) {

        // saveRow sluzi aj pre insert (id-cko je undefined, TypeORM robi rovno insert)
        // aj pre update (id-cko je cislo, TypeORM najprv cez select zistuje ci dany zaznam existuje)

        const xEntity: XEntity = this.xEntityMetadataService.getXEntity(row.entity);
        const assocMap: XAssocMap = xEntity.assocToManyMap;
        for (const [assocName, assoc] of Object.entries(assocMap)) {
            const xChildEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);

            // uprava toho co prislo z klienta - vynullujeme umelo vytvorene id-cka
            // (robime to tu a nie na klientovi, lebo ak nam nezbehne save, tak formular zostava otvoreny)
            // (poznamka: este by sa to dalo robit pri serializacii)
            const childRowList = row.object[assoc.name];
            for (const childRow of childRowList) {
                if (childRow.__x_generatedRowId) {
                    // undefined v id-cku sposobi, ze sa priamo vykona INSERT
                    // (netestuje sa ci zaznam uz existuje v DB (ako je tomu pri null alebo inej ciselnej hodnote))
                    // kaskadny insert/update potom pekne zafunguje
                    childRow[xChildEntity.idField] = undefined;
                }
            }
        }

        // vsetky db operacie dame do jednej transakcie
        await getManager().transaction(async manager => {
            const rowId = row.object[xEntity.idField];
            if (rowId !== undefined) {
                // kedze nam chyba "remove orphaned entities" na asociaciach s detailami, tak ho zatial musime odprogramovat rucne
                // asi je to jedno ci pred save alebo po save (ak po save, tak cascade "remove" musi byt vypnuty - nefuguje ale tento remove zbehne skor)
                for (const [assocName, assoc] of Object.entries(assocMap)) {
                    const xChildEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);

                    const idList: any[] = [];
                    const childRowList = row.object[assoc.name];
                    for (const childRow of childRowList) {
                        const id = childRow[xChildEntity.idField];
                        if (id !== null && id !== undefined) {
                            idList.push(id);
                        }
                    }

                    if (assoc.inverseAssocName === undefined) {
                        throw `Assoc ${xEntity.name}.${assoc.name} has no inverse assoc.`;
                    }
                    const repository = manager.getRepository(xChildEntity.name);
                    const selectQueryBuilder: SelectQueryBuilder<unknown> = repository.createQueryBuilder("t0");
                    selectQueryBuilder.innerJoin(`t0.${assoc.inverseAssocName}`, "t1");
                    selectQueryBuilder.where(`t1.${xEntity.idField} = :rowId`, {rowId: rowId});
                    if (idList.length > 0) {
                        selectQueryBuilder.andWhere(`t0.${xChildEntity.idField} NOT IN (:...idList)`, {idList: idList});
                    }
                    const rowList: any[] = await selectQueryBuilder.getMany();
                    //console.log("Nasli sme na zrusenie:" + rowList.length);
                    //console.log(rowList);
                    await repository.remove(rowList);
                }
            }

            // samotny insert/update entity
            const repository = manager.getRepository(row.entity);
            //console.log(row.object);
            //const date = row.object.carDate;
            //console.log(typeof date);
            await repository.save(row.object);
        });
    }

    async removeRow(row: RemoveRowParam) {
        //console.log('sme v Pokus1Service.removeRow');

        // TODO - ak TypeORM/DB neposkytuje kaskadny delete, dorobit aj ten (asi len pre prvu uroven)
        const repository = getRepository(row.entity);
        await repository.delete(row.id);
    }

    async userAuthentication(userAuthenticationRequest: XUserAuthenticationRequest): Promise<XUserAuthenticationResponse> {
        const repository = getRepository(XUser);
        const selectQueryBuilder: SelectQueryBuilder<XUser> = repository.createQueryBuilder("xUser");
        selectQueryBuilder.where("xUser.username = :username AND xUser.password = :password", userAuthenticationRequest);
        const xUserList: XUser[] = await selectQueryBuilder.getMany();
        let userAuthenticationResponse: XUserAuthenticationResponse;
        if (xUserList.length === 1) {
            userAuthenticationResponse = {authenticationOk: true, xUser: xUserList[0]};
        }
        else {
            userAuthenticationResponse = {authenticationOk: false};
        }
        return userAuthenticationResponse;
    }

    // zatial docasne sem
    async checkAuthentication(headerAuth: string) {
        // zatial pre jednoduchost skontrolujeme vzdy v DB (lepsie by bolo cachovat)
        if (headerAuth === undefined) {
            throw "Authentication failed.";
        }
        if (!headerAuth.startsWith("Basic ")) {
            throw "Authentication failed.";
        }
        const headerAuthDecoded: string = Buffer.from(headerAuth.substring("Basic ".length), 'base64').toString();
        const posColon: number = headerAuthDecoded.indexOf(":");
        if (posColon === -1) {
            throw "Authentication failed.";
        }
        const username: string = headerAuthDecoded.substring(0, posColon);
        const password: string = headerAuthDecoded.substring(posColon + 1);

        const repository = getRepository(XUser);
        const selectQueryBuilder: SelectQueryBuilder<XUser> = repository.createQueryBuilder("xUser");
        selectQueryBuilder.select("COUNT(1)", "count");
        selectQueryBuilder.where("xUser.username = :username AND xUser.password = :password", {username: username, password: password});

        const {count} = await selectQueryBuilder.getRawOne();
        // pozor, count nie je number ale string!
        if (parseInt(count) !== 1) {
            throw "Authentication failed.";
        }
        //console.log(`Autentifikacia zbehla ok pre ${username}/${password}`);
    }

    checkAuthenticationPublic(headerAuth: string) {
        const xTokenPublic = XUtils.xTokenPublic;
        if (headerAuth === undefined || headerAuth !== `Basic ${Buffer.from(xTokenPublic.username + ':' + xTokenPublic.password).toString('base64')}`) {
            throw "Authentication failed.";
        }
        //console.log(`Public autentifikacia zbehla ok`);
    }
}
