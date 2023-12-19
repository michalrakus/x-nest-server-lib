// tu sa nachadza kopia konverznych funkcii z frontend lib-ky - skopirovane z XUtilsConversions.ts na frontende

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

// aby sme sa vyhli sql injection problemu - tam kde je problematicke pouzivat klasicke params
export function stringAsDB(value: string | null): string {
    return value !== null ? `'${value.replaceAll("'", "''")}'` : "NULL";
}

