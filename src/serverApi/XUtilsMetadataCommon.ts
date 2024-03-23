import {XAssoc, XEntity, XEntityMap, XField, XRelationType} from "./XEntityMetadata";
import {XUtilsCommon} from "./XUtilsCommon";

/**
 * spolocna funkcionalita pre entity metadata vyuzivana na frontend-e aj backend-e
 * vznikla na zaklade XEntityMetadataService
 * tato funkcionalita by este mohla ist do tried XEntity, XField
 */
export class XUtilsMetadataCommon {
    // nacachovane metadata (setuju sa v zavolanim XUtilsMetadataCommon.setXEntityMap)
    private static xEntityMap: XEntityMap;

    static getXEntityMap(): XEntityMap | undefined {
        return XUtilsMetadataCommon.xEntityMap;
    }

    static setXEntityMap(xEntityMap: XEntityMap) {
        XUtilsMetadataCommon.xEntityMap = xEntityMap;
    }

    static getXEntity(entity: string): XEntity {
        if (!XUtilsMetadataCommon.xEntityMap) {
            throw `Unexpected error: XUtilsMetadataCommon.xEntityMap not initialised. Call XUtilsMetadataCommon.setXEntityMap first.`;
        }
        const xEntity: XEntity = XUtilsMetadataCommon.xEntityMap[entity];
        if (xEntity === undefined) {
            throw `Entity ${entity} was not found in entity metadata`;
        }
        return xEntity;
    }

    static getXFieldBase(xEntity: XEntity, field: string): XField | undefined {
        // TODO - pozor, vo fieldMap su aj asociacie, trebalo by zmenit vytvaranie metadat tak aby tam tie asociacie neboli
        return xEntity.fieldMap[field];
    }

    static getXField(xEntity: XEntity, field: string): XField {
        const xField: XField | undefined = XUtilsMetadataCommon.getXFieldBase(xEntity, field);
        if (xField === undefined) {
            throw `Field ${field} was not found in entity ${xEntity.name}`;
        }
        return xField;
    }

    static getXFieldByPathBase(xEntity: XEntity, path: string): XField | undefined {
        const [field, restPath] = XUtilsCommon.getFieldAndRestPath(path);
        if (restPath === null) {
            return XUtilsMetadataCommon.getXFieldBase(xEntity, field);
        }
        else {
            const xAssoc: XAssoc | undefined = XUtilsMetadataCommon.getXAssocBase(xEntity, field);
            if (xAssoc) {
                const xAssocEntity = XUtilsMetadataCommon.getXEntity(xAssoc.entityName);
                return XUtilsMetadataCommon.getXFieldByPathBase(xAssocEntity, restPath);
            }
            else {
                return undefined;
            }
        }
    }

    static getXFieldByPath(xEntity: XEntity, path: string): XField {
        const [field, restPath] = XUtilsCommon.getFieldAndRestPath(path);
        if (restPath === null) {
            return XUtilsMetadataCommon.getXField(xEntity, field);
        }
        else {
            const xAssoc: XAssoc = XUtilsMetadataCommon.getXAssoc(xEntity, field);
            const xAssocEntity = XUtilsMetadataCommon.getXEntity(xAssoc.entityName);
            return XUtilsMetadataCommon.getXFieldByPath(xAssocEntity, restPath);
        }
    }

    static getXFieldByPathStr(entity: string, path: string): XField {
        return XUtilsMetadataCommon.getXFieldByPath(XUtilsMetadataCommon.getXEntity(entity), path);
    }

    static getXAssocBase(xEntity: XEntity, assocField: string): XAssoc | undefined {
        return xEntity.assocMap[assocField];
    }

    static getXAssocByPath(xEntity: XEntity, path: string): XAssoc {
        const [field, restPath] = XUtilsCommon.getFieldAndRestPath(path);
        if (restPath === null) {
            return XUtilsMetadataCommon.getXAssoc(xEntity, field);
        }
        else {
            const xAssoc: XAssoc = XUtilsMetadataCommon.getXAssoc(xEntity, field);
            const xAssocEntity = XUtilsMetadataCommon.getXEntity(xAssoc.entityName);
            return XUtilsMetadataCommon.getXAssocByPath(xAssocEntity, restPath);
        }
    }

    // for path assoc1.assoc2.field returns assoc2 (last assoc before field)
    static getLastXAssocByPath(xEntity: XEntity, path: string): XAssoc {
        const pathToAssoc: string = XUtilsCommon.getPathToAssoc(path);
        return XUtilsMetadataCommon.getXAssocByPath(xEntity, pathToAssoc);
    }

    static getXAssocToOne(xEntity: XEntity, assocField: string): XAssoc {
        return XUtilsMetadataCommon.getXAssoc(xEntity, assocField, ["many-to-one", "one-to-one"]);
    }

    static getXAssocToMany(xEntity: XEntity, assocField: string): XAssoc {
        return XUtilsMetadataCommon.getXAssoc(xEntity, assocField, ["one-to-many", "many-to-many"]);
    }

    static getXAssocToOneByAssocEntity(xEntity: XEntity, assocEntityName: string): XAssoc {
        return XUtilsMetadataCommon.getXAssocByAssocEntity(xEntity, assocEntityName, ["many-to-one", "one-to-one"]);
    }

    static getXAssocToManyByAssocEntity(xEntity: XEntity, assocEntityName: string): XAssoc {
        return XUtilsMetadataCommon.getXAssocByAssocEntity(xEntity, assocEntityName, ["one-to-many", "many-to-many"]);
    }

    static getXEntityForAssocToOne(xEntity: XEntity, assocField: string): XEntity {
        return XUtilsMetadataCommon.getXEntityForAssoc(XUtilsMetadataCommon.getXAssocToOne(xEntity, assocField));
    }

    static getXEntityForAssocToMany(xEntity: XEntity, assocField: string): XEntity {
        return XUtilsMetadataCommon.getXEntityForAssoc(XUtilsMetadataCommon.getXAssocToMany(xEntity, assocField));
    }

    static getXFieldList(xEntity: XEntity): XField[] {
        const xFieldList: XField[] = [];
        for (const [key, xField] of Object.entries(xEntity.fieldMap)) {
            // assoc fieldy sa nachadzaju aj v xEntity.fieldMap ako typ number (netusim preco), preto ich vyfiltrujeme
            if (xEntity.assocMap[xField.name] === undefined) {
                xFieldList.push(xField);
            }
        }
        return xFieldList;
    }

    static getXAssocList(xEntity: XEntity, relationTypeList?: XRelationType[]): XAssoc[] {
        //const xAssocList: XAssoc[] = Array.from(xEntity.assocMap, (v: XAssoc, k: string) => v);
        const xAssocList: XAssoc[] = [];
        for (const [key, xAssoc] of Object.entries(xEntity.assocMap)) {
            if (relationTypeList === undefined || relationTypeList.includes(xAssoc.relationType)) {
                xAssocList.push(xAssoc);
            }
        }
        return xAssocList;
    }

    static getXAssoc(xEntity: XEntity, assocField: string, relationTypeList?: XRelationType[]): XAssoc {
        const xAssoc: XAssoc | undefined = XUtilsMetadataCommon.getXAssocBase(xEntity, assocField);
        if (xAssoc === undefined) {
            throw `Assoc ${assocField} was not found in entity = ${xEntity.name}`;
        }
        // relationTypeList is optional and is only for check (not to get some unwanted type of assoc)
        if (relationTypeList !== undefined && !relationTypeList.includes(xAssoc.relationType)) {
            throw `Assoc ${assocField} in entity ${xEntity.name} is of type ${xAssoc.relationType} and required type is ${JSON.stringify(relationTypeList)}`;
        }
        return xAssoc;
    }

    private static getXAssocByAssocEntity(xEntity: XEntity, assocEntityName: string, relationTypeList?: XRelationType[]): XAssoc {
        let xAssocFound: XAssoc | undefined = undefined;
        for (const [key, xAssoc] of Object.entries(xEntity.assocMap)) {
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
        // relationTypeList is optional and is only for check (not to get some unwanted type of assoc)
        if (relationTypeList !== undefined && !relationTypeList.includes(xAssocFound.relationType)) {
            throw `Assoc for assocEntityName = ${assocEntityName} in entity ${xEntity.name} is of type ${xAssocFound.relationType} and required type is ${JSON.stringify(relationTypeList)}`;
        }
        return xAssocFound;
    }

    private static getXEntityForAssoc(xAssoc: XAssoc): XEntity {
        return XUtilsMetadataCommon.getXEntity(xAssoc.entityName);
    }
}
