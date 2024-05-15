import { Injectable } from '@nestjs/common';
import {XAssoc, XAssocMap, XEntity, XEntityMap, XField, XFieldMap, XRelationType} from "../serverApi/XEntityMetadata";
import {DataSource, EntityMetadata, EntitySchema} from "typeorm";
import {RelationMetadata} from "typeorm/metadata/RelationMetadata";
import {ColumnMetadata} from "typeorm/metadata/ColumnMetadata";
import {MixedList} from "typeorm/common/MixedList";
import {XUtilsMetadataCommon} from "../serverApi/XUtilsMetadataCommon";

@Injectable()
export class XEntityMetadataService {

    private entityList: MixedList<Function | string | EntitySchema>;

    constructor(
        private readonly dataSource: DataSource
    ) {}

    getXEntityMap(): XEntityMap {
        let xEntityMap: XEntityMap | undefined = XUtilsMetadataCommon.getXEntityMap();
        if (xEntityMap === undefined) {
            xEntityMap = {};
            const entityMetadataList = this.dataSource.entityMetadatas;
            for (const entityMetadata of entityMetadataList) {
                if (!entityMetadata.isJunction) { // tabulky vytvorene manyToMany asociaciami nechceme
                    const xEntity: XEntity = this.getXEntityForEntityMetadata(entityMetadata);
                    xEntityMap[xEntity.name] = xEntity;
                }
            }
            XUtilsMetadataCommon.setXEntityMap(xEntityMap);
        }
        return xEntityMap;
    }

    private getXEntityForEntityMetadata(entityMetadata: EntityMetadata): XEntity {

        const fieldMap: XFieldMap = {};
        // entityMetadata.columns obsahuje aj asociacie (napr. ManyToOne), preto ich vyfiltrujeme
        let columnMetadataList: ColumnMetadata[] = entityMetadata.columns.filter((columnMetadata: ColumnMetadata) => columnMetadata.relationMetadata?.relationType === undefined);
        for (const columnMetadata of columnMetadataList) {
            const fieldName = columnMetadata.propertyName;
            // if (entityMetadata.name === 'Zmluva') {
            //     console.log("******** metadata for ************ " + entityMetadata.name + "." + fieldName);
            //     console.log("columnMetadata.relationMetadata = " + columnMetadata.relationMetadata?.relationType);
            //     //console.log(columnMetadata);
            // }
            let type = "unknown"; // default
            if (typeof columnMetadata.type === "string") {
                type = columnMetadata.type;
                // nech nemame na klientovi milion vseliakych databazovych typov, tak si prehodime niektore typy na javascript-ove, t.j. napr. string, number
                if (type === "character varying") {
                    type = "string";
                }
                else if (type === "int" || type === "integer") {
                    type = "number";
                }
                // entity generator pre postgres generuje pre db stlpce typu DECIMAL (financne sumy) typ numeric - na frontende pouzivame decimal
                else if (type === "numeric") {
                    type = "decimal";
                }
                // postgres nepouziva datetime ale timestamp, ale na klientovi riesime datetime stlpce pomocou typu datetime
                else if (type === "timestamp" || type === "timestamp without time zone") {
                    type = "datetime";
                }
            }
            else if (typeof columnMetadata.type === "function") {
                // ak nezapiseme do dekoratora @Column atribut type, zbieha tato vetva a ziskame typ atributu (string, number, ...) (plati napr. pre id-cka)
                // columnMetadata.type.toString() vracia napr. "function String() { [native code] }", resp. "function Number() { [native code] }"
                // vytiahneme odtial String
                const typeString: string = columnMetadata.type.toString();
                const parenthesePos = typeString.indexOf("()");
                if (parenthesePos !== -1) {
                    type = typeString.substring("function ".length, parenthesePos).toLowerCase();
                }
            }
            let length: number = parseInt(columnMetadata.length);
            if (isNaN(length)) {
                length = undefined;
            }
            let width: number = columnMetadata.width; // Podla dokumentacie sa width pouziva pri MySql (pri stlpci int). Ale v principe, co si tam zapiseme to tam bude. Ak nic nezapiseme, tak tam bude undefined.
            if (type === "number" && width === undefined) {
                width = 11; // tychto 11 je default pre int stlpce v MySql, pre ine databazy to nemusi platit
            }
            // poznamka: columnMetadata.isNullable - default je false, co nie je moc prijemne, vecsina stlpcov je nullable
            fieldMap[fieldName] = {name: fieldName, type: type, isNullable: columnMetadata.isNullable,
                                    length: length, precision: columnMetadata.precision, scale: columnMetadata.scale, width: width};
        }

        columnMetadataList = entityMetadata.primaryColumns;
        if (columnMetadataList.length !== 1) {
            throw "Entity " + entityMetadata.name + " has 0 or more then 1 primary column";
        }
        const idField = columnMetadataList[0].propertyName;

        const assocMap: XAssocMap = this.createAssocMap([...entityMetadata.manyToOneRelations, ...entityMetadata.oneToOneRelations, ...entityMetadata.oneToManyRelations, ...entityMetadata.manyToManyRelations]);
        return {name: entityMetadata.name, idField: idField, fieldMap: fieldMap, assocMap: assocMap};
    }

    private createAssocMap(relationMetadataList: RelationMetadata[]): XAssocMap {
        const assocMap: XAssocMap = {};
        for (const relationMetadata of relationMetadataList) {
            const assocName = relationMetadata.propertyName;
            const inverseAssoc = relationMetadata.inverseRelation?.propertyName;
            // poznamka: relationMetadata.isNullable - default je true (na rozdiel od columnMetadata!), ale mozno to v buducnosti zjednotia so stlpcami, takze je lepsie to vzdy explicitne uviest
            assocMap[assocName] = ({
                relationType: relationMetadata.relationType,
                name: assocName,
                entityName: relationMetadata.inverseEntityMetadata.name,
                inverseAssocName: inverseAssoc,
                isCascadeInsert: relationMetadata.isCascadeInsert,
                isCascadeUpdate: relationMetadata.isCascadeUpdate,
                isCascadeRemove: relationMetadata.isCascadeRemove,
                isNullable: relationMetadata.isNullable
            });
        }
        return assocMap;
    }

    // TODO - zrusit tieto metody a pouzivat priamo XUtilsMetadataCommon

    getXEntity(entity: string): XEntity {
        this.getXEntityMap(); // pre istotu, nech sa zoznam nainicializuje, ak treba
        return XUtilsMetadataCommon.getXEntity(entity);
    }

    getXField(xEntity: XEntity, field: string): XField {
        return XUtilsMetadataCommon.getXField(xEntity, field);
    }

    getXFieldByPath(xEntity: XEntity, path: string): XField {
        return XUtilsMetadataCommon.getXFieldByPath(xEntity, path);
    }

    getXAssocList(xEntity: XEntity, relationTypeList?: XRelationType[]): XAssoc[] {
        return XUtilsMetadataCommon.getXAssocList(xEntity, relationTypeList);
    }

    public getXAssoc(xEntity: XEntity, assocField: string, relationTypeList?: XRelationType[]): XAssoc {
        return XUtilsMetadataCommon.getXAssoc(xEntity, assocField, relationTypeList);
    }
}
