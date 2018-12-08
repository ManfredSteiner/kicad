
import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('routers:RouterControl');

import * as fs from 'fs';
import * as path from 'path';

import * as express from 'express';

import { handleError, RouterError, BadRequestError, AuthenticationError } from './router-error';
import { IHeatpumpMode } from '../data/common/monitor-record';
import { Nibe1155 } from '../devices/nibe1155';


export class RouterControl {

    public static get Instance(): express.Router {
        if (!this._instance) {
            this._instance = new RouterControl;
        }
        return this._instance._router;
    }

    private static _instance: RouterControl;

    // ******************************************************

    private _router: express.Router;

    private constructor () {
        this._router = express.Router();
        this._router.get('/heatpumpmode', (req, res, next) => this.getHeatpumpmode(req, res, next));
        this._router.post('/heatpumpmode', (req, res, next) => this.postHeatpumpmode(req, res, next));

    }

    private async getHeatpumpmode (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            res.send({ ok: true});
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

    private async postHeatpumpmode (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            debug.warn(req.body);
            const x: IHeatpumpMode = req.body;
            if (!x || !x.createdAt || !x.desiredMode) { throw new BadRequestError('invalid request'); }
            if (x.pin === undefined) { throw new AuthenticationError('missing pin'); }
            const rv = await Nibe1155.Instance.setHeatpumpMode(x);
            res.send(rv);
        } catch (err) {
            handleError(err, req, res, next, debug);
        }
    }

}
