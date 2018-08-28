
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('devices:Nibe1155');

import * as http from 'http';

import { INibe1155Values, Nibe1155Value } from '../client/nibe1155-values';
import { IHeatpumpMode } from '../client/monitor-record';


interface INibe1155Config {
    host: string;
    port: number;
    path: string;
    pathMode: string;
    start?: boolean;
    timeoutMillis?: number;
    pollingPeriodMillis?: number;
}

export class Nibe1155 {

    public static get Instance (): Nibe1155 {
        if (!this._instance) { throw new Error('instance not initialized'); }
        return this._instance;
    }

    public static async initInstance (config: INibe1155Config): Promise<Nibe1155> {
        if (this._instance) { throw new Error('instance already created'); }
        const rv = new Nibe1155(config);
        await rv.init();
        this._instance = rv;
        return rv;
    }

    private static _instance: Nibe1155;

    // ****************************************************

    private _config: INibe1155Config;
    private _keepAliveAgent: http.Agent;
    private _options: http.RequestOptions;
    private _lastValidResponse: { at: Date, values: INibe1155Values };
    private _timer: NodeJS.Timer;
    private _getPendingSince: Date;

    private _logsetIds: number [];
    private _values: { [id: number]: Nibe1155Value } = {};
    private _controller: any;



    private constructor (config: INibe1155Config) {
        this._config = config;
        if (!config || config.start === false) { return; }
        if (!config.host || typeof(config.host) !== 'string') { throw new Error('invalid/missing host in config'); }
        if (config.port < 0 || config.port > 65535) { throw new Error('invalid/missing port in config'); }
        if (!config.path || typeof(config.path) !== 'string') { throw new Error('invalid/missing path'); }
        if (!config.pathMode || typeof(config.pathMode) !== 'string') { throw new Error('invalid/missing pathMode in path'); }
    }

    public get lastValidResponse (): { at: Date; values: INibe1155Values } {
        return this._lastValidResponse;
    }

    public async start () {
        if (!this._config || !this._config.start) { return; }
        if (!this._config.pollingPeriodMillis || this._config.pollingPeriodMillis < 0) { return; }
        if (this._timer) { throw new Error('polling already started'); }
        this._timer = setInterval( () => this.handleTimer(), this._config.pollingPeriodMillis);
        debug.info('periodic polling (%s seconds) of nibe1155 started', Math.round(this._config.pollingPeriodMillis / 100) / 10);
    }

    public async stop () {
        if (!this._timer) { return; }
        clearInterval(this._timer);
        this._timer = null;
        debug.info('periodic polling stopped');
    }

    public get logsetIds (): number [] {
        return this._logsetIds;
    }

    public get controller (): any {
        return this._controller;
    }

    public get values ():  { [id: number]: Nibe1155Value } {
        return this._values;
    }

    public get brinePumpPower (): number {
        const v = this._values[43439];
        if (!v || v.label !== 'brinePumpSpeed' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
        return 30 / 100 * v.value;
    }

    public get supplyPumpPower (): number {
        const v = this._values[43437];
        if (!v || v.label !== 'supplyPumpSpeed' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
        return 30 / 100 * v.value;
    }

    public get compressorPower (): number {
        const v = this._values[43141];
        if (!v || v.label !== 'compressorInPower' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
        return v.value;
    }

    public get compressorFrequency (): number {
        const v = this._values[43136];
        if (!v || v.label !== 'compressorFrequency' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
        return v.value;
    }


    public get electricHeaterPower (): number {
        const v = this._values[43084];
        if (!v || v.label !== 'electricHeaterPower' || (Date.now() - v.valueAt.getTime()) > 5000) { return Number.NaN; }
        return v.value;
    }

    /* tslint:disable:unified-signatures */
    public async getData (ids?: number []): Promise<INibe1155Values>;
    public async getData (complete?: boolean): Promise<INibe1155Values>;
    public async getData (complete?: boolean, ids?: number []): Promise<INibe1155Values>;
    /* tslint:enable:unified-signatures */
    public async getData (complete?: boolean | number [], ids?: number []): Promise<INibe1155Values> {
        if (this._getPendingSince) {
            return Promise.reject(new Error('request pending'));
        }
        if (Array.isArray(complete)) {
            ids = complete;
            complete = false;
        }
        ids = Array.isArray(ids) ? ids : [];

        const options = Object.assign({}, this._options);
        options.path += '?' + (complete ? 'logsetIds=true&completeValues=true&simpleValues=false' :
                                          'logsetIds=false&simpleValues=true&completeValues=false');
        for (const id of ids) {
            if (id >= 0 && id <= 0xffff) {
                options.path += '&' + 'id=' + id;
            } else {
                throw new Error('invalid argument ids');
            }
        }
        this._getPendingSince = new Date();
        debug.finest('send request %s:%s', options.host, options.path);
        const rv = new Promise<INibe1155Values>( (res, rej) => {
            const requ = http.request(options, (resp) => {
                if (resp.statusCode === 200) {
                    resp.setEncoding('utf8');
                    let s = '';
                    resp.on('data', chunk => {
                        s += chunk;
                    });
                    resp.on('end', () => {
                        try {
                            const r: INibe1155Values = JSON.parse(s);
                            if (!r) {
                                debug.warn('invalid response\n%s', s);
                                this._getPendingSince = null;
                                rej(new Error('invalid response'));
                            } else {
                                debug.finer('reading successful: %o', r);
                                this._lastValidResponse = {
                                    at: new Date(),
                                    values: r
                                };
                                this._getPendingSince = null;
                                res(r);
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

    public async setHeatpumpMode (mode: IHeatpumpMode): Promise<IHeatpumpMode> {
        if (!mode || !mode.createdAt || !mode.desiredMode
             || !mode.pin) {
            return Promise.reject(new Error('invalid mode'));
        }
        const rv = new Promise<IHeatpumpMode>( (resolve, reject) => {
            const body = JSON.stringify(mode);
            const options = Object.assign({}, this._options);
            options.method = 'POST';
            options.path = this._config.pathMode;
            options.headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            };
            const req = http.request(options, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error('response error status ' + res.statusCode));
                    return;
                }
                res.setEncoding('utf8');
                let s = '';
                res.on('data', chunk => {
                    s += chunk;
                });
                res.on('end', () => {
                    try {
                        const r: IHeatpumpMode = JSON.parse(s);
                        if (!r || !r.createdAt || !r.desiredMode || !r.currentMode) {
                            throw new Error('invalid response for mode');
                        }
                        resolve(r);
                    } catch (err) {
                        debug.warn(err);
                        reject(err);
                    }
                });
            });
            req.on('error', (err) => {
                debug.warn(err);
            });
            req.write(body);
            req.end();
        });
        return rv;
    }

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
        if (init || !this._values || Object.keys(this._values).length === 0) {
            try {
                debug.fine('no values found, send request for complete values');
                const rv = await this.getData(true);
                if (!Array.isArray(rv.logsetIds)) {
                    throw new Error('invalid/missing logsetIds in response');
                }
                if (!rv.controller) {
                    throw new Error('invalid/missing controller in response');
                }
                if (!rv.completeValues) {
                    throw new Error('invalid/missing completeValues in response\n' + JSON.stringify(rv));
                }
                this._logsetIds = rv.logsetIds;
                this._controller = rv.controller;
                const values: { [id: number ]: Nibe1155Value } = {};
                for (const id in rv.completeValues) {
                    if (!rv.completeValues.hasOwnProperty(id)) { continue; }
                    if (+id >= 0 && +id <= 0xffff) {
                        const x = rv.completeValues[id];
                        values[+id] = Nibe1155Value.createInstance(x);
                        debug.finer('add value %o', this._values[+id]);
                    }
                }
                this._values = values;
                debug.info('valid init response from Nibe1155 server, %s values available', Object.keys(this._values).length);
            } catch (err) {
                debug.warn('invalid init response form Nibe1155 server\n%e', err);
                this._values = {};
            }

        } else {
            try {
                debug.fine('values available, send request for simple values');
                const rv = await this.getData(false);
                let cnt = 0;
                if (rv.controller) {
                    this._controller = rv.controller;
                }
                for (const id in rv.simpleValues) {
                    if (!rv.simpleValues.hasOwnProperty(id)) { continue; }
                    const v = this._values[+id];
                    const x = rv.simpleValues[id];
                    if (!v) {
                        debug.warn('cannot find id %s in values, reinit values...', id);
                        await this.handleTimer(true);
                        return;
                    }
                    v.setRawValue(x.rawValue, new Date(x.rawValueAt));
                    cnt++;
                }
                debug.fine('%s values updated', cnt);
            } catch (err) {
                this._values = {};
                debug.warn('request for simple values fails\n%e', err);
            }
        }
    }


}


