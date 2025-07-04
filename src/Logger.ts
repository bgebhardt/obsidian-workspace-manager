export class Logger {
    private static isDebug: boolean = false;

    static setDebug(isDebug: boolean) {
        this.isDebug = isDebug;
    }

    static log(message: string, ...optionalParams: any[]) {
        console.log(message, ...optionalParams);
    }

    static info(message: string, ...optionalParams: any[]) {
        console.info(message, ...optionalParams);
    }

    static warn(message: string, ...optionalParams: any[]) {
        console.warn(message, ...optionalParams);
    }

    static error(message: string, ...optionalParams: any[]) {
        console.error(message, ...optionalParams);
    }

    static debug(message: string, ...optionalParams: any[]) {
        if (this.isDebug) {
            console.debug(message, ...optionalParams);
        }
    }
}