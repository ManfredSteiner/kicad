import * as fs from 'fs';
import * as path from 'path';

import * as express from 'express';

import { handleError, RouterError, BadRequestError, AuthenticationError } from './router-error';
import { FroniusMeter } from '../devices/fronius-meter';



import * as debugsx from 'debug-sx';
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

}
