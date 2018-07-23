
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('monitor');

import * as nconf from 'nconf';

import { FroniusSymo } from './devices/fronius-symo';
import { PiTechnik } from './devices/pi-technik';
import { MonitorRecord } from './client/monitor-record';
import { IMeter } from './client/fronius-symo-values';
import { ISaiaAle3Meter } from './client/saia-ale3-meter';

interface IMonitorConfig {
    enabled?:          boolean;
    pollPeriodMillis?: number;
}

export class Monitor {
    private static _instance: Monitor;

    public static get Instance (): Monitor {
        if (this._instance === undefined) {
            this._instance = new Monitor();
        }
        return this._instance;
    }

    // ************************************************

    private _config: IMonitorConfig;
    private _timer: NodeJS.Timer;
    private _symo: FroniusSymo;
    private _history: MonitorRecord [] = [];


    private constructor () {
        this._config = nconf.get('monitor') || { enabled: false };
        if (!this._config.pollPeriodMillis) { this._config.pollPeriodMillis = 1000; }
    }

    public async start () {
        if (!this._config.enabled) { return; }
        this._symo = FroniusSymo.getInstance(1);
        this._timer = setInterval( () => this.handleTimerEvent(), this._config.pollPeriodMillis);
        debug.info('Monitor started');
    }


    public stop () {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
            debug.info('Monitor stopped');
        }
    }

    public get latest (): MonitorRecord {
        return this._history.length > 0 ? this._history[this._history.length - 1] : null;
    }

    private async handleTimerEvent () {
        debug.finer('handleTimerEvent');

        try {
            const oldInv = this._symo.inverter;
            const oldInvExt = this._symo.inverterExtension;
            const oldSto = this._symo.storage;
            await Promise.all([
                this._symo.readFroniusRegister(),
                this._symo.readInverter(),
                this._symo.readInverterExtension(),
                this._symo.readStorage()]
            );
            const froReg = this._symo.froniusRegister;
            const inv = this._symo.inverter;
            const invExt = this._symo.inverterExtension;
            const sto = this._symo.storage;
            let hasChanged = false;

            for (const a in froReg.regs) {
                if (!froReg.regs.hasOwnProperty(a)) { continue; }
                const addr = +a.substr(1, 3);
                if (addr < 500 || addr > 510) { continue; }
                const v2 = (<any>inv.regs)[a];
                const v1 = (<any>oldInv.regs)[a];
                if ( v1 !== v2) {
                    debug.finer('froniusRegister changed %s: %s -> %s', a, v1, v2);
                    hasChanged = true;
                }
            }
            for (const a in inv.regs) {
                if (!inv.regs.hasOwnProperty(a)) { continue; }
                const addr = +a.substr(1, 5);
                if (addr < 40072 || addr === 40100 || addr === 40102 || addr >= 40110) { continue; }
                const v2 = (<any>inv.regs)[a];
                const v1 = (<any>oldInv.regs)[a];
                if ( v1 !== v2) {
                    debug.finer('inverter changed %s: %s -> %s', a, v1, v2);
                    hasChanged = true;
                }
            }
            for (const a in invExt.regs) {
                if (!invExt.regs.hasOwnProperty(a)) { continue; }
                const addr = +a.substr(1, 2);
                if (addr < 11 || addr === 25 || addr > 48) { continue; }
                const v2 = (<any>invExt.regs)[a];
                const v1 = (<any>oldInvExt.regs)[a];
                if ( v1 !== v2) {
                    debug.finer('InverterExtension changed %s: %s -> %s', a, v1, v2);
                    hasChanged = true;
                }
            }
            for (const a in sto.regs) {
                if (!sto.regs.hasOwnProperty(a)) { continue; }
                const addr = +a.substr(1, 2);
                if (addr !== 9 && addr === 12) { continue; }
                const v2 = (<any>sto.regs)[a];
                const v1 = (<any>oldSto.regs)[a];
                if ( v1 !== v2) {
                    debug.finer('Storage changed %s: %s -> %s', a, v1, v2);
                    hasChanged = true;
                }
            }
            if (hasChanged) {
                const rv = await Promise.all([
                    PiTechnik.instance.getData(),
                    this._symo.readMeter()
                ]);
                const saiaMeter: ISaiaAle3Meter = rv[0];
                const froniusMeter = this._symo.meter;
                const r = MonitorRecord.create({
                    froniusRegister: froReg,
                    inverter: inv,
                    nameplate: this._symo.nameplate,
                    inverterExtension: invExt,
                    storage: sto,
                    meter: froniusMeter,
                    saiaMeter: saiaMeter
                });
                this._history.push(r);
                if (this._history.length > 60) {
                    this._history.splice(0, 1);
                }
                debug.fine('%O', r.toHumanReadableObject());
            }

        } catch (err) {
            debug.warn(err);
        }
    }
}
