
export class CommonLogger {

    public static info (src: any, msg: string) {
        console.log('INFO', msg);
    }

    public static warn (src: any, msg: string, cause?: any) {
        if (!cause) {
            console.log('WARNING', msg, cause);
        } else if (cause instanceof Error) {
            console.log('WARNING', msg, cause);
            while ((<any>cause).cause instanceof Error) {
                cause = (<any>cause).cause;
                console.log('caused by:', cause);
            }
        } else {
            console.log('WARNING', msg, cause);
        }
    }

}
