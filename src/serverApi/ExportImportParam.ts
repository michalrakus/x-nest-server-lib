// ExportType a ExportParam sa pouzivaju v samostatnom servise ktory data streamuje (na rozdiel od ResultType.AllRows ktory by sa ani nemal pouzivat)
import {Filters, SortMeta} from "./FindParam";

export enum ExportType {
    Csv = "csv",
    Json = "json"
}

export interface ExportParam {
    exportType: ExportType;
    filters: Filters;
    multiSortMeta?: SortMeta[]; // typ []
    entity: string;
    fields: string[];
    csvParam?: CsvParam;
}

// vo windowse zavisi od regionalnych nastaveni, default nastavenie je ";" a preto vecsinou aj excel produkuje csv s ";" (menej sa to bije s decimalmi)
// takze primarne pouzivame ";" a sekundarne "," napr. pri generickom exporte do csv davame uzivatelovi na vyber
export enum CsvSeparator {
    Semicolon = ";",
    Comma = ","
}

// decimal format pouzivany pri exporte do csv
export enum CsvDecimalFormat {
    Comma = "123456,78",
    Dot = "123456.78"
}

// csv parametre pouzivane pri exporte/importe csv
export interface CsvParam {
    useHeaderLine: boolean;
    headers?: string[];
    csvSeparator: CsvSeparator;
    csvDecimalFormat: CsvDecimalFormat;
}

export enum ImportType {
    Csv = "csv",
    Json = "json"
}

export interface ImportParam {
    importType: ImportType;
    entity: string;
    //fields: string[]; // pouzivane len pri csv importe
    csvParam: CsvParam; // TODO - odstranit a aj z import dialogu odstranit
}

export interface ImportResponse {
    ok: boolean;
    rowsImported?: number;
    error?: string;
}
