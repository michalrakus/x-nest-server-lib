// error sluziaci na vytvaranie chybovych hlasok na backende, aby sa pekne zobrazovali na frontende
export class XAppError extends Error {

    constructor(msg: string) {
        super(msg);

        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain (aby sa dala exception odchytavat cez instanceof XAppError, ak bude treba)
        this.name = 'XAppError'; // aby XExceptionFilter vytvoril spravny exceptionName
    }
}
