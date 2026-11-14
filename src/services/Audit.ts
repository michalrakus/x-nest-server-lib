// this file was created by AI and maybe it should be regular service

// entity names (class names) for which row changes are written into x_audit_row
const auditedEntityNames: Set<string> = new Set<string>();

// opt-in: put @Audit() on the entity class
export function Audit(): ClassDecorator {
    return (target: Function) => {
        auditedEntityNames.add(target.name);
    };
}

export function isAuditedEntityName(entityName: string): boolean {
    return auditedEntityNames.has(entityName);
}

// plain JSON snapshot of a saved row; passwords are omitted
export function toAuditRowData(value: any): any {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value !== "object") {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((item: any) => toAuditRowData(item));
    }
    const cloned: any = {};
    for (const key of Object.keys(value)) {
        if (key === "password") {
            continue;
        }
        cloned[key] = toAuditRowData(value[key]);
    }
    return cloned;
}
