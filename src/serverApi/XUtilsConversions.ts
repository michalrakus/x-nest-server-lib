import {dateFormat, XUtilsCommon} from "./XUtilsCommon";
import {XAssoc, XEntity, XField} from "./XEntityMetadata";
import {XUtilsMetadataCommon} from "./XUtilsMetadataCommon";
import {IPostgresInterval} from "postgres-interval";

export function stringFromUI(stringValue: string): string | null {
    let value: string | null;
    if (stringValue === '') {
        value = null;
    }
    else {
        value = stringValue;
    }
    return value;
}

export function stringAsUI(value: string | null): string {
    return value !== null ? value : "";
}

// aby sme sa vyhli sql injection problemu - tam kde je problematicke pouzivat klasicke params
export function stringAsDB(value: string | null): string {
    return value !== null ? `'${value.replaceAll("'", "''")}'` : "NULL";
}

export function intFromUI(stringValue: string): number | null | undefined {
    // convert stringValue (e.g. 1234) into integer number
    // if stringValue is invalid, returns undefined
    let value: number | null | undefined = undefined;
    if (stringValue === '') {
        value = null;
    }
    else {
        if (XUtilsCommon.isInt(stringValue)) {
            // 1234xxx vrati number 1234, preto sme spravili test isInt
            value = parseInt(stringValue, 10);
            if (isNaN(value)) {
                value = undefined;
            }
        }
    }
    return value;
}

export function numberAsUI(value: number | null, fractionDigits?: number): string {
    if (fractionDigits === undefined) {
        fractionDigits = 2; // default
    }
    if (value !== null) {
        return value.toLocaleString('de-DE', {style: 'decimal', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits});
    }
    else {
        return "";
    }
}

// v modeli na klientovi by mal byt vzdy number, teraz je tam niekedy string (z json-u zo servera) a niekedy number (z komponentu)
// provizorne zatial takato konverzia
export function numberFromModel(value: any): number | null {
    let numberValue: number | null = null;
    if (typeof value === 'string') {
        numberValue = parseFloat(value);
    }
    else if (typeof value === 'number') {
        numberValue = value;
    }
    return numberValue;
}

// v modeli na klientovi by mal byt vzdy Date, teraz je tam niekedy string (z json-u zo servera) a niekedy Date (z komponentu)
// provizorne zatial takato konverzia
export function dateFromModel(value: any): Date | null {
    let dateValue: Date | null = null;
    if (typeof value === 'string') {
        dateValue = new Date(value);
    }
    else if (typeof value === 'object' && value instanceof Date) {
        dateValue = value;
    }
    return dateValue;
}

export function dateFromUI(valueString: string): Date | null | undefined {
    // converts valueString (e.g. 21.2.2024) into Date
    // if stringValue is invalid, returns undefined
    let valueDate: Date | null | undefined = undefined;
    if (valueString === '') {
        valueDate = null;
    }
    else {
        // null znamena nezadane (doplni sa podla aktualneho datumu), undefined znamena zadana nekorektna hodnota
        let day: number | null | undefined;
        let month: number | null | undefined = null;
        let year: number | null | undefined = null;

        const posDot = valueString.indexOf('.');
        if (posDot === -1) {
            day = intFromUI(valueString);
        }
        else {
            day = intFromUI(valueString.substring(0, posDot));
            const rest: string = valueString.substring(posDot + 1);
            const posDot2 = rest.indexOf('.');
            if (posDot2 === -1) {
                month = intFromUI(rest);
            }
            else {
                month = intFromUI(rest.substring(0, posDot2));
                year = intFromUI(rest.substring(posDot2 + 1));
            }
        }

        // doplnime mesiac a rok ak uzivatel nezadal (ak mame undefined, tak umyselne nedoplname)
        if (month === null) {
            month = XUtilsCommon.today().getMonth() + 1; // o 1 mesiac viac (januar je 0)
        }
        if (year === null) {
            year = XUtilsCommon.today().getFullYear();
        }

        // ak day alebo month alebo year zostal undefined, tak user zadal nekorektnu hodnotu - vratime undefined
        if (day && month && year) {
            let monthStr: string = month.toString();
            if (monthStr.length < 2) {
                monthStr = "0" + monthStr;
            }
            let dayStr: string = day.toString();
            if (dayStr.length < 2) {
                dayStr = "0" + dayStr;
            }
            valueDate = new Date(`${year}-${monthStr}-${dayStr}`);
            if (isNaN(valueDate as any)) {
                // ak je nekorektny datum (napr. 2024-13-01)
                valueDate = undefined;
            }
        }
    }
    return valueDate;
}


export function dateAsUI(value: Date | null): string {
    if (value !== null) {
        return dateFormat(value, dateFormatUI());
    }
    else {
        return "";
    }
}

export function datetimeAsUI(value: Date | null): string {
    if (value !== null) {
        return dateFormat(value, datetimeFormatUI());
    }
    else {
        return "";
    }
}

// provizorne zatial takato konverzia
export function timeFromModel(value: any): Date | null {
    let timeValue: Date | null = null;
    if (typeof value === 'string') {
        // ak prichadza cas priamo z databazy, pride '19:30:00'
        // ak prichadza reloadnuty objekt (napr. cez webservis saveRow), pride '2021-06-07 19:30:00'
        let rowDataCasStr = value;
        if (rowDataCasStr.length < 10) {
            // mame '19:30:00' -> pridame hociaky rok aby sme skonvertovali na validny Date
            rowDataCasStr = '1970-01-01 ' + rowDataCasStr;
        }
        // na safari nefunguje konverzia new Date('2021-06-07 19:30:00') - vrati NaN
        // preto string prehodime na '2021-06-07T19:30:00+01:00'
        // 19:30:00 je cas z timezony Central Europe (taka je nastavena na nodejs)), preto oznacime tento cas touto timezonou
        // (spravne riesenie je posielat time cez json vzdy vo formate '2021-06-07T18:30:00Z', v tomto formate chodia aj datetime atributy)
        rowDataCasStr = rowDataCasStr.replace(' ', 'T');
        if (!rowDataCasStr.endsWith('Z') && rowDataCasStr.indexOf('+') === -1) {
            rowDataCasStr += '+01:00'; // Central Europe timezone
        }
        timeValue = new Date(rowDataCasStr);
    }
    else if (typeof value === 'object' && value instanceof Date) {
        timeValue = value;
    }
    return timeValue;
}

export function dateFormatUI(): string {
    return "dd.mm.yyyy";
}

export function dateFormatCalendar(): string {
    return "dd.mm.yy";
}

export function datetimeFormatUI(): string {
    return "dd.mm.yyyy HH:MM:ss";
}

export function intervalFromUI(valueString: string): IPostgresInterval | null | undefined {
    // convert e.target.value (e.g. 10:29) into IPostgresInterval (e.g. {hours: 10, minutes: 29})
    // if stringValue is invalid, returns undefined
    let valueInterval: IPostgresInterval | null | undefined = undefined;
    if (valueString === '') {
        valueInterval = null;
    }
    else {
        const posColon = valueString.indexOf(':');
        if (posColon === -1) {
            let minutes: number = parseInt(valueString);
            if (!isNaN(minutes)) {
                const hours = Math.floor(minutes / 60);
                minutes = minutes - (hours * 60);
                valueInterval = {hours: hours, minutes: minutes} as IPostgresInterval;
            }
        }
        else {
            let hours: number = parseInt(valueString.substring(0, posColon));
            let minutes: number = parseInt(valueString.substring(posColon + 1));
            if (!isNaN(hours) && !isNaN(minutes)) {
                if (minutes >= 60) {
                    const hoursFromMinutes = Math.floor(minutes / 60);
                    hours += hoursFromMinutes;
                    minutes = minutes - (hoursFromMinutes * 60);
                }
                valueInterval = {hours: hours, minutes: minutes} as IPostgresInterval;
            }
        }
    }
    return valueInterval;
}

export function intervalAsUI(valueInterval: IPostgresInterval | null): string {
    // conversion e.g. {hours: 10, minutes: 29} => '10:29'
    let valueString: string;
    if (valueInterval !== null) {
        let hours: number = valueInterval.hours ?? 0;
        const minutes: number = valueInterval.minutes ?? 0;
        //const seconds: number = value.seconds ?? 0;
        if (valueInterval.days) {
            hours += valueInterval.days * 24;
        }
        valueString = `${hours.toString()}:${minutes.toString().padStart(2, '0')}`;
    }
    else {
        valueString = ''; // null
    }
    return valueString;
}

export function booleanAsUIText(value: boolean | null): string {
    if (value !== null) {
        // TODO - xLocaleOption for backend
        //return value ? xLocaleOption('yes') : xLocaleOption('no');
        return value ? 'yes' : 'no';
    }
    else {
        return "";
    }
}

export enum AsUIType {
    Form = 1, // formulare - boolean sa ponecha, neskor sa konvertuje na Checkbox
    Text = 2,  // reporty - boolean sa konvertuje na ano/nie
    Excel = 3  // excel - nie vsetko konvertujeme do string-u, vecsinou zostavame pri typoch number, Date
}

/**
 * converts values of object
 *
 * @param entity
 * @param object
 * @param fromModel
 * @param asUI
 */
export function convertObject(entity: string, object: any, fromModel: boolean, asUI: AsUIType | undefined) {

    const xEntity: XEntity = XUtilsMetadataCommon.getXEntity(entity);

    for (const [field, value] of Object.entries(object)) {
        const xField: XField | undefined = XUtilsMetadataCommon.getXFieldBase(xEntity, field);
        if (xField) {
            object[field] = convertValue(xField, value, fromModel, asUI);
        }
        else {
            // nenasli sme medzi fieldami, skusime hladat xAssoc
            const xAssoc: XAssoc | undefined = XUtilsMetadataCommon.getXAssocBase(xEntity, field);
            if (xAssoc) {
                if (value) {
                    if (xAssoc.relationType === "many-to-one" || xAssoc.relationType === "one-to-one") {
                        convertObject(xAssoc.entityName, value, fromModel, asUI);
                    }
                    else if (xAssoc.relationType === "one-to-many" || xAssoc.relationType === "many-to-many") {
                        if (!Array.isArray(value)) {
                            throw `Unexpected error: entity ${entity} - field ${field} is expected to be array`;
                        }
                        for (const valueItem of value) {
                            convertObject(xAssoc.entityName, valueItem, fromModel, asUI);
                        }
                    }
                }
            }
        }
    }

}

export function convertValue(xField: XField, value: any, fromModel: boolean, asUI: AsUIType | undefined): any {
    return convertValueBase(xField.type, xField.scale, value, fromModel, asUI);
}

export function convertValueBase(fieldType: string, fractionDigits: number | undefined, value: any, fromModel: boolean, asUI: AsUIType | undefined): any {
    if (fieldType === "decimal") {
        if (fromModel) {
            value = numberFromModel(value);
        }
        if (asUI && asUI !== AsUIType.Excel) {
            value = numberAsUI(value, fractionDigits);
        }
    }
    else if (fieldType === "date") {
        if (fromModel) {
            value = dateFromModel(value);
        }
        if (asUI && asUI !== AsUIType.Excel) {
            value = dateAsUI(value);
        }
    }
    else if (fieldType === "datetime") {
        if (fromModel) {
            value = dateFromModel(value);
        }
        if (asUI) {
            value = datetimeAsUI(value);
        }
    }
    else if (fieldType === "interval") {
        // konverziu z modelu (json objekt-u) netreba
        if (asUI) {
            value = intervalAsUI(value);
        }
    }
    else if (fieldType === "boolean") {
        // konverziu z modelu (json objekt-u) netreba
        // pre AsUIType.Form ponechame typ boolean (spracujeme neskor)
        if (asUI === AsUIType.Text || asUI === AsUIType.Excel) {
            value = booleanAsUIText(value);
        }
    }
    else {
        // vsetko ostatne
        if (asUI && asUI !== AsUIType.Excel) {
            value = value ? value.toString() : "";
        }
    }
    return value;
}