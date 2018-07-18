import * as fs from 'fs';
import * as path from 'path';

import * as express from 'express';

import { handleError, RouterError, BadRequestError, AuthenticationError } from './router-error';
import { FroniusMeter } from '../devices/fronius-meter';
import { IFroniusSymoValues } from '../client/fronius-symo-values';



import * as debugsx from 'debug-sx';
import { FroniusSymo } from '../devices/fronius-symo';
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
        this._router.get('/*', (req, res, next) => this.getAll(req, res, next));

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
            if (!fd) {
                res.json({ error: 'device not found' });
            } else {
                res.json(fd.toValuesObject());
            }
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
            debug.info('query %o -> response: %o', req.query, rv);
            res.json(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

}
