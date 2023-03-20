// enum for environment variables in configuration file .env (backend)
export enum XEnvVar {
    X_PORT = 'X_PORT',
    X_AUTH = 'X_AUTH',
    X_AUTH0_DOMAIN = 'X_AUTH0_DOMAIN',
    X_AUTH0_AUDIENCE = 'X_AUTH0_AUDIENCE',
    X_DATABASE_URL = 'X_DATABASE_URL',
    X_LOG_SQL = 'X_LOG_SQL'
}

// enum for values of the environment variable X_AUTH
export enum XAuth {
    LOCAL = 'LOCAL',
    AUTH0 = 'AUTH0',
    AAD = 'AAD'
}
