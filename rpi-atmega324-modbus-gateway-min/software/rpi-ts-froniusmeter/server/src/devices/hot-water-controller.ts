
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('devices:HotWaterController');

import * as http from 'http';

import { IMonitorRecord, MonitorRecord } from '../data/common/hwc/monitor-record';


interface IHotWaterControllerConfig {
    host: string;
    port: number;
    path: string;
    start?: boolean;
    timeoutMillis?: number;
    pollingPeriodMillis?: number;
}

export class HotWaterController {

    public static get Instance (): HotWaterController {
        if (!this._instance) { throw new Error('instance not initialized'); }
        return this._instance;
    }

    public static async initInstance (config: IHotWaterControllerConfig): Promise<HotWaterController> {
        if (this._instance) { throw new Error('instance already created'); }
        const rv = new HotWaterController(config);
        await rv.init();
        this._instance = rv;
        return rv;
    }

    private static _instance: HotWaterController;

    // ****************************************************

    private _config: IHotWaterControllerConfig;
    private _keepAliveAgent: http.Agent;
    private _options: http.RequestOptions;
    private _lastValidResponse: { at: Date, value: MonitorRecord };
    private _timer: NodeJS.Timer;
    private _getPendingSince: Date;


    private constructor (config: IHotWaterControllerConfig) {
        this._config = config;
        if (!config || config.start === false) { return; }
        if (!config.host || typeof(config.host) !== 'string') { throw new Error('invalid/missing host in config'); }
        if (config.port < 0 || config.port > 65535) { throw new Error('invalid/missing port in config'); }
        if (!config.path || typeof(config.path) !== 'string') { throw new Error('invalid/missing path'); }
    }

    public get lastValidResponse (): { at: Date, value: MonitorRecord } {
        return this._lastValidResponse;
    }

    public async start () {
        if (!this._config || !this._config.start) { return; }
        if (!this._config.pollingPeriodMillis || this._config.pollingPeriodMillis < 0) { return; }
        if (this._timer) { throw new Error('polling already started'); }
        this._timer = setInterval( () => this.handleTimer(), this._config.pollingPeriodMillis);
        debug.info('periodic polling (%s seconds) of HotWaterController started', Math.round(this._config.pollingPeriodMillis / 100) / 10);
    }

    public async stop () {
        if (!this._timer) { return; }
        clearInterval(this._timer);
        this._timer = null;
        debug.info('periodic polling stopped');
    }


    // public get values ():  { [id: number]: Nibe1155Value } {
    //     return this._values;
    // }

    // public get brinePumpPower (): number {
    //     const v = this._values[43439];
    //     if (!v || v.label !== 'brinePumpSpeed' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
    //     return 30 / 100 * v.value;
    // }

    // public get supplyPumpPower (): number {
    //     const v = this._values[43437];
    //     if (!v || v.label !== 'supplyPumpSpeed' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
    //     return 30 / 100 * v.value;
    // }

    // public get compressorPower (): number {
    //     const v = this._values[43141];
    //     if (!v || v.label !== 'compressorInPower' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
    //     return v.value;
    // }

    // public get compressorFrequency (): number {
    //     const v = this._values[43136];
    //     if (!v || v.label !== 'compressorFrequency' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
    //     return v.value;
    // }


    // public get electricHeaterPower (): number {
    //     const v = this._values[43084];
    //     if (!v || v.label !== 'electricHeaterPower' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
    //     return v.value;
    // }

    /* tslint:disable:unified-signatures */
    public async getData (): Promise<MonitorRecord> {
        if (this._getPendingSince) {
            return Promise.reject(new Error('request pending'));
        }

        const options = Object.assign({}, this._options);
        this._getPendingSince = new Date();
        debug.finest('send request %s:%s', options.host, options.path);
        const rv = new Promise<MonitorRecord>( (res, rej) => {
            const requ = http.request(options, (resp) => {
                if (resp.statusCode === 200) {
                    resp.setEncoding('utf8');
                    let s = '';
                    resp.on('data', chunk => {
                        s += chunk;
                    });
                    resp.on('end', () => {
                        try {
                            debug.finest(s);
                            const r: IMonitorRecord [] = JSON.parse(s);
                            if (!Array.isArray(r) || r.length !== 1) {
                                debug.warn('invalid response\n%s', s);
                                this._getPendingSince = null;
                                rej(new Error('invalid response'));
                            } else {
                                r[0].mode = 'power';
                                const mr = new MonitorRecord(r[0]);
                                debug.finer('reading successful: %o', r);
                                this._lastValidResponse = { at: new Date(), value: mr };
                                this._getPendingSince = null;
                                res(mr);
                            }
                        } catch (err) {
                            this._getPendingSince = null;
                            rej(err);
                        }
                    });
                } else {
                    this._getPendingSince = null;
                    rej(new Error('response status ' + resp.statusCode));
                }
            });
            requ.on('error', (err) => {
                this._getPendingSince = null;
                rej(err);
            });
            requ.end();
        });
        return rv;
    }

    // public async setHeatpumpMode (mode: IHeatpumpMode): Promise<IHeatpumpMode> {
    //     if (!mode || !mode.createdAt || !mode.desiredMode
    //          || !mode.pin) {
    //         return Promise.reject(new Error('invalid mode'));
    //     }
    //     const rv = new Promise<IHeatpumpMode>( (resolve, reject) => {
    //         const body = JSON.stringify(mode);
    //         const options = Object.assign({}, this._options);
    //         options.method = 'POST';
    //         options.path = this._config.pathMode;
    //         options.headers = {
    //             'Content-Type': 'application/json',
    //             'Content-Length': Buffer.byteLength(body)
    //         };
    //         const req = http.request(options, (res) => {
    //             if (res.statusCode !== 200) {
    //                 reject(new Error('response error status ' + res.statusCode));
    //                 return;
    //             }
    //             res.setEncoding('utf8');
    //             let s = '';
    //             res.on('data', chunk => {
    //                 s += chunk;
    //             });
    //             res.on('end', () => {
    //                 try {
    //                     const r: IHeatpumpMode = JSON.parse(s);
    //                     if (!r || !r.createdAt || !r.desiredMode || !r.currentMode) {
    //                         throw new Error('invalid response for mode');
    //                     }
    //                     resolve(r);
    //                 } catch (err) {
    //                     debug.warn(err);
    //                     reject(err);
    //                 }
    //             });
    //         });
    //         req.on('error', (err) => {
    //             debug.warn(err);
    //         });
    //         req.write(body);
    //         req.end();
    //     });
    //     return rv;
    // }

    private async init () {
        if (this._config && this._config.start) {
            debug.info('init for %s:%s/%s', this._config.host, this._config.port, this._config.path);
            this._keepAliveAgent = new http.Agent({ keepAlive: true });
            this._options = {
                agent: this._keepAliveAgent,
                host: this._config.host,
                port: this._config.port,
                path: this._config.path,
                method: 'GET',
                timeout: this._config.timeoutMillis > 0 ? this._config.timeoutMillis : 1000
            };
            await this.handleTimer(true);
        }
    }

    private async handleTimer (init?: boolean) {
        try {
            const rv = await this.getData();
            debug.fine('HotWaterController update done');
        } catch (err) {
            debug.warn('request fails\n%e', err);
        }
    }


}


