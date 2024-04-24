
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

    // vseobecnejsia verzia, ktora funguje aj pre *toMany asociacie
    // TODO - toto by sme mohli doplnit o kontrolu ak programator urobil preklep
    static getValueOrValueListByPath(object: any, path: string): any | any[] {
        const [field, restPath] = XUtilsCommon.getFieldAndRestPath(path);
        if (restPath === null) {
            return object[field];
        }
        else {
            const assocObject = object[field];
            if (Array.isArray(assocObject)) {
                // natrafili sme na pole (atribut "field" je *toMany asociacia), pozbierame hodnoty z pola
                const resultValueList: any[] = [];
                for (const assocObjectItem of assocObject) {
                    if (assocObjectItem !== null && assocObjectItem !== undefined) { // pre istotu, nemalo by nastat
                        const itemValue: any | any[] = XUtilsCommon.getValueOrValueListByPath(assocObjectItem, restPath);
                        if (Array.isArray(itemValue)) {
                            resultValueList.push(...itemValue);
                        }
                        else {
                            resultValueList.push(itemValue);
                        }
                    }
                    else {
                        resultValueList.push(null);
                    }
                }
                return resultValueList;
            }
            else {
                // pri vytvarani noveho riadku - assocObject neni v novom objekte ani ako null (je undefined)
                if (assocObject !== null && assocObject !== undefined) {
                    return XUtilsCommon.getValueOrValueListByPath(assocObject, restPath);
                }
                else {
                    return null; // asociovany objekt je null, aj hodnota atributu bude null
                }
            }
        }
    }

    static setValueByPath(object: any, path: string, value: any) {
        const [pathToAssoc, field]: [string | null, string] = XUtilsCommon.getPathToAssocAndField(path);
        if (pathToAssoc !== null) {
            const assocObject = XUtilsCommon.getValueByPath(object, pathToAssoc);
            // if null or undefined or is not object, then error
            if (assocObject === null || assocObject === undefined || typeof assocObject !== 'object') {
                console.log(`XUtilsCommon.setValueByPath: could not set value ${value} into object property ${path}. Assoc object not found (found value: ${assocObject}). Main object:`);
                console.log(object);
                throw `setValueByPath: could not set value ${value} into object property ${path}. Assoc object not found. The main object can be seen in log.`;
            }
            object = assocObject;
        }
        object[field] = value;
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

    static getPathToAssoc(path: string): string {
        const posDot : number = path.lastIndexOf(".");
        if (posDot === -1) {
            throw `Path to assoc could not be retrieved. Path ${path} must have at least 2 items.`;
        }
        else {
            return path.substring(0, posDot);
        }
    }

    static getPathToAssocAndField(path: string): [string | null, string] {
        const posDot : number = path.lastIndexOf(".");
        if (posDot === -1) {
            return [null, path];
        }
        else {
            return [path.substring(0, posDot), path.substring(posDot + 1)];
        }
    }

    static isSingleField(path: string): boolean {
        return path.indexOf(".") === -1;
    }

    static getPrefixAndField(path: string): [string | null, string] {
        const posDot: number = path.indexOf(":");
        if (posDot === -1) {
            return [null, path];
        }
        else {
            const prefix = path.substring(0, posDot);
            const pathOnly = path.substring(posDot + 1);
            return [prefix, pathOnly];
        }
    }

    static createDisplayValue(object: any, fields: string[]): string {
        let displayValue: string = "";
        for (const field of fields) {
            // TODO - konverzie na spravny typ/string
            const [prefix, fieldOnly]: [string | null, string] = XUtilsCommon.getPrefixAndField(field);
            const value: any = XUtilsCommon.getValueByPath(object, fieldOnly);
            if (value !== null && value !== undefined) {
                const valueStr: string = value.toString(); // TODO - spravnu konverziu
                if (valueStr !== "") {
                    if (displayValue !== "") {
                        displayValue += " ";
                    }
                    if (prefix) {
                        displayValue += prefix;
                    }
                    displayValue += valueStr;
                }
            }
        }
        return displayValue;
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

    static arrayCreateMap<ID, T>(array: T[], idField: string): Map<ID, T> {

        const idRowMap: Map<ID, T> = new Map<ID, T>();
        for (const row of array) {
            if (row) {
                idRowMap.set((row as any)[idField], row);
            }
        }

        return idRowMap;
    }

    static getDayName(date: Date | null | undefined): string | undefined {
        const days = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
        return date ? days[date.getDay()] : undefined;
    }

    static dateAddDays(date: Date | null, days: number): Date | null {
        let result = null;
        if (date !== null) {
            result = new Date(date);
            result.setDate(result.getDate() + days);
        }
        return result;
    }

    static dateAddMonths(date: Date | null, months: number): Date | null {
        let result = null;
        if (date !== null) {
            result = new Date(date);
            result.setMonth(result.getMonth() + months);
        }
        return result;
    }

    // helper method, because date1 === date2 compares pointers, not values (Date is not primitive type like string or number)
    static dateEquals(date1: Date | null, date2: Date | null): boolean {
        let result: boolean = false;
        if (date1 === null && date2 === null) {
            result = true;
        }
        else if (date1 !== null && date2 !== null) {
            result = (date1.getTime() === date2.getTime());
        }
        return result;
    }

    // solution from internet
    static dateDiffInYears(dateOld: Date | null, dateNew: Date | null): number | null {
        let diff: number | null = null;
        if (dateOld !== null && dateNew !== null) {
            const yearNew: number = dateNew.getFullYear();
            const monthNew: number = dateNew.getMonth();
            const dayNew: number = dateNew.getDate();
            const yearOld: number = dateOld.getFullYear();
            const monthOld: number = dateOld.getMonth();
            const dayOld: number = dateOld.getDate();
            diff = yearNew - yearOld;
            if (monthOld > monthNew) {
                diff--;
            }
            else {
                if (monthOld === monthNew) {
                    if (dayOld > dayNew) {
                        diff--;
                    }
                }
            }
        }
        return diff;
    }

    // returns month diff for 2 dates of type month (YYYY-MM-01) - days are ignored
    static monthDiff(monthOld: Date | null, monthNew: Date | null): number | null {
        let diff: number | null = null;
        if (monthOld !== null && monthNew !== null) {
            const yearCountNew: number = monthNew.getFullYear();
            const monthCountNew: number = monthNew.getMonth();
            const yearCountOld: number = monthOld.getFullYear();
            const monthCountOld: number = monthOld.getMonth();
            diff = (yearCountNew - yearCountOld) * 12 + (monthCountNew - monthCountOld);
        }
        return diff;
    }

    static findFirstMatch(pattern: RegExp, value: string): string | null {
        const match: RegExpExecArray | null = pattern.exec(value);
        return match != null ? match[0] : null;
    }

    // to be used in sql expressions
    static sqlMaxDateIfNull(sqlExp: string): string {
        return `coalesce(${sqlExp}, '9999-12-31'::DATE)`;
    }

    static today(): Date {
        const today = new Date();
        // vynulujeme casovu zlozku
        // poznamka: Date vzdy obsahuje aj casovu zlozku. Nase konverzne funkcie dateFromModel a dateFromUI pouzivaju konverziu new Date('YYYY-MM-DD')
        // a tato konverzia vytvara datum s GMT/UTC/Z casom 00:00:00 (stredoeuropsky 00:01:00 - akokeby sme zadavali new Date('YYYY-MM-DDT00:00:00Z'))
        //today.setHours(0, 0, 0, 0); // nastavi cas 00:00:00 v aktualnej timezone (stredoeuropsky 00:00:00, GMT 23:00:00)
        // - potom nam nefunguje porovnavanie s datumami vytvorenymi cez funkcie dateFromModel a dateFromUI
        today.setUTCHours(0, 0, 0, 0);
        return today;
    }

    // vrati true ak sa string sklada iba z cislic, moze mat + alebo - na zaciatku
    static isInt(stringValue: string): boolean {
        return /^[-+]?\d+$/.test(stringValue);
    }
}

// nevedel som importnut dateFormat, tak som to dal sem aby som nemusel vsade pouzivat require("dateformat")
export const dateFormat = require("dateformat");
