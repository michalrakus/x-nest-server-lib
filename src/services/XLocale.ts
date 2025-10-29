import {XUtils} from "./XUtils";

// type for x-locale
export interface XLocaleOptions {
    pessimisticLockFailedLockPresent?: string;
    pessimisticLockFailedLockFinished?: string;
}

export function xLocaleOption(xOptionKey: string, options?: any[string]) {
    const xLocaleOptions: XLocaleOptions = XUtils.getXLocaleOptions();

    try {
        let optionValue = xLocaleOptions[xOptionKey];

        if (optionValue && options) {
            for (const key in options) {
                if (options.hasOwnProperty(key)) {
                    optionValue = optionValue.replace(`{${key}}`, options[key]);
                }
            }
        }

        return optionValue;
    } catch (error) {
        throw new Error(`The ${xOptionKey} option is not found in the current x-locale.`);
    }
}
