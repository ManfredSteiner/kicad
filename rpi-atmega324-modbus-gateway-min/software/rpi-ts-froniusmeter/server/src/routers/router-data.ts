import * as fs from 'fs';
import * as path from 'path';

import * as express from 'express';

import { handleError, RouterError, BadRequestError, AuthenticationError } from './router-error';
import { FroniusMeter } from '../devices/fronius-meter';
import { IFroniusSymoValues } from '../data/common/fronius-symo/fronius-symo-values';
import { IMonitorRecordRawData } from '../data/common/monitor-record';
import { Monitor } from '../monitor';



import * as debugsx from 'debug-sx';
import { FroniusSymo } from '../devices/fronius-symo';
import { Nibe1155 } from '../devices/nibe1155';
import { INibe1155Values, Nibe1155Value } from '../data/common/nibe1155/nibe1155-values';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('routers:RouterData');

export class RouterData {

    public static get Instance(): express.Router {
        if (!this._instance) {
            this._instance = new RouterData;
        }
        return this._instance._router;
    }

    private static _instance: RouterData;

    // ******************************************************

    private _router: express.Router;

    private constructor () {
        this._router = express.Router();
        this._router.get('/froniusmeter', (req, res, next) => this.getFroniusMeterJson(req, res, next));
        this._router.get('/froniussymo', (req, res, next) => this.getFroniusSymoJson(req, res, next));
        this._router.get('/monitor', (req, res, next) => this.getMonitorJson(req, res, next));
        this._router.get('/nibe1155', (req, res, next) => this.getNibe1155Json(req, res, next));
        // this._router.get('/*', (req, res, next) => this.getAll(req, res, next));

    }

    private async getAll (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            res.send('OK');
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    private async getFroniusMeterJson (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const fd = FroniusMeter.getInstance(req.query.address ? req.query.address : 1);
            let rv: any;
            if (!fd) {
                rv = { error: 'device not found' };
            } else {
                rv = fd.toValuesObject();
            }
            debug.fine('query %o -> response: %o', req.query, rv);
            res.json(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    private async getFroniusSymoJson (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const symo = FroniusSymo.getInstance(req.query.address ? req.query.address : 1);
            // const d = FroniusSymo.getInstance(1);

            const rv: IFroniusSymoValues = {};
             if (req.query.all !== undefined || req.query.froniusregister !== undefined) {
                try {
                    const froniusRegister = await symo.readFroniusRegister();
                    rv.froniusRegister = { createdAt: froniusRegister.createdAt, regs: froniusRegister.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo froniusRegister fails\n%e', now.toISOString(), err);
                    rv.froniusRegister = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.common !== undefined) {
                try {
                    const common = await symo.readCommon();
                    rv.common = { createdAt: common.createdAt, regs: common.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo common fails\n%e', now.toISOString(), err);
                    rv.common = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.inverter !== undefined) {
                try {
                    const inverter = await symo.readInverter();
                    rv.inverter = { createdAt: inverter.createdAt, regs: inverter.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo inverter fails\n%e', now.toISOString(), err);
                    rv.inverter = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.nameplate !== undefined) {
                try {
                    const nameplate = await symo.readNameplate();
                    rv.nameplate = { createdAt: nameplate.createdAt, regs: nameplate.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo nameplate fails\n%e', now.toISOString(), err);
                    rv.nameplate = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.setting !== undefined) {
                try {
                    const setting = await symo.readSetting();
                    rv.setting = { createdAt: setting.createdAt, regs: setting.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo setting fails\n%e', now.toISOString(), err);
                    rv.setting = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.status !== undefined) {
                try {
                    const status = await symo.readStatus();
                    rv.status = { createdAt: status.createdAt, regs: status.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo status fails\n%e', now.toISOString(), err);
                    rv.status = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.control !== undefined) {
                try {
                    const control = await symo.readControl();
                    rv.control = { createdAt: control.createdAt, regs: control.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo control fails\n%e', now.toISOString(), err);
                    rv.control = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.storage !== undefined) {
                try {
                    const storage = await symo.readStorage();
                    rv.storage = { createdAt: storage.createdAt, regs: storage.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo storage fails\n%e', now.toISOString(), err);
                    rv.storage = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.inverterExtension !== undefined) {
                try {
                    const inverterExtension = await symo.readInverterExtension();
                    rv.inverterExtension = { createdAt: inverterExtension.createdAt, regs: inverterExtension.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo inverterExtension fails\n%e', now.toISOString(), err);
                    rv.inverterExtension = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.stringCombiner !== undefined) {
                try {
                    const stringCombiner = await symo.readStringCombiner();
                    rv.stringCombiner = { createdAt: stringCombiner.createdAt, regs: stringCombiner.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo stringCombiner fails\n%e', now.toISOString(), err);
                    rv.stringCombiner = { createdAt: now, error: err.toString() };
                }
            }
            if (req.query.all !== undefined || req.query.meter !== undefined) {
                try {
                    const meter = await symo.readMeter();
                    rv.meter = { createdAt: meter.createdAt, regs: meter.regs };
                } catch (err) {
                    const now = new Date();
                    debug.warn('%s: reading symo meter fails\n%e', now.toISOString(), err);
                    rv.meter = { createdAt: now, error: err.toString() };
                }
            }
            debug.fine('query %o -> response: %o', req.query, rv);
            res.json(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }


    private async getMonitorJson (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const monitor = Monitor.Instance;
            const rv: IMonitorRecordRawData [] = [];
            if (req.query.latest !== undefined || Object.keys(req.query).length === 0) {
                const d = monitor.latest;
                if (d) {
                    rv.push(d.rawData);
                }
            }
            debug.fine('query %o -> response: %o', req.query, rv);
            res.json(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    private async getNibe1155Json (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const nibe = Nibe1155.Instance;
            const ids: number [] = [];
            if (req.query.id !== undefined) {
                const strIds: string [] = Array.isArray(req.query.id) ? req.query.id : [ req.query.id ];
                for (const strId of strIds) {
                    const id = +strId;
                    if (id < 0 || id > 0xffff) {
                        throw new BadRequestError('invalid id');
                    }
                    ids.push(id);
                }
            }
            const rv: INibe1155Values = {
                controller: req.query.controller && req.query.controller === 'false' ? undefined : nibe.controller,
                // monitor: statistics.latest.toObject(),
                // others: {}
                simpleValues: req.query.simpleValues && req.query.simpleValues === 'false' ? undefined : {},
                completeValues: req.query.completeValues && req.query.completeValues === 'false' ? undefined : {},
                logsetIds: req.query.logsetIds && req.query.logsetIds === 'false' ? undefined : nibe.logsetIds
            };
            const values = nibe.values;
            for (const id in values) {
                if (!values.hasOwnProperty(id)) { continue; }
                const x = values[id];
                if (ids.length > 0 && !ids.find( (i) => i === x.id)) { continue; }
                if (!(x instanceof Nibe1155Value)) { continue; }
                if (rv.completeValues) {
                    rv.completeValues[id] = x.toObject();
                }
                if (rv.simpleValues) {
                    rv.simpleValues[id] = {
                        rawValue: x.rawValue,
                        rawValueAt: x.valueAt ? x.valueAt.getTime() : null
                    };
                }
            }
            debug.fine('query %o -> response: %o', req.query, rv);
            res.json(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }


}
