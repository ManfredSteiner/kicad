
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('monitor');

import * as fs from 'fs';

import * as nconf from 'nconf';
import { sprintf } from 'sprintf-js';

import { FroniusMeter } from './devices/fronius-meter';
import { FroniusSymo } from './devices/fronius-symo';
import { PiTechnik } from './devices/pi-technik';
import { Nibe1155 } from './devices/nibe1155';
import { MonitorRecord, IMonitorRecordData, ICalculated } from './client/monitor-record';
import { ISaiaAle3Meter } from './client/saia-ale3-meter';
import { Statistics } from './statistics';
import { INibe1155Values } from './client/nibe1155-values';

interface IMonitorConfig {
    disabled?:            boolean;
    periodMillis?:        number;
    timeOffset?:          { sec: number, ms: number };
    froniusPeriodMillis?: number;
    tempFile?:            { path: string; backups?: number };
    saveDebug?:           boolean;
}

interface ITempFileRecord {
    createdAt: Date;
    pvSouthEnergyDaily: number;
    monitorRecord: any;
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
    private _lastFroniusPoll: Date;
    private _lastCaclulated: ICalculated;
    private _pvSouthEnergyDaily = 0;
    private _lastTempCnt = 0;
    private _debugLastTime: string;

    private constructor () {
        const cfg: IMonitorConfig = nconf.get('monitor');
        this._config = cfg || { disabled: true };
        if (!this._config.periodMillis) { this._config.periodMillis = 1000; }
        if (!this._config.froniusPeriodMillis) { this._config.froniusPeriodMillis = 1000; }
        this._lastFroniusPoll = null;
        this._lastCaclulated = { pvSouthEnergyDaily: 0, saiaDe1Offset: 0, froniusSiteDailyOffset: 0 };
    }

    public async start () {
        if (this._config.disabled) { return; }

        if (this._config.tempFile && this._config.tempFile.path) {
            const backups = this._config.tempFile.backups > 0 ? this._config.tempFile.backups : 1;
            let found: ITempFileRecord;
            const now = new Date();
            for (let i = 0; i < backups; i++) {
                const fn = this._config.tempFile.path + '.' + i;
                if (!fs.existsSync(fn)) { continue; }
                try {
                    const s = fs.readFileSync(fn).toString('utf-8');
                    const o: ITempFileRecord = <ITempFileRecord>JSON.parse(s);
                    if (o.pvSouthEnergyDaily >= 0) {
                        o.createdAt = new Date(o.createdAt);
                        if (!found || found.createdAt < o.createdAt) {
                            if (now.toDateString() === o.createdAt.toDateString()) {
                                found = o;
                            }
                        }
                    }
                } catch (err) {
                }
            }
            if (!found) {
                debug.warn('cannot find temporary file...');
            } else {
                debug.info('temporary file found, set pvSouthEnergyDaily to ' + found.pvSouthEnergyDaily);
                this._pvSouthEnergyDaily = found.pvSouthEnergyDaily;
            }
        }

        this._symo = FroniusSymo.getInstance(1);
        if (this._config.timeOffset instanceof Object && this._config.timeOffset.sec > 0 && this._config.timeOffset.ms >= 0) {
            const sec = Math.round(this._config.timeOffset.sec);
            const ms = Math.round(this._config.timeOffset.ms);
            const now = new Date();
            const x = new Date();
            x.setTime(now.getTime() + 60000);
            x.setSeconds(sec); x.setMilliseconds(ms);
            let dt = x.getTime() - now.getTime();
            dt = dt - Math.floor(dt / this._config.froniusPeriodMillis) * this._config.froniusPeriodMillis;
            debug.fine('now = %d, dt = %d', now, dt);
            const thiz = this;
            setTimeout( () => {
                this._lastFroniusPoll = new Date();
                thiz.handleTimerEvent();
                thiz._timer = setInterval( () => thiz.handleTimerEvent(), this._config.periodMillis);
            }, dt);
        } else {
            this._timer = setInterval( () => this.handleTimerEvent(), this._config.periodMillis);
        }
        debug.info('Monitor started');
    }


    public async stop () {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
            debug.info('Monitor stopped');
        }
        return new Promise<void>( (res, rej) => { setTimeout( () => { res(); }, 200); } );
    }

    public get latest (): MonitorRecord {
        return this._history.length > 0 ? this._history[this._history.length - 1] : null;
    }

    private async handleTimerEvent () {
        debug.finer('handleTimerEvent now = %d', Date.now());

        const oldlastFroniusPoll = this._lastFroniusPoll;
        const now = new Date();
        const dayHasChanged =  this._lastFroniusPoll.getDay() !==  now.getDay();

        try {
            if ( (now.getTime() - this._lastFroniusPoll.getTime()) > this._config.froniusPeriodMillis) {
                this._lastFroniusPoll = now;
                debug.fine('polling FroniusSymo');
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

                if (oldInvExt && invExt) {
                    const dt = (invExt.createdAt.getTime() - oldInvExt.createdAt.getTime());
                    if (dt > 0) {
                        const de = invExt.string1_Power * dt  / 1000 / 3600;
                        this._pvSouthEnergyDaily =
                            invExt.createdAt.getDay() !== oldInvExt.createdAt.getDay() ? de : this._pvSouthEnergyDaily + de;
                        if (debug.fine.enabled) {
                            debug.fine('String 1 (PV-South): P=%sW, dt=%sms, dE=%sWh, E-day=%sWh  E-site-day=%sWh',
                                         sprintf('%7.02f',  invExt.string1_Power), dt,
                                         sprintf('%7.03f', de),
                                         sprintf('%9.03f', this._pvSouthEnergyDaily),
                                         sprintf('%8.01f',  froReg.siteEnergyDay)
                                      );
                        }
                    }
                }
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
            }

            // const d = FroniusMeter.getInstance(1);
            const d: FroniusMeter = null;
            const fm = d instanceof FroniusMeter ? d.toValuesObject() : null;
            let saiaMeter: ISaiaAle3Meter;
            if (fm) {
                const rv = await Promise.all([ PiTechnik.instance.getData() ]);
                saiaMeter = rv[0];
            } else {
                const rv = await Promise.all([ PiTechnik.instance.getData(), this._symo.readMeter() ]);
                saiaMeter = rv[0];
            }


            const x: IMonitorRecordData = {
                froniusRegister: this._symo.froniusRegister,
                inverter: this._symo.inverter,
                nameplate: this._symo.nameplate,
                inverterExtension: this._symo.inverterExtension,
                storage: this._symo.storage,
                extPvMeter: [],
                calculated: {
                    pvSouthEnergyDaily: this._pvSouthEnergyDaily,
                    saiaDe1Offset: this._lastCaclulated.saiaDe1Offset,
                    froniusSiteDailyOffset: this._lastCaclulated.froniusSiteDailyOffset
                }
            };
            if (dayHasChanged) {
                x.calculated.saiaDe1Offset = saiaMeter.de1;
                x.calculated.froniusSiteDailyOffset = x.froniusRegister.siteEnergyDay;
            }
            if (x.calculated.saiaDe1Offset > saiaMeter.de1) {
                x.calculated.saiaDe1Offset = 0;
            }
            if (x.calculated.froniusSiteDailyOffset > x.froniusRegister.siteEnergyDay) {
                x.calculated.froniusSiteDailyOffset = 0;
            }
            this._lastCaclulated = x.calculated;

            if (fm) {
                x.gridmeter = fm;
            } else {
                x.meter = this._symo.meter;
            }
            if (saiaMeter) {
                x.extPvMeter.push(saiaMeter);
            }
            const nibe = Nibe1155.Instance;
            if (nibe) {
                x.heatpump = {
                    createdAt: new Date(),
                    controller: nibe.controller,
                    simpleValues: {}
                };
            }
            for (const id of [
                40008, 40012, 40015, 40016, 40017, 40071, 43005, 43084, 43136, 43141, 43427, 43431, 43433, 43437, 43439,
                40004, 40033, 42439, 43416, 45001
            ]) {
                const v = nibe.values[id];
                if (!v || !v.valueAt) { continue; }
                x.heatpump.simpleValues[id] = { rawValue: v.rawValue, rawValueAt: v.valueAt.getTime() };

            }
            this.saveDebugFile(x);
            const r = MonitorRecord.create(x);
            this._history.push(r);
            if (this._history.length > 60) {
                this._history.splice(0, 1);
            }
            Statistics.Instance.handleMonitorRecord(r);
            debug.fine('%O', r.toHumanReadableObject());
            this.saveTemp(r);

        } catch (err) {
            debug.warn(err);
        }
    }

    private saveTemp (r: MonitorRecord) {
        if (!this._config.tempFile || !this._config.tempFile.path) {
            return;
        }
        try {
            const t: ITempFileRecord = {
                createdAt: new Date(),
                pvSouthEnergyDaily: Math.round(this._pvSouthEnergyDaily * 100) / 100,
                monitorRecord: r.toHumanReadableObject()
            };
            const tOut = JSON.stringify(t, null, 2) + '\n';
            const backups = this._config.tempFile.backups > 0 ? this._config.tempFile.backups : 1;
            const index = (this._lastTempCnt + 1) % backups;
            this._lastTempCnt = index;
            const fn = this._config.tempFile.path + '.' + index;
            fs.writeFile(fn, tOut, { encoding: 'utf-8' }, (err) => {
                if (err) {
                    debug.warn('tempFile error\n%e', err);
                } else if (debug.fine.enabled) {
                    debug.fine('temp file ' + fn + 'written');
                }
            } );

        } catch (err) {
            debug.warn('tempFile error\n%e', err);
        }
    }

    private saveDebugFile (x: IMonitorRecordData) {
        if (!this._config.saveDebug) { return; }
        try {
            const ts = new Date();
            const tsString = ts.toLocaleTimeString();
            if (tsString === this._debugLastTime) { return; }
            this._debugLastTime = tsString;
            const filename = sprintf('/var/log/fronius/%04d-%02d-%02d_debug.csv', ts.getFullYear(), ts.getMonth() + 1, ts.getDate());
            let s = '';
            let t = '"Time"';       s = '"' + tsString + '"';
            t += ',"String1-P/Wh"'; s += sprintf(',"%8.01f"', x.inverterExtension.string1_Power);
            t += ',"String1-V/V"';  s += sprintf(',"%8.01f"', x.inverterExtension.string1_Voltage);
            t += ',"String1_I/A"';  s += sprintf(',"%8.02f"', x.inverterExtension.string1_Current);
            t += ',"PVEW-P/Wh"';    s += sprintf(',"%7.02f"', x.extPvMeter[0].p);
            t += ',"PVS-E/Wh"';    s += sprintf(',"%7.02f"', x.calculated.pvSouthEnergyDaily);
            t += ',"PVEW-E/Wh"';    s += sprintf(',"%7.02f"', x.extPvMeter[0].e2);

            if (!fs.existsSync(filename)) {
                fs.writeFileSync(filename, t + '\n');
            }

            s = s.replace(/\./g, ',');
            fs.appendFileSync(filename, s + '\n');
        } catch (err) {
            debug.warn('cannot write debug file...\n%e', err);
        }
    }

}
