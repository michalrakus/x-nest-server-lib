// ExportType a LazyDataTableQueryParam sa pouzivaju v samostatnom servise ktory data streamuje
// (na rozdiel od ResultType.AllRows ktory by sa ani nemal pouzivat - nemali by sa vsetky rows tahat na klienta v jednom velkom requeste)
import {DataTableFilterMeta, DataTableSortMeta} from "./PrimeFilterSortMeta";
import {XCustomFilterItem, XFullTextSearch} from "./FindParam";

export enum ExportType {
    Csv = "csv",
    Json = "json"
}

export interface ExportParam {
    exportType: ExportType;
    csvParam?: CsvParam; // pouziva sa ak exportType = csv
    queryParam: LazyDataTableQueryParam | any; // query z lazy tabulky alebo parametre specificke pre konkretny export
}

export interface LazyDataTableQueryParam {
    filters: DataTableFilterMeta;
    fullTextSearch?: XFullTextSearch;
    customFilterItems?: XCustomFilterItem[];
    multiSortMeta?: DataTableSortMeta[]; // typ []
    entity: string;
    fields: string[];
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

// zatial len tieto 2, ak bude treba, tak pridat napr. win1252 (Western Europe)
// win1250 pouzivame ako default, lebo Excel automaticky predpoklada kodovanie win1250
// konstanty sa pouzivaju priamo v kniznici iconv-lite
export enum CsvEncoding {
    Utf8 = "utf-8",
    Win1250 = "win1250"
}

// csv parametre pouzivane pri exporte/importe csv
export interface CsvParam {
    useHeaderLine: boolean;
    headers?: string[];
    csvSeparator: CsvSeparator;
    csvDecimalFormat: CsvDecimalFormat;
    csvEncoding: CsvEncoding;
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
