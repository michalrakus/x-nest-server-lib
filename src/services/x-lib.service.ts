import { Injectable } from '@nestjs/common';
import {
    DataSource, EntityManager,
    EntityMetadata,
    OrderByCondition,
    SelectQueryBuilder
} from "typeorm";
import {RelationMetadata} from "typeorm/metadata/RelationMetadata";
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XAssoc, XAssocMap, XEntity} from "../serverApi/XEntityMetadata";
import {XUser} from "../administration/xuser.entity";
import {XUserAuthenticationRequest, XUserAuthenticationResponse} from "../serverApi/XUserAuthenticationIfc";
import {XUtils} from "./XUtils";
import {FindParamRowsForAssoc} from "./FindParamRowsForAssoc";
import {SaveRowParam} from "./SaveRowParam";
import {RemoveRowParam} from "./RemoveRowParam";
import * as bcrypt from 'bcrypt';
import {FindParamRows} from "./FindParamRows";
import {XPostLoginRequest, XPostLoginResponse} from "../serverApi/XPostLoginIfc";
import {XEnvVar} from "./XEnvVars";

@Injectable()
export class XLibService {

    constructor(
        private readonly dataSource: DataSource,
        private readonly xEntityMetadataService: XEntityMetadataService
    ) {}

    /**
     * @deprecated - mal by sa pouzivat findRows
     */
    async findRowsForAssoc(findParamRows : FindParamRowsForAssoc): Promise<any[]> {
        const repository = this.dataSource.getRepository(findParamRows.entity);
        const entityMetadata: EntityMetadata = repository.metadata
        const relationMetadata: RelationMetadata = entityMetadata.findRelationWithPropertyPath(findParamRows.assocField);
        if (relationMetadata === undefined) {
            throw "Unexpected error - RelationMetadata for property " + findParamRows.assocField + " not found for entity " + findParamRows.entity;
        }
        const repositoryForAssoc = this.dataSource.getRepository(relationMetadata.type);
        const selectQueryBuilder : SelectQueryBuilder<unknown> = repositoryForAssoc.createQueryBuilder("t0");
        if (findParamRows.displayField !== undefined && findParamRows.displayField !== null && findParamRows.filter !== undefined && findParamRows.filter !== null) {
            selectQueryBuilder.where("t0." + findParamRows.displayField + " LIKE :filter", {filter: findParamRows.filter + "%"});
        }

        const rows: any[] = await selectQueryBuilder.getMany();
        return rows;
    }

    // toto je specialny pripad vseobecnejsieho servisu XLazyDataTableService.findRows, ak resultType === ResultType.AllRows
    // (nedava napr. moznost dotahovat aj asociovane objekty, sortovat podla viacerych stlpcov a pod. - je to take zjednodusene)
    /**
     * @deprecated - mal by sa pouzivat lazy findRows + customFilter
     */
    async findRows(findParamRows: FindParamRows): Promise<any[]> {
        const repository = this.dataSource.getRepository(findParamRows.entity);
        const selectQueryBuilder: SelectQueryBuilder<unknown> = repository.createQueryBuilder("t0");
        // filter cez displayField pouziva napr. SearchButton, ak user v inpute vyplni len cast hodnoty a odide,
        // tak cez tento filter hladame ci hodnote zodpoveda prave 1 zaznam
        if (findParamRows.displayField && findParamRows.filter) {
            selectQueryBuilder.where("t0." + findParamRows.displayField + " LIKE :filter", {filter: findParamRows.filter + "%"});
        }
        if (findParamRows.sortMeta) {
            let orderByItems: OrderByCondition = {};
            orderByItems["t0." + findParamRows.sortMeta.field] = (findParamRows.sortMeta.order === 1 ? "ASC" : "DESC");
            selectQueryBuilder.orderBy(orderByItems);
        }
        return await selectQueryBuilder.getMany();
    }

    saveRow(row: SaveRowParam): Promise<any> {
        // vsetky db operacie dame do jednej transakcie
        return this.dataSource.transaction<any>(manager => this.saveRowInTransaction(manager, row));
    }

    async saveRowInTransaction(manager: EntityManager, row: SaveRowParam): Promise<any> {

        // saveRow sluzi aj pre insert (id-cko je undefined, TypeORM robi rovno insert)
        // aj pre update (id-cko je cislo, TypeORM najprv cez select zistuje ci dany zaznam existuje)

        // poznamka: ak sa maju pri zavolani save(<master>) zapisovat aj detail zaznamy,
        // treba na OneToMany asociaciu zapisat: {cascade: ["insert", "update", "remove"]}
        // ("remove" netreba ale ten by sme chceli uplatnovat pri removeRow)

        // poznamka 2: na options na asociacii (OneToMany ale aj na inych) som nasiel atribut orphanedRowAction
        // je pravdepodobne, ze tento atribut robi tu odprogramovany "orphan removal"

        const xEntity: XEntity = this.xEntityMetadataService.getXEntity(row.entity);

        // ak mame vygenerovane id-cko, zmenime ho na undefined (aby sme mali priamy insert a korektne id-cko)
        if (row.object.__x_generatedRowId) {
            row.object[xEntity.idField] = undefined;
            delete row.object.__x_generatedRowId; // v pripade ze objekt vraciame klientovi (reload === true), nechceme tam __x_generatedRowId
        }

        let assocToManyList: XAssoc[] = this.xEntityMetadataService.getXAssocList(xEntity, ["one-to-many", "many-to-many"]);
        const rowId = row.object[xEntity.idField];
        const insert: boolean = (rowId === undefined);
        assocToManyList = assocToManyList.filter(insert ? (assoc: XAssoc) => assoc.isCascadeInsert : (assoc: XAssoc) => assoc.isCascadeUpdate);

        for (const assoc of assocToManyList) {
            const xChildEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);

            // uprava toho co prislo z klienta - vynullujeme umelo vytvorene id-cka
            // (robime to tu a nie na klientovi, lebo ak nam nezbehne save, tak formular zostava otvoreny)
            // (poznamka: este by sa to dalo robit pri serializacii)
            const childRowList = row.object[assoc.name];
            // pri inserte noveho zaznamu nemusi byt childRowList vytvoreny
            if (childRowList !== undefined) {
                for (const childRow of childRowList) {
                    if (childRow.__x_generatedRowId) {
                        // undefined v id-cku sposobi, ze sa priamo vykona INSERT
                        // (netestuje sa ci zaznam uz existuje v DB (ako je tomu pri null alebo inej ciselnej hodnote))
                        // kaskadny insert/update potom pekne zafunguje
                        childRow[xChildEntity.idField] = undefined;
                        delete childRow.__x_generatedRowId; // v pripade ze objekt vraciame klientovi (reload === true), nechceme tam __x_generatedRowId
                    }
                }
            }
        }

        // ak mame update
        if (!insert) {
            // kedze nam chyba "remove orphaned entities" na asociaciach s detailami, tak ho zatial musime odprogramovat rucne
            // asi je to jedno ci pred save alebo po save (ak po save, tak cascade "remove" musi byt vypnuty - nefuguje ale tento remove zbehne skor)
            for (const assoc of assocToManyList) {
                const xChildEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);

                const idList: any[] = [];
                const childRowList = row.object[assoc.name];
                // pri inserte noveho zaznamu nemusi byt childRowList vytvoreny
                if (childRowList !== undefined) {
                    for (const childRow of childRowList) {
                        const id = childRow[xChildEntity.idField];
                        if (id !== null && id !== undefined) {
                            idList.push(id);
                        }
                    }
                }

                if (assoc.inverseAssocName === undefined) {
                    throw `Assoc ${xEntity.name}.${assoc.name} has no inverse assoc.`;
                }
                const repository = manager.getRepository(xChildEntity.name);
                const selectQueryBuilder: SelectQueryBuilder<unknown> = repository.createQueryBuilder("t0");
                // poznamka: ManyToOne/OneToOne asociacia "t0.${assoc.inverseAssocName}" sa transformuje na "t0.<idField>" v sql
                selectQueryBuilder.where(`t0.${assoc.inverseAssocName} = :rowId`, {rowId: rowId});
                if (idList.length > 0) {
                    selectQueryBuilder.andWhere(`t0.${xChildEntity.idField} NOT IN (:...idList)`, {idList: idList});
                }
                const rowList: any[] = await selectQueryBuilder.getMany();
                //console.log("Nasli sme na zrusenie:" + rowList.length);
                //console.log(rowList);
                if (rowList.length > 0) {
                    //await repository.remove(rowList);
                    // delete vykona priamo DELETE FROM, na rozdiel od remove, ktory najprv SELECT-om overi ci dane zaznamy existuju v DB
                    const rowIdList: any[] = rowList.map(row => row[xChildEntity.idField]);
                    await repository.delete(rowIdList);
                }
            }
        }

        // samotny insert/update entity
        const repository = manager.getRepository(row.entity);
        //console.log(row.object);
        //const date = row.object.carDate;
        //console.log(typeof date);
        const objectReloaded: any = await repository.save(row.object);

        return row.reload ? objectReloaded : {};
    }

    removeRow(row: RemoveRowParam): Promise<void> {
        // vsetky db operacie dame do jednej transakcie
        return this.dataSource.transaction(manager => this.removeRowInTransaction(manager, row));
    }

    async removeRowInTransaction(manager: EntityManager, row: RemoveRowParam): Promise<void> {
        // TypeORM neposkytuje kaskadny delete, preto je tu kaskadny delete dorobeny

        // na OneToMany asociacii standardne mame {cascade: ["insert", "update", "remove"]}
        // "insert" a "update" su potrebne aby sa pri zavolani save(<master>) zapisovali aj detail zaznamy,
        // pre "remove" by som ocakaval ze sa uplatni pre remove(<master>) ale nefunguje to (ani ked zavolam remove namiesto delete)
        // ani pridanie onDelete: "CASCADE" na OneToMany, resp. ManyToOne nepomohlo...
        // ani poslanie celeho json objektu (aj s child zaznamami) nepomohlo... <- to je asi nutne ak to ma zafungovat...
        // preto sme kaskadny delete dorobili - TODO - vykonat len ak mame "remove"

        const xEntity: XEntity = this.xEntityMetadataService.getXEntity(row.entity);

        // prejdeme vsetky *ToMany asociacie (ktore maju cascade "remove") a zmazeme ich child zaznamy
        const assocList: XAssoc[] = this.xEntityMetadataService.getXAssocList(xEntity, ["one-to-many", "many-to-many"]).filter((assoc: XAssoc) => assoc.isCascadeRemove);
        for (const assoc of assocList) {
            const xChildEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);
            if (assoc.inverseAssocName === undefined) {
                throw `Assoc ${xEntity.name}.${assoc.name} has no inverse assoc.`;
            }
            const childRepository = manager.getRepository(xChildEntity.name);
            const selectQueryBuilder: SelectQueryBuilder<unknown> = childRepository.createQueryBuilder("t0");
            // poznamka: ManyToOne/OneToOne asociacia "t0.${assoc.inverseAssocName}" sa transformuje na "t0.<idField>" v sql
            selectQueryBuilder.where(`t0.${assoc.inverseAssocName} = :rowId`, {rowId: row.id});
            const rowList: any[] = await selectQueryBuilder.getMany();
            if (rowList.length > 0) {
                // delete vykona priamo DELETE FROM, na rozdiel od remove, ktory najprv SELECT-om overi ci dane zaznamy existuju v DB
                const rowIdList: any[] = rowList.map(row => row[xChildEntity.idField]);
                await childRepository.delete(rowIdList);
            }
        }

        // samotny delete entity
        const repository = manager.getRepository(row.entity);
        await repository.delete(row.id);

        /*
            POZNAMKA: efektivnejsie by bolo pouzivat DeleteQueryBuilder (priamy DELETE FROM ... WHERE <fk-stlpec> = <id>),
            ten ma vsak bugy - tu je priklad kodu ktory som skusal (predpoklada ze popri ManyToOne asociacii mame aj atribut pre FK stlpec)

            const repository = this.dataSource.getRepository(VydajDobrovolnik);

            // DeleteQueryBuilder nefunguje ak chceme pouzivat aliasy tabuliek a mapovat nazvy atributov do nazvov stlpcov
            // je to bug - https://github.com/typeorm/typeorm/issues/5931
            const selectQueryBuilder: SelectQueryBuilder<VydajDobrovolnik> = repository.createQueryBuilder();
            //selectQueryBuilder.where("vydajD.idVydaj = :idVydaj", {idVydaj: row.id});
            await selectQueryBuilder.delete().from(VydajDobrovolnik, "vydajDobr").where("vydajDobr.idVydaj = :idVydaj", {idVydaj: row.id}).execute();
            // vrati:
            //query failed: DELETE FROM `vydaj_dobrovolnik` WHERE vydajDobr.idVydaj = ? -- PARAMETERS: [22]
            //error: Error: ER_BAD_FIELD_ERROR: Unknown column 'vydajDobr.idVydaj' in 'where clause'

            // nezafunguje ani toto:
            const selectQueryBuilder: SelectQueryBuilder<VydajDobrovolnik> = repository.createQueryBuilder("vydajD");
            selectQueryBuilder.where("vydajD.idVydaj = :idVydaj", {idVydaj: row.id});
            await selectQueryBuilder.delete().execute();
        */
    }

    /* old authetication
    async userAuthentication(userAuthenticationRequest: XUserAuthenticationRequest): Promise<XUserAuthenticationResponse> {
        const repository = this.dataSource.getRepository(XUser);
        const selectQueryBuilder: SelectQueryBuilder<XUser> = repository.createQueryBuilder("xUser");
        selectQueryBuilder.where("xUser.username = :username", userAuthenticationRequest);
        const xUserList: XUser[] = await selectQueryBuilder.getMany();
        let userAuthenticationResponse: XUserAuthenticationResponse;
        if (xUserList.length === 1 && await bcrypt.compare(userAuthenticationRequest.password, xUserList[0].password)) {
            userAuthenticationResponse = {authenticationOk: true, xUser: xUserList[0]};
        }
        else {
            userAuthenticationResponse = {authenticationOk: false};
        }
        return userAuthenticationResponse;
    }
    */

    /* old authetication - change password
    async userChangePassword(request: {username: string; passwordNew: string;}) {
        const repository = this.dataSource.getRepository(XUser);
        const selectQueryBuilder: SelectQueryBuilder<XUser> = repository.createQueryBuilder("xUser");
        selectQueryBuilder.where("xUser.username = :username", request);
        const xUser: XUser = await selectQueryBuilder.getOneOrFail();
        xUser.password = await this.hashPassword(request.passwordNew);
        await repository.save(xUser);
    }
    */

    async userSaveRow(row: SaveRowParam) {
        const repository = this.dataSource.getRepository(row.entity);
        // ak bolo zmenene heslo, treba ho zahashovat
        // ak nebolo vyplnene nove heslo, tak v password pride undefined a mapper atribut nebude menit
        // -> password sa zatial nepouziva
        // if (row.object.password && row.object.password !== '') {
        //     row.object.password = await this.hashPassword(row.object.password);
        // }
        await repository.save(row.object);
    }

    /* old authentication
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

        const repository = this.dataSource.getRepository(XUser);
        const selectQueryBuilder: SelectQueryBuilder<XUser> = repository.createQueryBuilder("xUser");
        selectQueryBuilder.select("xUser.password", "passwordDB");
        selectQueryBuilder.where("xUser.username = :username", {username: username});

        const {passwordDB} = await selectQueryBuilder.getRawOne();
        if (!await bcrypt.compare(password, passwordDB)) {
            throw "Authentication failed.";
        }
        //console.log(`Autentifikacia zbehla ok pre ${username}/${password}`);
    }
    */

    /* old authentication
    checkAuthenticationPublic(headerAuth: string) {
        const xTokenPublic = XUtils.xTokenPublic;
        if (headerAuth === undefined || headerAuth !== `Basic ${Buffer.from(xTokenPublic.username + ':' + xTokenPublic.password).toString('base64')}`) {
            throw "Authentication failed.";
        }
        //console.log(`Public autentifikacia zbehla ok`);
    }
    */

    /* old authentication
    private hashPassword(password: string): Promise<string> {
        // standardne by mal byt saltOrRounds = 10, potom trva jeden vypocet asi 100 ms, co sa povazuje za dostatocne bezpecne proti utoku hrubou vypoctovou silou
        // kedze my testujeme heslo pri kazdom requeste, tak som znizil saltOrRounds na 1, potom trva jeden vypocet (v bcrypt.compare) asi 10 ms, cena je trochu nizsia bezpecnost
        return bcrypt.hash(password, 1);
    }
    */

    async postLogin(reqUser: any, xPostLoginRequest: XPostLoginRequest): Promise<XPostLoginResponse> {
        // audience "https://x-demo-server.herokuapp.com/"
        const emailKey = XUtils.getEnvVarValue(XEnvVar.X_AUTH0_AUDIENCE) + 'email';
        const userEmail: string = reqUser[emailKey];
        if (userEmail === undefined) {
            throw `Email of the current user was not found in access token. Email-key = ${emailKey}`;
        }

        const repository = this.dataSource.getRepository(XUser);
        const selectQueryBuilder: SelectQueryBuilder<XUser> = repository.createQueryBuilder("xUser");
        selectQueryBuilder.where("xUser.username = :username", {username: userEmail});
        const xUser: XUser | null = await selectQueryBuilder.getOne();
        // synchronizaciu udajov vypneme, lebo pri auth0 kontach nam prepisuje meno e-mailom
        // if (xUser !== null) {
        //     // synchronizacia udajov
        //     if (xPostLoginRequest.username !== undefined) {
        //         xUser.name = xPostLoginRequest.username;
        //         await repository.save(xUser);
        //     }
        // }
        return {xUser: xUser !== null ? xUser : undefined};
    }
}
