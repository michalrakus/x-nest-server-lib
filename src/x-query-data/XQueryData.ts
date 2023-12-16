import {
    DataTableFilterMetaData,
    DataTableOperatorFilterMetaData,
    FilterMatchMode
} from "../serverApi/PrimeFilterSortMeta";
import {ObjectLiteral} from "typeorm";
import {XUtils} from "../services/XUtils";

export abstract class XQueryData {

    rootAlias: string; // alias for root table of the query, e.g. "t0"
    assocAliasMap: Map<string, string>; // assoc1.assoc2.fieldX = :valueX -> (t0.assoc1, t1), (t1.assoc2, t2)
    where: string;                      // assoc1.assoc2.fieldX = :valueX -> t2.fieldX = :valueX
    params: ObjectLiteral;                         // {valueX, <valueX>}
    ftsFieldList: string[];             // fts = full-text search

    protected constructor(rootAlias: string) {
        this.rootAlias = rootAlias;
        this.assocAliasMap = new Map<string, string>();
        this.where = "";
        this.params = {};
        this.ftsFieldList = [];
    }

    abstract isMainQueryData(): boolean;

    // vracia true prave vtedy ked this.addFilterField vytvori nejaku podmienku
    isFilterValueNotNull(filterValue: DataTableFilterMetaData | DataTableOperatorFilterMetaData): boolean {
        if ('operator' in filterValue) {
            // composed condition
            const operatorFilterItem: DataTableOperatorFilterMetaData = filterValue;
            for (const [index, filterItem] of operatorFilterItem.constraints.entries()) {
                if (this.isFilterItemNotNull(filterItem)) {
                    return true;
                }
            }
            return false;
        }
        else {
            // simple condition
            const filterItem: DataTableFilterMetaData = filterValue;
            return this.isFilterItemNotNull(filterItem);
        }
    }

    isFilterItemNotNull(filterItem: DataTableFilterMetaData): boolean {
        // podmienka filterItem.value !== '' je workaround, spravne by bolo na frontende menit '' na null v onChange metode filter input-u
        // problem je, ze nemame custom input filter pre string atributy, museli by sme ho dorobit (co zas nemusi byt az taka hrozna robota)
        return filterItem.value !== null && filterItem.value !== ''
                && !(filterItem.matchMode === FilterMatchMode.BETWEEN && Array.isArray(filterItem.value) && filterItem.value.length === 2 && filterItem.value[0] === null && filterItem.value[1] === null);
    }

    addFilterField(filterField: string, filterValue: DataTableFilterMetaData | DataTableOperatorFilterMetaData) {
        let whereItems: string = "";
        if ('operator' in filterValue) {
            // composed condition
            const operatorFilterItem: DataTableOperatorFilterMetaData = filterValue;
            const whereOperator = " " + operatorFilterItem.operator.toUpperCase() + " "; // AND or OR
            for (const [index, filterItem] of operatorFilterItem.constraints.entries()) {
                const whereItem: string = this.createWhereItem(filterField, filterItem, index);
                if (whereItem !== "") {
                    if (whereItems !== "") {
                        whereItems += whereOperator;
                    }
                    whereItems += "(" + whereItem + ")";
                }
            }
        }
        else {
            // simple condition
            const filterItem: DataTableFilterMetaData = filterValue;
            whereItems = this.createWhereItem(filterField, filterItem, undefined);
        }
        // if there was some condition for current filterField, add it to the result
        if (whereItems !== "") {
            this.addWhereItem(whereItems);
        }
    }

    createWhereItem(filterField: string, filterItem: DataTableFilterMetaData, paramIndex: number | undefined): string {
        let whereItem: string = "";
        if (this.isFilterItemNotNull(filterItem)) {
            const field: string = this.getFieldFromPathField(filterField);
            // TODO - pouzit paramName :1, :2, :3, ... ?
            let paramName: string = field; // paramName obsahuje "." (napr. t2.attrib)
            if (paramIndex !== undefined) {
                paramName += "_" + paramIndex;
            }
            switch (filterItem.matchMode) {
                case FilterMatchMode.STARTS_WITH:
                    whereItem = this.createWhereItemBase(field, "LIKE", paramName, `${filterItem.value}%`);
                    break;
                case FilterMatchMode.CONTAINS:
                    whereItem = this.createWhereItemBase(field, "LIKE", paramName, `%${filterItem.value}%`);
                    break;
                case FilterMatchMode.NOT_CONTAINS:
                    whereItem = this.createWhereItemBase(field, "NOT LIKE", paramName, `%${filterItem.value}%`);
                    break;
                case FilterMatchMode.ENDS_WITH:
                    whereItem = this.createWhereItemBase(field, "LIKE", paramName, `%${filterItem.value}`);
                    break;
                case FilterMatchMode.EQUALS:
                case FilterMatchMode.DATE_IS:
                    whereItem = this.createWhereItemBase(field, "=", paramName, filterItem.value);
                    break;
                case FilterMatchMode.NOT_EQUALS:
                case FilterMatchMode.DATE_IS_NOT:
                    whereItem = this.createWhereItemBase(field, "<>", paramName, filterItem.value);
                    break;
                case FilterMatchMode.IN:
                    if (Array.isArray(filterItem.value)) {
                        let valueList: any[] = filterItem.value;
                        // result will be empty for empty valueList (generated SQL: field IN (NULL))
                        if (valueList.length === 0) {
                            valueList = [null];
                        }
                        whereItem = `${field} IN (:...${paramName})`;
                        this.params[paramName] = valueList;
                    }
                    else {
                        console.log(`FilterMatchMode "${filterItem.matchMode}": value is expected to be array`);
                    }
                    break;
                case FilterMatchMode.LESS_THAN:
                case FilterMatchMode.DATE_BEFORE:
                    whereItem = this.createWhereItemBase(field, "<", paramName, filterItem.value);
                    break;
                case FilterMatchMode.LESS_THAN_OR_EQUAL_TO:
                    whereItem = this.createWhereItemBase(field, "<=", paramName, filterItem.value);
                    break;
                case FilterMatchMode.GREATER_THAN:
                case FilterMatchMode.DATE_AFTER:
                    whereItem = this.createWhereItemBase(field, ">", paramName, filterItem.value);
                    break;
                case FilterMatchMode.GREATER_THAN_OR_EQUAL_TO:
                    whereItem = this.createWhereItemBase(field, ">=", paramName, filterItem.value);
                    break;
                case FilterMatchMode.BETWEEN:
                    if (Array.isArray(filterItem.value) && filterItem.value.length === 2) {
                        const value1: any | null = filterItem.value[0];
                        const value2: any | null = filterItem.value[1];
                        const whereItem1: string | "" = (value1 !== null ? this.createWhereItemBase(field, ">=", paramName + '_1', value1) : "");
                        const whereItem2: string | "" = (value2 !== null ? this.createWhereItemBase(field, "<=", paramName + '_2', value2) : "");
                        whereItem = XQueryData.whereItemAnd(whereItem1, whereItem2);
                    }
                    else {
                        console.log(`FilterMatchMode "${filterItem.matchMode}": value is expected to be array of length = 2`);
                    }
                    break;
                default:
                    console.log(`FilterMatchMode "${filterItem.matchMode}" not implemented`);
            }
            // kontrola - vzdy by mala existovat whereItem, ak metoda this.isFilterItemNotNull vratila true
            if (whereItem === "") {
                throw `Unexpected error - function this.isFilterItemNotNull(filterItem) returned true, but whereItem was not created. filterItem = ${JSON.stringify(filterItem)}`;
            }
        }
        return whereItem;
    }

    createWhereItemBase(field: string, sqlOperator: string, paramName: string, paramValue: any): string {
        const whereItem: string = `${field} ${sqlOperator} :${paramName}`;
        this.params[paramName] = paramValue;
        return whereItem;
    }

    getFieldFromPathField(pathField: string): string {
        return this.getFieldFromAliasPath(this.rootAlias + "." + pathField);
    }

    getFieldFromAliasPath(path: string): string {
        // ak sa jedna o koncovy atribut (napr. t2.attrib), tak ho vratime
        const posDot: number = path.indexOf(".");
        if (posDot === -1) {
            throw "Unexpected error - path " + path + " has no alias";
        }
        const posDotSecond: number = path.indexOf(".", posDot + 1);
        if (posDotSecond === -1) {
            return path;
        }
        // jedna sa o path
        const assoc: string = path.substring(0, posDotSecond);
        const remainingPath: string = path.substring(posDotSecond + 1);

        // ziskame atribut zo zvysnej path
        const aliasForAssoc: string = this.getAliasForAssoc(assoc);
        return this.getFieldFromAliasPath(aliasForAssoc + "." + remainingPath);
    }

    getAliasForAssoc(assoc: string): string {
        let aliasForAssoc: string = this.assocAliasMap.get(assoc);
        if (aliasForAssoc === undefined) {
            // asociaciu este nemame pridanu, pridame ju
            aliasForAssoc = this.rootAlias + "_" + (this.assocAliasMap.size + 1).toString();
            this.assocAliasMap.set(assoc, aliasForAssoc);
        }
        return aliasForAssoc;
    }

    addWhereItem(whereItem: string) {
        if (this.where !== "") {
            this.where += " AND ";
        }
        this.where += "(" + whereItem + ")";
    }

    addParams(params: {}) {
        // TODO - pridat kontrolu ci sa neprepisu (ak nahodou budu mat rovnake key, tak vitazi item z params)
        this.params = {...this.params, ...params};
    }

    addFtsField(ftsField: string) {
        const field: string = this.getFieldFromPathField(ftsField);
        // TODO - konverzie
        // ak field castujeme cez ::VARCHAR, treba ho uviest v zatvorkach, inac nam TypeORM neurobi replace na nazov stlpca
        this.ftsFieldList.push(`coalesce((${field})::VARCHAR, '')`);
    }

    // pouzivam ako separator namiesto space-u (' ') lebo space sa moze nachadzat v hodnotach
    // otazne je ci je to vhodna volba pri pouziti GIN indexu
    static xFtsSeparator: string = '|';

    createFtsWhereItem(ftsValue: string): string | "" {
        let whereItem: string | "" = "";
        if (this.ftsFieldList.length > 0) {
            // na zaciatok a na koniec pridavame separator '|', vyuzijeme ich ak bude operator startsWith/endsWidth/equals
            // ILIKE - I = insensitive case
            // <schema>.unaccent - odstranuje diakritiku - neviem ci je lepsie ju volat raz alebo radsej pre kazdy field zvlast
            whereItem = `${XUtils.getSchema()}.unaccent('${XQueryData.xFtsSeparator}' || ${this.ftsFieldList.join(` || '${XQueryData.xFtsSeparator}' || `)} || '${XQueryData.xFtsSeparator}') ILIKE ${XUtils.getSchema()}.unaccent('%${ftsValue}%')`;
        }
        return whereItem;
    }

    static whereItemAnd(whereItem1: string | "", whereItem2: string | ""): string | "" {
        return XQueryData.whereItemAndOr("AND", whereItem1, whereItem2);
    }

    static whereItemOr(whereItem1: string | "", whereItem2: string | ""): string | "" {
        return XQueryData.whereItemAndOr("OR", whereItem1, whereItem2);
    }

    static whereItemAndOr(and_or: "AND" | "OR", whereItem1: string | "", whereItem2: string | ""): string | "" {
        let whereItem: string;
        if (whereItem1 !== "" && whereItem2 !== "") {
            whereItem = `(${whereItem1} ${and_or} ${whereItem2})`;
        }
        else {
            whereItem = whereItem1 + whereItem2;
        }
        return whereItem;
    }
}

