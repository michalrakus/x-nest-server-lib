import {XUtilsCommon} from "./XUtilsCommon";
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

// konvertuje hodnotu napr. 12.34
export function numberFromString(valueString: string): number | null {
    let numberValue: number | null = parseFloat(valueString);
    if (isNaN(numberValue)) {
        numberValue = null;
    }
    return numberValue;
}

// upresnenie typu datumu - pouzivame typ number, lebo zneuzivame atribut scale v TypeORM na zadanie upresnenia
export enum XDateScale {
    Date = 1, // dd.mm.yyyy (default)
    Month = 2, // mm.yyyy
    Year = 3 // yyyy
}
//export type XDateType = "month" | "year" | "date";

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

export function dateFromUI(valueString: string, dateScale: XDateScale = XDateScale.Date): Date | null | undefined {
    // converts valueString (e.g. 21.2.2024) into Date
    // if valueString is invalid, returns undefined
    let valueDate: Date | null | undefined = undefined;
    if (valueString === '') {
        valueDate = null;
    }
    else {
        // null znamena nezadane (doplni sa podla aktualneho datumu), undefined znamena zadana nekorektna hodnota
        let day: number | null | undefined;
        let month: number | null | undefined = null;
        let year: number | null | undefined = null;

        if (dateScale === XDateScale.Date) {
            // format "dd.mm.yyyy"
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
        }
        else if (dateScale === XDateScale.Month) {
            // format "mm.yyyy"
            day = 1;
            const posDot = valueString.indexOf('.');
            if (posDot === -1) {
                month = intFromUI(valueString);
            }
            else {
                month = intFromUI(valueString.substring(0, posDot));
                year = intFromUI(valueString.substring(posDot + 1));
            }
        }
        else if (dateScale === XDateScale.Year) {
            // format "yyyy"
            day = 1;
            month = 1;
            year = intFromUI(valueString);
        }
        else {
            throw "Unimplemented dateScale = " + dateScale;
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


export function dateAsUI(value: Date | null, dateScale: XDateScale = XDateScale.Date): string {
    if (value !== null) {
        return dateFormat(value, dateFormatUI(dateScale));
    }
    else {
        return "";
    }
}

// specialna funkcia - konvertuje Date na string YYYY-MM-DD
export function dateAsYYYY_MM_DD(date: Date): string {
    return dateFormat(date, 'yyyy-MM-dd');
}

export function dateAsDB(date: Date | null): string {
    return date !== null ? `'${dateAsYYYY_MM_DD(date)}'::DATE` : "NULL::DATE";
}

// the same like function format(this, 'yyyy-MM-dd');
export function dateFormat(date: Date, format: string): string {
    const pad = (num: number): string => num.toString().padStart(2, '0');

    const year: number = date.getFullYear();
    const month: string = pad(date.getMonth() + 1); // Months are zero-based
    const day: string = pad(date.getDate());

    let value: string = format;
    value = value.replace('yyyy', `${year}`);
    value = value.replace('MM', month);
    value = value.replace('dd', day);

    return value;
}

export function datetimeAsUI(value: Date | null): string {
    if (value !== null) {
        return datetimeFormat(value, datetimeFormatUI());
    }
    else {
        return "";
    }
}

// the same like function format(this, 'yyyy-MM-dd HH:mm:ss');
export function datetimeFormat(date: Date, format: string): string {
    const pad = (num: number): string => num.toString().padStart(2, '0');

    const year: number = date.getFullYear();
    const month: string = pad(date.getMonth() + 1); // Months are zero-based
    const day: string = pad(date.getDate());

    const hours: string = pad(date.getHours());
    const minutes: string = pad(date.getMinutes());
    const seconds: string = pad(date.getSeconds());

    let value: string = format;
    value = value.replace('yyyy', `${year}`);
    value = value.replace('MM', month);
    value = value.replace('dd', day);

    value = value.replace('HH', hours);
    value = value.replace('mm', minutes);
    value = value.replace('ss', seconds);

    return value;
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

export function dateFormatUI(dateScale: XDateScale = XDateScale.Date): string {
    let format: string;
    if (dateScale === XDateScale.Date) {
        format = "dd.MM.yyyy";
    }
    else if (dateScale === XDateScale.Month) {
        format = "MM.yyyy";
    }
    else if (dateScale === XDateScale.Year) {
        format = "yyyy";
    }
    else {
        throw "Unimplemented dateScale = " + dateScale;
    }
    return format;
}

export function dateFormatCalendar(dateScale: XDateScale = XDateScale.Date): string {
    let format: string;
    if (dateScale === XDateScale.Date) {
        format = "dd.mm.yy";
    }
    else if (dateScale === XDateScale.Month) {
        format = "mm.yy";
    }
    else if (dateScale === XDateScale.Year) {
        format = "yy";
    }
    else {
        throw "Unimplemented dateScale = " + dateScale;
    }
    return format;
}

export function datetimeFormatUI(): string {
    return "dd.MM.yyyy HH:mm:ss";
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

export function convertValueBase(fieldType: string, scale: number | undefined, value: any, fromModel: boolean, asUI: AsUIType | undefined): any {
    if (fieldType === "decimal") {
        if (fromModel) {
            value = numberFromModel(value);
        }
        if (asUI && asUI !== AsUIType.Excel) {
            value = numberAsUI(value, scale);
        }
    }
    else if (fieldType === "date") {
        if (fromModel) {
            value = dateFromModel(value);
        }
        if (asUI && (asUI !== AsUIType.Excel || scale === XDateScale.Month || scale === XDateScale.Year)) {
            value = dateAsUI(value, scale);
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
    else if (fieldType === "jsonb") {
        // konverziu z modelu (json objekt-u) netreba
        if (asUI) {
            value = XUtilsCommon.objectAsJSON(value);
        }
    }
    else {
        // vsetko ostatne
        if (asUI && asUI !== AsUIType.Excel) {
            value = (value !== null && value !== undefined) ? value.toString() : "";
        }
    }
    return value;
}