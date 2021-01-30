import { Injectable } from '@nestjs/common';
import {XAssocMap, XEntity, XEntityMap, XFieldMap} from "../serverApi/XEntityMetadata";
import {EntityMetadata, EntitySchema, getRepository, Repository} from "typeorm";
import {RelationMetadata} from "typeorm/metadata/RelationMetadata";
import {ColumnMetadata} from "typeorm/metadata/ColumnMetadata";

@Injectable()
export class XEntityMetadataService {

    private entityList: (string | Function | EntitySchema<any>)[];

    constructor(entityList: (string | Function | EntitySchema<any>)[]) {
        this.entityList = entityList;
    }

    getXEntityMap(): XEntityMap {
        const xEntityMap: XEntityMap = {};
        for (const entity of this.entityList) {
            const repository = getRepository(entity);
            const xEntity: XEntity = this.getXEntityForRepository(repository);
            xEntityMap[xEntity.name] = xEntity;
        }
        return xEntityMap;
    }

    getXEntity(entity: string): XEntity {
        const repository = getRepository(entity);
        return this.getXEntityForRepository(repository);
    }

    private getXEntityForRepository(repository: Repository<any>): XEntity {

        const entityMetadata: EntityMetadata = repository.metadata;

        const fieldMap: XFieldMap = {};
        let columnMetadataList: ColumnMetadata[] = entityMetadata.columns;
        // POZOR! aj asociacie (napr. ManyToOne) sem pridava!
        for (const columnMetadata of columnMetadataList) {
            const fieldName = columnMetadata.propertyName;
            let type = "unknown"; // default
            if (typeof columnMetadata.type === "string") {
                type = columnMetadata.type;
            }
            else if (typeof columnMetadata.type === "function") {
                // columnMetadata.type.toString() vracia napr. "function String() { [native code] }"
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
            fieldMap[fieldName] = {name: fieldName, type: type, isNullable: columnMetadata.isNullable,
                                    length: length, precision: columnMetadata.precision, scale: columnMetadata.scale};
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
            const inverseAssoc = relationMetadata.inverseRelation !== undefined ? relationMetadata.inverseRelation.propertyName : undefined;
            assocMap[assocName] = ({name: assocName, entityName: relationMetadata.inverseEntityMetadata.name, inverseAssocName: inverseAssoc});
        }
        return assocMap;
    }
}
