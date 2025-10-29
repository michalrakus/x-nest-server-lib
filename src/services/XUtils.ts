import {XEnvVar} from "./XEnvVars";
import {join} from "path";
import {IPostgresInterval} from "postgres-interval";
import {ValueTransformer} from "typeorm";
import {XLocaleOptions} from "./XLocale";

export class XUtils {

    // token pouzivany pre public stranky (napr. XLoginForm), meno/heslo natvrdo (lepsie ako nic)
    static xTokenPublic = {username: "xPublicUser", password: "xPublicUserPassword123"};

    /**
     * returns value of environment variable from configuration file .env
     * @param envVar
     */
    static getEnvVarValue(envVarEnum: XEnvVar): string {
        let value: string = XUtils.getEnvVarValueBase(envVarEnum);
        // value can be also "reference" to another environment variable used by cloud,
        // for example string value "[process.env.JAWSDB_URL]" means, that we read the real value from environment variable process.env.JAWSDB_URL
        // (in this variable is URL for MySQL DB on Heroku)
        if (value.startsWith('[process.env.') && value.endsWith("]")) {
            const envVarName: string = value.substring('[process.env.'.length, value.length - 1);
            value = XUtils.getEnvVarValueBase(envVarName);
        }
        return value;
    }

    static getEnvVarValueBoolean(envVarEnum: XEnvVar): boolean {
        const value: string = XUtils.getEnvVarValue(envVarEnum);
        return value === "true";
    }

    private static getEnvVarValueBase(envVarName: string): string {
        const value: string | undefined = process.env[envVarName];
        if (value === undefined) {
            throw `Environment variable ${envVarName} - value not found. Check configuration file .env*`;
        }
        return value;
    }

    static getXFilesDir(): string {
        return join('app-files', 'x-files');
    }

    public static xIntervalTransformer: ValueTransformer = {
        // typeOrm sends object PostgresInterval into db but db wants string like '5 days 5 hours 5 seconds'
        // that's why this transformation is necessary
        to: (interval: IPostgresInterval): string | null => {
            let result: string | null = null;
            if (interval) {
                result = '';
                if (interval.years) result += `${interval.years} years `;
                if (interval.months) result += `${interval.months} mons `;
                if (interval.days) result += `${interval.days} days `;
                if (interval.hours) result += `${interval.hours} hours `;
                if (interval.minutes) result += `${interval.minutes} minutes `;
                if (interval.seconds) result += `${interval.seconds} seconds `;
            }
            return result;
        },
        // db gives us IPostgresInterval
        from: (interval: IPostgresInterval): IPostgresInterval => {
            return interval;
        },
    };

    private static schema: string | undefined = undefined;

    static setSchema(schema: string) {
        XUtils.schema = schema;
    }

    static getSchema(): string {
        return XUtils.schema;
    }

    private static xLocaleOptions: XLocaleOptions | undefined = undefined;

    static setXLocaleOptions(xLocaleOptions: XLocaleOptions) {
        XUtils.xLocaleOptions = xLocaleOptions;
    }

    static getXLocaleOptions(): XLocaleOptions {
        return XUtils.xLocaleOptions;
    }
}
