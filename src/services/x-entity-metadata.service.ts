import { Injectable } from '@nestjs/common';
import {XAssoc, XAssocMap, XEntity, XEntityMap, XField, XFieldMap} from "../serverApi/XEntityMetadata";
import {DataSource, EntityMetadata, EntitySchema} from "typeorm";
import {RelationMetadata} from "typeorm/metadata/RelationMetadata";
import {ColumnMetadata} from "typeorm/metadata/ColumnMetadata";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";
import {MixedList} from "typeorm/common/MixedList";

@Injectable()
export class XEntityMetadataService {

    private entityList: MixedList<Function | string | EntitySchema>;

    // nacachovane metadata
    private xEntityMap: XEntityMap;

    constructor(
        private readonly dataSource: DataSource
    ) {}

    getXEntityMap(): XEntityMap {
        if (this.xEntityMap === undefined) {
            this.xEntityMap = {};
            const entityMetadataList = this.dataSource.entityMetadatas;
            for (const entityMetadata of entityMetadataList) {
                const xEntity: XEntity = this.getXEntityForEntityMetadata(entityMetadata);
                this.xEntityMap[xEntity.name] = xEntity;
            }
        }
        return this.xEntityMap;
    }

    private getXEntityForEntityMetadata(entityMetadata: EntityMetadata): XEntity {

        const fieldMap: XFieldMap = {};
        let columnMetadataList: ColumnMetadata[] = entityMetadata.columns;
        // POZOR! aj asociacie (napr. ManyToOne) sem pridava!
        for (const columnMetadata of columnMetadataList) {
            const fieldName = columnMetadata.propertyName;
            // if (entityMetadata.name === 'XBrowseMeta' || entityMetadata.name === 'XColumnMeta') {
            //     console.log("******** metadata for ************ " + entityMetadata.name + "." + fieldName);
            //     console.log(columnMetadata);
            // }
            let type = "unknown"; // default
            if (typeof columnMetadata.type === "string") {
                type = columnMetadata.type;
                // nech nemame na klientovi milion vseliakych databazovych typov, tak si prehodime niektore typy na javascript-ove, t.j. napr. string, number
                if (type === "int") {
                    type = "number";
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

        // TODO - este chyba ManyToMany
        const assocToOneMap: XAssocMap = this.createAssocMap([...entityMetadata.manyToOneRelations, ...entityMetadata.oneToOneRelations]);
        const assocToManyMap: XAssocMap = this.createAssocMap(entityMetadata.oneToManyRelations);
        return {name: entityMetadata.name, idField: idField, fieldMap: fieldMap, assocToOneMap: assocToOneMap, assocToManyMap: assocToManyMap};
    }

    private createAssocMap(relationMetadataList: RelationMetadata[]): XAssocMap {
        const assocMap: XAssocMap = {};
        for (const relationMetadata of relationMetadataList) {
            const assocName = relationMetadata.propertyName;
            const inverseAssoc = relationMetadata.inverseRelation?.propertyName;
            // poznamka: relationMetadata.isNullable - default je true (na rozdiel od columnMetadata!), ale mozno to v buducnosti zjednotia so stlpcami, takze je lepsie to vzdy explicitne uviest
            assocMap[assocName] = ({name: assocName, entityName: relationMetadata.inverseEntityMetadata.name, inverseAssocName: inverseAssoc, isNullable: relationMetadata.isNullable});
        }
        return assocMap;
    }

    // *** metody odtialto su ekvivalentne metodam na klientovi v triede XUtilsMetadata.ts ***

    getXEntity(entity: string): XEntity {
        const xEntityMap: XEntityMap = this.getXEntityMap();
        const xEntity: XEntity = xEntityMap[entity];
        if (xEntity === undefined) {
            throw `Entity ${entity} was not found in entity metadata`;
        }
        return xEntity;
    }

    getXField(xEntity: XEntity, field: string): XField {
        // TODO - pozor, vo fieldMap su aj asociacie, trebalo by zmenit vytvaranie metadat tak aby tam tie asociacie neboli
        const xField: XField = xEntity.fieldMap[field];
        if (xField === undefined) {
            throw `Field ${field} was not found in entity ${xEntity.name}`;
        }
        return xField;
    }

    getXFieldByPath(xEntity: XEntity, path: string): XField {
        const [field, restPath] = XUtilsCommon.getFieldAndRestPath(path);
        if (restPath === null) {
            return this.getXField(xEntity, field);
        }
        else {
            const xAssoc: XAssoc = this.getXAssocToOne(xEntity, field);
            const xAssocEntity = this.getXEntity(xAssoc.entityName);
            return this.getXFieldByPath(xAssocEntity, restPath);
        }
    }

    getXFieldByPathStr(entity: string, path: string): XField {
        return this.getXFieldByPath(this.getXEntity(entity), path);
    }

    getXAssocToOne(xEntity: XEntity, assocField: string): XAssoc {
        return this.getXAssoc(xEntity, xEntity.assocToOneMap, assocField);
    }

    getXAssocToMany(xEntity: XEntity, assocField: string): XAssoc {
        return this.getXAssoc(xEntity, xEntity.assocToManyMap, assocField);
    }

    getXAssocToOneByAssocEntity(xEntity: XEntity, assocEntityName: string): XAssoc {
        return this.getXAssocByAssocEntity(xEntity, xEntity.assocToOneMap, assocEntityName);
    }

    getXAssocToManyByAssocEntity(xEntity: XEntity, assocEntityName: string): XAssoc {
        return this.getXAssocByAssocEntity(xEntity, xEntity.assocToManyMap, assocEntityName);
    }

    getXEntityForAssocToOne(xEntity: XEntity, assocField: string): XEntity {
        return this.getXEntityForAssoc(this.getXAssocToOne(xEntity, assocField));
    }

    getXEntityForAssocToMany(xEntity: XEntity, assocField: string): XEntity {
        return this.getXEntityForAssoc(this.getXAssocToMany(xEntity, assocField));
    }

    getXFieldList(xEntity: XEntity): XField[] {
        const xFieldList: XField[] = [];
        for (const [key, xField] of Object.entries(xEntity.fieldMap)) {
            // assoc fieldy sa nachadzaju aj v xEntity.fieldMap ako typ number (netusim preco), preto ich vyfiltrujeme
            if (xEntity.assocToOneMap[xField.name] === undefined) {
                xFieldList.push(xField);
            }
        }
        return xFieldList;
    }

    private getXAssoc(xEntity: XEntity, assocMap: XAssocMap, assocField: string): XAssoc {
        const xAssoc: XAssoc = assocMap[assocField];
        if (xAssoc === undefined) {
            throw `Assoc ${assocField} was not found in entity = ${xEntity.name}`;
        }
        return xAssoc;
    }

    private getXAssocByAssocEntity(xEntity: XEntity, assocMap: XAssocMap, assocEntityName: string): XAssoc {
        let xAssocFound: XAssoc | undefined = undefined;
        for (const [key, xAssoc] of Object.entries(assocMap)) {
            if (xAssoc.entityName === assocEntityName) {
                if (xAssocFound === undefined) {
                    xAssocFound = xAssoc;
                }
                else {
                    throw `In entity ${xEntity.name} found more then 1 assoc for assocEntityName = ${assocEntityName}`;
                }
            }
        }
        if (xAssocFound === undefined) {
            throw `Assoc for assocEntityName = ${assocEntityName} not found in entity ${xEntity.name}`;
        }
        return xAssocFound;
    }

    private getXEntityForAssoc(xAssoc: XAssoc): XEntity {
        return this.getXEntity(xAssoc.entityName);
    }
}
