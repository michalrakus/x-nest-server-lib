// ExportType a LazyDataTableQueryParam sa pouzivaju v samostatnom servise ktory data streamuje
// (na rozdiel od ResultType.AllRows ktory by sa ani nemal pouzivat - nemali by sa vsetky rows tahat na klienta v jednom velkom requeste)
import {DataTableSortMeta} from "./PrimeFilterSortMeta";
import {XCustomFilterItem, XDataTableFilterMeta, XFullTextSearch} from "./FindParam";
import {XContentType} from "./x-lib-api";

// ************** export ***************

export enum ExportType {
    Excel = "excel",
    Csv = "csv",
    Json = "json"
}

export interface ExportExcelParam {
    queryParam: LazyDataTableQueryParam;
    excelCsvParam: ExcelCsvParam;
}

export interface ExportCsvParam {
    queryParam: LazyDataTableQueryParam;
    excelCsvParam: ExcelCsvParam;
    csvParam: CsvParam;
}

export interface ExportJsonParam {
    queryParam: LazyDataTableQueryParam;
}

export interface LazyDataTableQueryParam {
    filters: XDataTableFilterMeta;
    fullTextSearch?: XFullTextSearch;
    customFilterItems?: XCustomFilterItem[];
    multiSortMeta?: DataTableSortMeta[]; // typ []
    entity: string;
    fields: string[];
}

// params used by export to excel and to csv
export interface ExcelCsvParam {
    columns: ExportColumn[]; // array corresponds to queryParam.fields
    createHeaders: boolean; // creates header row if true
    toManyAssocExportType: ToManyAssocExportType; // export toMany asociacii
    fieldsToDuplicateValues?: string[]; // (podmnozina LazyDataTableQueryParam.fields)
}

export interface ExportColumn {
    header?: string;
    width?: string; // width of the column, e.g. '7.75rem', '20rem', '125px', used only for excel
    contentType?: XContentType; // for now used only for excel (in future can be used also for csv)
}

// exporting values from toMany associations
export enum ToManyAssocExportType {
    Singleline = "singleline", // values are joined into one long text, separated by comma ","
    Multiline = "multiline", // values are written under each other into column, all values are in one cell separated by new line (works only for excel)
    Multirow = "multirow", // values are written under each other into column, every value has separated cell/row
    Off = "off" // stlpce obsahujuce viac hodnot/riadkov sa vynechaju z exportu
}

// csv parametre pouzivane pri exporte/importe csv
export interface CsvParam {
    csvSeparator: CsvSeparator;
    csvDecimalFormat: CsvDecimalFormat;
    csvEncoding: CsvEncoding;
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

// ************** import ***************

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
