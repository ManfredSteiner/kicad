import * as mongodb from 'mongodb';
import * as nconf from 'nconf';
import { clearInterval } from 'timers';

import { DbUserRecord, IDbUserRecord } from './user';

import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('database:Database');



export class Database {

    public static async createInstance (): Promise<Database> {
        if (Database._instance) { throw new Error('instance already created'); }
        Database._instance = new Database();
        await Database._instance.start();
        return Database._instance;
    }

    private static _instance: Database;

    public static get Instance (): Database {
        if (!Database._instance) { throw new Error('database not available yet'); }
        return Database._instance;
    }

    // ***************************************

    private _config: IConfigDatabase;
    private _timer: NodeJS.Timer;
    private _dbServer: mongodb.Db;
    private _collUsers: mongodb.Collection;

    private constructor () {
        this._config = nconf.get('database');
    }


    public async getUser (userid: string): Promise<DbUserRecord> {
        const users = await this._collUsers.find<IDbUserRecord>({ userid: userid}).toArray();
        if (!Array.isArray(users) || users.length !== 1 && users[0].userid !== userid) {
            return undefined;
        }
        const u = new DbUserRecord(users[0]);
        return u;
    }


    private async start () {
        try {
            if (this._dbServer) {
                await this._dbServer.close();
            }
        } catch (err) { debug.warn(err); }
        this._dbServer = undefined;
        this._collUsers = undefined;

        const url = this._config && this._config.users ? this._config.users.url : 'mongodb://localhost:27017';
        const db  = this._config && this._config.users ? this._config.users.db : 'prj';
        const collection  = this._config && this._config.users ? this._config.users.collection : 'users';

        try {
            this._dbServer = await mongodb.MongoClient.connect(url);
            this._dbServer.on('error', (err) => this.handleDbEvent('error', err));
            this._dbServer.on('close', (err) => this.handleDbEvent('close', err));
            const dbApp4 = this._dbServer.db(db);
            this._collUsers = await dbApp4.createCollection(collection);
            debug.info('database: connected to %s/%s/%s', url, db, collection);
            if (this._timer !== undefined) {
                clearInterval(this._timer);
                this._timer = undefined;
            }
        } catch (err) {
            debug.fine(err);
            if (this._timer === undefined) {
                this._timer = setInterval(() => this.start(), 5000);
            }
        }
    }

    private handleDbEvent (event: string, err: any) {
        debug.warn('%s: %O', event, err);
        setTimeout(() => this.start(), 1000);
    }
}

interface IConfigCollection {
    url: string;
    db: string;
    collection: string;
}

interface IConfigDatabase {
    users: IConfigCollection;
}
