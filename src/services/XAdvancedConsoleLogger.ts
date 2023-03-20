import {AdvancedConsoleLogger} from "typeorm";
import {Buffer} from "buffer";

export class XAdvancedConsoleLogger extends AdvancedConsoleLogger {

    /**
     * Overrides method in AbstractLogger, the goal is not to log Buffer values (data are usually very long)
     * AdvancedConsoleLogger is default logger for Typeorm
     *
     * Converts parameters to a string.
     * Sometimes parameters can have circular objects and therefor we are handle this case too.
     */
    protected stringifyParams(parameters: any[]) {
        try {
            let paramStr: string = "";
            for (const param of parameters) {
                if (paramStr !== "") {
                    paramStr += ", ";
                }
                if (param instanceof Buffer) {
                    paramStr += `Buffer.byteLength=${param.byteLength}`;
                }
                else {
                    paramStr += JSON.stringify(param);
                }
            }
            return `[${paramStr}]`;
        } catch (error) {
            // most probably circular objects in parameters
            return parameters
        }
    }
}