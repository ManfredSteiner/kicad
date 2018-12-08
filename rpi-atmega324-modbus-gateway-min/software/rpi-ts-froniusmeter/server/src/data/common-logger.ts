import * as debugsx from 'debug-sx';
const debug: debugsx.ISimpleLogger = debugsx.createSimpleLogger('common-logger');


export class CommonLogger {

    public static info (src: any, msg: string) {
        debug.info(msg);
    }

    public static warn (src: any, msg: string) {
        debug.warn(msg)
    }

}
