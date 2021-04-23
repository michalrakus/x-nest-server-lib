
// funkcie spolocne pre Web i pre Server
export class XUtilsCommon {

    static newLine: string = '\n';

    // TODO - toto by sme mohli doplnit o kontrolu ak programator urobil preklep
    static getValueByPath(object: any, path: string): any {
        const [field, restPath] = XUtilsCommon.getFieldAndRestPath(path);
        if (restPath === null) {
            return object[field];
        }
        else {
            const assocObject = object[field];
            // pri vytvarani noveho riadku - assocObject neni v novom objekte ani ako null (je undefined)
            if (assocObject !== null && assocObject !== undefined) {
                return XUtilsCommon.getValueByPath(assocObject, restPath);
            }
            else {
                return null; // asociovany objekt je null, aj hodnota atributu bude null
            }
        }
    }

    static getFieldListForPath(path: string): string[] {
        return path.split('.');
    }

    static getFieldAndRestPath(path: string): [string, string | null] {
        const posDot : number = path.indexOf(".");
        if (posDot === -1) {
            return [path, null];
        }
        else {
            const assocField = path.substring(0, posDot);
            const restPath = path.substring(posDot + 1);
            return [assocField, restPath];
        }
    }

    static objectAsJSON(value: any): string {

        // sem treba dat nejaku pre nas vhodnu serializaciu
        // zatial provizorne robene cez antipatern - modifikaciu prototype funcii primitivnych typov
        // TODO - bud pouzit nejaky serializator alebo nakodit vlastnu rekurzivnu iteraciu objektov alebo pouzit druhy parameter v JSON.stringify - konvertovaciu funkciu

        const dateToJSONOriginal = Date.prototype.toJSON;
        Date.prototype.toJSON = function () {
            // TODO - ak pre datetime nastavime vsetky zlozky casu na 00:00:00, tak sformatuje hodnotu ako datum a spravi chybu pri zapise do DB - zapise  1:00:00
            let dateStr: string;
            if (this.getHours() === 0 && this.getMinutes() === 0 && this.getSeconds() === 0) {
                dateStr = dateFormat(this, 'yyyy-mm-dd');
            }
            else {
                // jedna sa o datetime
                dateStr = dateFormat(this, 'yyyy-mm-dd HH:MM:ss');
            }
            return dateStr;
        }

        const json: string = JSON.stringify(value);

        // vratime naspet povodnu funkciu
        Date.prototype.toJSON = dateToJSONOriginal;

        return json;
    }
}

// nevedel som importnut dateFormat, tak som to dal sem aby som nemusel vsade pouzivat require("dateformat")
export const dateFormat = require("dateformat");
