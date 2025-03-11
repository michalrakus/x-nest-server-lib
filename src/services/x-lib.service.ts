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
import {XUser} from "../administration/x-user.entity";
import {XUserAuthenticationRequest, XUserAuthenticationResponse} from "../serverApi/XUserAuthenticationIfc";
import {XUtils} from "./XUtils";
import {FindParamRowsForAssoc} from "./FindParamRowsForAssoc";
import {SaveRowParam} from "./SaveRowParam";
import {RemoveRowParam} from "./RemoveRowParam";
import * as bcrypt from 'bcrypt';
import {FindParamRows} from "./FindParamRows";
import {XPostLoginRequest, XPostLoginResponse} from "../serverApi/XPostLoginIfc";
import {XAuth, XEnvVar} from "./XEnvVars";
import {join} from "path";
import {unlinkSync} from "fs";
import {XRowIdListToRemove} from "./XRowIdListToRemove";
import {XParam} from "../administration/x-param.entity";
import {dateFromUI, intFromUI, numberFromModel} from "../serverApi/XUtilsConversions";

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
     * @deprecated - mal by sa pouzivat lazy findRows + customFilterItems
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

    async saveRow(row: SaveRowParam): Promise<any> {
        // vsetky db operacie dame do jednej transakcie
        const fileListToRemove: Array<string> = new Array<string>();
        const objectReloaded: any = await this.dataSource.transaction<any>(manager => this.saveRowInTransaction(manager, row, fileListToRemove));
        // transakcia bola commitnuta, zmazeme pripadne subory
        // (ak by sme mazali pred commitom a commit by nepresiel, vznikla by inkonzistencia; ak neprejde zmazanie suboru neni to az taka tragedia)
        this.removeFiles(fileListToRemove);
        return objectReloaded;
    }

    async saveRowInTransaction(manager: EntityManager, row: SaveRowParam, fileListToRemove?: Array<string>): Promise<any> {

        // saveRow sluzi aj pre insert (id-cko je undefined, TypeORM robi rovno insert)
        // aj pre update (id-cko je cislo, TypeORM najprv cez select zistuje ci dany zaznam existuje)

        // poznamka: ak sa maju pri zavolani save(<master>) zapisovat aj detail zaznamy,
        // treba na OneToMany asociaciu zapisat: {cascade: ["insert", "update", "remove"]}
        // ("remove" netreba ale ten zas uplatnujeme na nasom custom removeRow)

        // poznamka 2: na options na asociacii som nasiel atribut orphanedRowAction
        // je pravdepodobne, ze tento atribut robi tu odprogramovany "orphan removal",
        // mal by byt zadany na ManyToOne asociacii (https://john-hu.medium.com/typeorm-deletes-one-to-many-orphans-a7404f922895)

        const xEntity: XEntity = this.xEntityMetadataService.getXEntity(row.entity);

        // ak mame vygenerovane id-cko, zmenime ho na undefined (aby sme mali priamy insert a korektne id-cko)
        if (row.object.__x_generatedRowId) {
            row.object[xEntity.idField] = undefined;
            delete row.object.__x_generatedRowId; // v pripade ze objekt vraciame klientovi (reload === true), nechceme tam __x_generatedRowId
        }

        let assocOneToManyList: XAssoc[] = this.xEntityMetadataService.getXAssocList(xEntity, ["one-to-many"]);
        const rowId = row.object[xEntity.idField];
        const insert: boolean = (rowId === undefined);
        assocOneToManyList = assocOneToManyList.filter(insert ? (assoc: XAssoc) => assoc.isCascadeInsert : (assoc: XAssoc) => assoc.isCascadeUpdate);

        for (const assoc of assocOneToManyList) {
            const xChildEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);

            // uprava toho co prislo z klienta - vynullujeme umelo vytvorene id-cka
            // (robime to tu a nie na klientovi, lebo ak nam nezbehne save, tak formular zostava otvoreny)
            // (poznamka: este by sa to dalo robit pri serializacii)
            const childRowList = row.object[assoc.name];

            // ak nemame nacitany childRowList, tak sa asociacie nedotykame - nerobime na nej ziadne zmeny
            if (childRowList === undefined) {
                continue; // ideme na dalsiu asociaciu
            }

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

        // ak mame update
        if (!insert) {
            // kedze nam chyba "remove orphaned entities" na asociaciach s detailami, tak ho zatial musime odprogramovat rucne
            // asi je to jedno ci pred save alebo po save (ak po save, tak cascade "remove" musi byt vypnuty - nefuguje ale tento remove zbehne skor)
            for (const assoc of assocOneToManyList) {
                const xChildEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);

                const idList: any[] = [];
                const childRowList = row.object[assoc.name];

                // ak nemame nacitany childRowList, tak sa asociacie nedotykame - nerobime na nej ziadne zmeny
                // (ak niekto ocakava ze budu vymazane zaznamy na asociacii v takomto pripade, nech nastavi oneToMany atribut na prazdny zoznam - priradi object.<assoc> = [])
                if (childRowList === undefined) {
                    continue; // ideme na dalsiu asociaciu
                }

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
                    const rowIdList: any[] = rowList.map(row => row[xChildEntity.idField]);
                    // tato metodka vymaze aj pripadne asociovane objekty (metodka funguje pre *toMany asociacie ako aj pre *toOne asociacie)
                    await this.removeRowsInTransaction(manager, xChildEntity, rowIdList, fileListToRemove);
                    // delete vykona priamo DELETE FROM, na rozdiel od remove, ktory najprv SELECT-om overi ci dane zaznamy existuju v DB
                    //await repository.delete(rowIdList);
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

    async removeRow(row: RemoveRowParam): Promise<void> {
        // vsetky db operacie dame do jednej transakcie
        const fileListToRemove: Array<string> = new Array<string>();
        await this.dataSource.transaction(manager => this.removeRowInTransaction(manager, row, fileListToRemove));
        // transakcia bola commitnuta, zmazeme pripadne subory
        // (ak by sme mazali pred commitom a commit by nepresiel, vznikla by inkonzistencia; ak neprejde zmazanie suboru neni to az taka tragedia)
        this.removeFiles(fileListToRemove);
    }

    async removeRowInTransaction(manager: EntityManager, row: RemoveRowParam, fileListToRemove?: Array<string>): Promise<void> {

        // na OneToMany asociacii standardne mame {cascade: ["insert", "update", "remove"]}
        // "insert" a "update" su potrebne aby sa pri zavolani save(<master>) zapisovali aj detail zaznamy,
        // pre "remove" by som ocakaval ze sa uplatni pre remove(<master>) ale nefunguje to (ani ked zavolam remove namiesto delete)
        // ani pridanie onDelete: "CASCADE" na OneToMany, resp. ManyToOne nepomohlo...
        // ani poslanie celeho json objektu (aj s child zaznamami) nepomohlo... <- to je asi nutne ak to ma zafungovat...
        // preto sme kaskadny delete dorobili, funguje cez vsetky asociacie ktore maju cascade "remove"
        // navyse tu mame aj mazanie suborov, ak strom objektov obsahuje zaznam XFile

        // update 14.5.2024: TypeORM nepodporuje cascade delete na asociaciach ("remove" mozno sluzi na volanie listenerov zavesenych na remove operaciu, netusim...)
        // cascade delete sa realizuje v DB cez FK constrainty (klauzula ON DELETE CASCADE - tuto klauzulu vytvara option {onDelete: "CASCADE"} zapisany
        // na ManyToOne asociacii - v pripade ak sa generuju tabulky z modelu)
        // jedina vynimka su ManyToMany asociacie - ak sa zavola remove(<master>) tak automaticky vymaze "link" zaznamy
        // (ManyToMany atributy nemusia byt nacitane, TypeORM si selectami zisti ci "link" zaznamy existuju)
        // pre jednoduchost som sa rozhodol pouzivat ON DELETE CASCADE na databaze pre "link" zaznamy (plati len pre ManyToMany asociacie)

        // asi by nebolo od veci v buducnosti prejst na cascade delete realizovany v DB cez FK constrainty, ked sa preto v TypeORM rozhodli...

        const xEntity: XEntity = this.xEntityMetadataService.getXEntity(row.entity);
        return this.removeRowsInTransaction(manager, xEntity, [row.id], fileListToRemove, row.assocsToRemove);
    }

    async removeRowsInTransaction(manager: EntityManager, xEntity: XEntity, rowIdList: any[], fileListToRemove?: Array<string>, assocsToRemove?: string[]) {
        // vygenerujeme query - jednym selectom nacitame cely strom zaznamov ktory ideme vymazat
        // prejdeme rekurzivne cez vsetky asociacie ktore maju nastaveny cascade "remove"
        const alias: string = "t";
        const repository = manager.getRepository(xEntity.name);
        const selectQueryBuilder: SelectQueryBuilder<unknown> = repository.createQueryBuilder(alias);
        // volanie this.addAssocsOfEntity pridava left join-y do selectQueryBuilder
        // assocsToRemove je implementovane zjednodusene, len pre prvu uroven
        // ak to ma fungovat pre cely path napr. "assoc1.assoc2", tak treba vytvarat mapu assocAliasMap (podobne ako pri lazy tabulke)
        // a zaroven pustat pridavanie asociacii cez cascade remove pre kazdy alias (vcetne hlavneho), zbieranie id-ciek treba vykonat tiez podobne
        if (this.addAssocsOfEntity(selectQueryBuilder, xEntity, alias, assocsToRemove)) {
            // ak sme pridali aspon 1 leftJoin
            selectQueryBuilder.whereInIds(rowIdList);

            // nacitame cely strom a zapiseme si id-cka na remove (v spravnom poradi)
            const rowList: any[] = await selectQueryBuilder.getMany();
            const rowIdListToRemove: XRowIdListToRemove = new XRowIdListToRemove();
            for (const row of rowList) {
                this.addRowOfEntityToRemove(xEntity, row, rowIdListToRemove, fileListToRemove, assocsToRemove);
            }

            // vymazeme nazbierane id-cka
            for (const rowIdList of rowIdListToRemove.entityRowIdListList) {
                await this.deleteRows(manager, rowIdList.entity, rowIdList.rowIdList);
            }
        }
        else {
            // optimalizacia
            // nepridali sme ani 1 leftJoin, netreba robit SELECT celeho stromu, usetrime ho a ideme priamo na delete
            await this.deleteRows(manager, xEntity.name, rowIdList);
        }
    }

    addAssocsOfEntity(selectQueryBuilder: SelectQueryBuilder<unknown>, xEntity: XEntity, alias: string, assocsToRemove?: string[]): boolean {
        // prejdeme vsetky asociacie (ktore maju cascade "remove", aj *toMany aj *toOne) a pridame ich do query
        let leftJoinAdded: boolean = false;
        const assocList: XAssoc[] = this.xEntityMetadataService.getXAssocList(xEntity).filter((assoc: XAssoc) => this.filterForAssocToRemove(assoc, assocsToRemove));
        for (const [index, assoc] of assocList.entries()) {
            const aliasForAssoc: string = `${alias}_${index}`; // chceme mat unique alias v ramci celeho stromu, tak vytvarame nieco ako napr. t_2_0_1
            selectQueryBuilder.leftJoinAndSelect(`${alias}.${assoc.name}`, aliasForAssoc);
            leftJoinAdded = true;
            const xAssocEntity: XEntity = this.xEntityMetadataService.getXEntity(assoc.entityName);
            this.addAssocsOfEntity(selectQueryBuilder, xAssocEntity, aliasForAssoc, undefined); // zatial zimplementovane len pre prvu uroven
        }
        return leftJoinAdded;
    }

    addRowOfEntityToRemove(xEntity: XEntity, row: any, rowIdListToRemove: XRowIdListToRemove, fileListToRemove?: Array<string>, assocsToRemove?: string[]) {
        // vymazeme "row" aj s jeho asociovanymi objektmi
        // musime mazat v spravnom poradi aby sme nenarusili FK constrainty (a ak asociacie vytvaraju cyklus, tak nam ani spravne poradie nepomoze...)

        // najprv *toMany asociacie
        const assocToManyList: XAssoc[] = this.xEntityMetadataService.getXAssocList(xEntity, ["one-to-many", "many-to-many"]).filter((assoc: XAssoc) => this.filterForAssocToRemove(assoc, assocsToRemove));
        for (const assoc of assocToManyList) {
            const assocRowList: any[] = row[assoc.name];
            for (const assocRow of assocRowList) {
                this.addRowOfEntityToRemove(this.xEntityMetadataService.getXEntity(assoc.entityName), assocRow, rowIdListToRemove, fileListToRemove, undefined); // zatial zimplementovane len pre prvu uroven
            }
        }

        // ulozime id-cko zaznamu "row" na remove
        const rowId: any = row[xEntity.idField];
        rowIdListToRemove.addRowId(xEntity.name, rowId);
        // ak sa jedna o row typu XFile, vymazeme aj subor (ak existuje)
        if (fileListToRemove !== undefined && xEntity.name === "XFile") {
            // TODO - cast na XFile
            // ak row.pathName === null, subor je zapisany v DB v zazname "row"
            if (row.pathName !== null) {
                // subor mazeme z adresara app-files/x-files/<xFile.pathName>
                fileListToRemove.push(join(XUtils.getXFilesDir(), row.pathName));
            }
        }

        // teraz mozme vymazat *toOne asociacie
        const assocToOneList: XAssoc[] = this.xEntityMetadataService.getXAssocList(xEntity, ["one-to-one", "many-to-one"]).filter((assoc: XAssoc) => this.filterForAssocToRemove(assoc, assocsToRemove));
        for (const assoc of assocToOneList) {
            const assocRow: any = row[assoc.name];
            // ak je v FK-stlpci null, potom je myslim asociacia null (este by mohla byt undefined (nepritomna))
            if (assocRow) {
                this.addRowOfEntityToRemove(this.xEntityMetadataService.getXEntity(assoc.entityName), assocRow, rowIdListToRemove, fileListToRemove, undefined); // zatial zimplementovane len pre prvu uroven
            }
        }
    }

    // pomocna metodka
    filterForAssocToRemove(assoc: XAssoc, assocsToRemove?: string[]): boolean {
        return assoc.isCascadeRemove || (assocsToRemove !== undefined && assocsToRemove.includes(assoc.name));
    }

    async deleteRows(manager: EntityManager, entity: string, rowIdList: any[]) {
        const repository = manager.getRepository(entity);
        // delete vykona priamo DELETE FROM, na rozdiel od remove, ktory najprv SELECT-om overi ci dane zaznamy existuju v DB
        await repository.delete(rowIdList);
    }

    removeFiles(fileListToRemove: Array<string>) {
        for (const file of fileListToRemove) {
            // ak sa nepodari vymazat subor, tak len zalogujeme
            try {
                unlinkSync(file);
            }
            catch (e) {
                console.log(`Could not remove file ${file}. Error: ${e}`);
            }
            //console.log(`Succesfully removed file ${file}`);
        }
    }

    /* old simple removeRow
    async removeRowInTransactionOld(manager: EntityManager, row: RemoveRowParam): Promise<void> {

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
        /
    }
    */

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

        // projekt depaul potrebuje pracovat s detail zaznamami, preto volame this.saveRow
        //await repository.save(row.object);
        await this.saveRow(row);
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
        let username: string;
        if (XUtils.getEnvVarValue(XEnvVar.X_AUTH) === XAuth.OFF) {
            username = xPostLoginRequest.username;
        }
        else if (XUtils.getEnvVarValue(XEnvVar.X_AUTH) === XAuth.AUTH0) {
            // email (username) must be added in auth0.com to the access token
            // how to do it: in auth0.com: Actions -> Triggers -> click post-login, then create custom action with this body:
            /*
            exports.onExecutePostLogin = async (event, api) => {
                if (event.authorization) {
                    api.accessToken.setCustomClaim('x-custom-claim-email', event.user.email);
                    //console.log(`Logging user's email: ${event.user.email}`)
                }
            };
            */
            // and add action to the diagram of post-login using drag and drop

            // original solution was:
            //const emailKey = XUtils.getEnvVarValue(XEnvVar.X_AUTH0_AUDIENCE) + 'email'; <-- why to use audience?
            const emailKey = 'x-custom-claim-email'; // new solution
            username = reqUser[emailKey];
            if (username === undefined) {
                throw `Email of the current user was not found in access token. Email-key = ${emailKey}`;
            }
        }
        else if (XUtils.getEnvVarValue(XEnvVar.X_AUTH) === XAuth.MS_ENTRA_ID) {
            // toto sa pouziva pri AAD - preferred_username je podozrivy nazov ale nechcelo sa mi hladat nieco lepsie
            //console.log(reqUser);
            username = reqUser.preferred_username
        }

        const repository = this.dataSource.getRepository(XUser);
        const selectQueryBuilder: SelectQueryBuilder<XUser> = repository.createQueryBuilder("xUser");
        selectQueryBuilder.where("xUser.username = :username", {username: username});
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

    // helper functions - maybe better XUtilsService

    async getSequenceValue(sequenceName: string): Promise<number> {
        const rowList: any[] = await this.dataSource.query(`SELECT nextval('${XUtils.getSchema()}.${sequenceName}') AS value`);
        return numberFromModel(rowList[0].value);
    }

    async setSequenceValue(sequenceName: string, value: number): Promise<void> {
        await this.dataSource.query(`SELECT setval('${XUtils.getSchema()}.${sequenceName}', ${value}, false)`);
    }

    async getParamValueAsInt(paramCode: string): Promise<number> {
        const paramValue: string = await this.getParamValue(paramCode);
        const paramValueInt: number | null | undefined = intFromUI(paramValue);
        if (paramValueInt === null || paramValueInt === undefined) {
            throw `Param ${paramCode}: could not convert param value ${paramValue} to int.`;
        }
        return paramValueInt;
    }

    async getParamValueAsDate(paramCode: string): Promise<Date> {
        const paramValue: string = await this.getParamValue(paramCode);
        const paramValueDate: Date | null | undefined = dateFromUI(paramValue);
        if (paramValueDate === null || paramValueDate === undefined) {
            throw `Param ${paramCode}: could not convert param value ${paramValue} to date.`;
        }
        return paramValueDate;
    }

    async getParamValue(paramCode: string): Promise<string> {
        const repository = this.dataSource.getRepository(XParam);
        const sqb: SelectQueryBuilder<XParam> = repository.createQueryBuilder("xParam");
        sqb.where("xParam.code = :code", {code: paramCode});
        const xParam: XParam | null = await sqb.getOne();
        if (xParam === null) {
            throw `XParam row for code = ${paramCode} not found.`;
        }
        return xParam.value;
    }
}
