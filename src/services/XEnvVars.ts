// enum for environment variables in configuration file .env (backend)
export enum XEnvVar {
    X_PROTOCOL = 'X_PROTOCOL',
    X_DOMAIN = 'X_DOMAIN',
    X_PORT = 'X_PORT',
    X_AUTH = 'X_AUTH',
    X_AUTH0_DOMAIN = 'X_AUTH0_DOMAIN',
    X_AUTH0_AUDIENCE = 'X_AUTH0_AUDIENCE',
    X_MS_ENTRA_ID_TENANT_ID = 'X_MS_ENTRA_ID_TENANT_ID',
    X_MS_ENTRA_ID_AUDIENCE = 'X_MS_ENTRA_ID_AUDIENCE',
    X_DATABASE_URL = 'X_DATABASE_URL',
    X_STRING_DB_SEARCH_AI_CI = 'X_STRING_DB_SEARCH_AI_CI',
    X_LOG_SQL = 'X_LOG_SQL'
}

// enum for values of the environment variable X_PROTOCOL
export enum XProtocol {
    HTTP = 'HTTP',
    HTTPS = 'HTTPS'
}

// enum for values of the environment variable X_AUTH
export enum XAuth {
    OFF = 'OFF',
    LOCAL = 'LOCAL',
    AUTH0 = 'AUTH0',
    MS_ENTRA_ID = 'MS_ENTRA_ID'
}
