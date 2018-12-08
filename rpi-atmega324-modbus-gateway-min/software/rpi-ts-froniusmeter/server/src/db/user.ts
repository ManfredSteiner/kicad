import * as mongodb from 'mongodb';

import { IAuthUser, AuthUser } from '../data/common/auth-user';
import * as password from '../utils/password';

export interface IUser {
    userid:         string;
    surname?:       string;
    firstname?:     string;
    password?:      string;
    passwordHash?:  string;
    login?:         IUserLoginLogout;
    logout?:        IUserLoginLogout;
}

export class User implements IUser, IAuthUser {
    private _userid:         string;
    private _surname?:       string;
    private _firstname?:     string;
    private _password?:      string;
    private _passwordHash?:  string;
    private _login?:         UserLoginLogout;
    private _logout?:        UserLoginLogout;

    constructor (data: IUser, ignoredAttributes: string[] = []) {
        try {
            if (!data.userid || typeof(data.userid) !== 'string') { throw new Error('illegal/missing userid'); }
            this._userid = data.userid;

            if (data.surname !== undefined) {
                if (!data.surname || typeof(data.surname) !== 'string') { throw new Error('illegal/missing surname'); }
                this._surname = data.surname;
            }

            if (data.firstname !== undefined) {
                if (!data.firstname || typeof(data.firstname) !== 'string') { throw new Error('illegal/missing firstname'); }
                this._firstname = data.firstname;
            }

            if (data.password !== undefined) {
                if (!data.password || typeof(data.password) !== 'string') { throw new Error('illegal/missing password'); }
                this._password = data.password;
            }

            if (data.passwordHash !== undefined) {
                if (!data.passwordHash || typeof(data.passwordHash) !== 'string') { throw new Error('illegal/missing passwordHash'); }
                this._passwordHash = data.passwordHash;
            }

            if (data.login !== undefined) {
                this._login = new UserLoginLogout(data.login);
            }

            if (data.logout !== undefined) {
                this._logout = new UserLoginLogout(data.logout);
            }

            let ignoredAttributeCount = 0;
            for (const a of ignoredAttributes) {
                if ((<any>data)[a] !== undefined) {
                    ignoredAttributeCount++;
                }
            }

            if (Object.keys(this).length !== Object.keys(data).length - ignoredAttributeCount) {
                throw new Error('illegal attributes');
            }
        } catch (err) {
            console.log(err);
            console.log(data);
            throw new Error('Illegal IUser');
        }
    }

    public toObject (preserveDate?: boolean): IUser {
        const rv: IUser  = { userid:   this._userid };
        if (this._surname !== undefined)      { rv.surname       = this._surname;                         }
        if (this._firstname !== undefined)    { rv.firstname     = this._firstname;                       }
        if (this._password !== undefined)     { rv.password      = this._password;                        }
        if (this._passwordHash !== undefined) { rv.passwordHash  = this._passwordHash;                    }
        if (this._login !== undefined)        { rv.login         = this._login.toObject(preserveDate);    }
        if (this._logout !== undefined)       { rv.logout        = this._logout.toObject(preserveDate);   }
        return rv;
    }

    public toIAuthUser (preserveDate?: boolean): IAuthUser {
        const rv: IAuthUser  = { userid:   this._userid };
        if (this._surname  !== undefined   ) { rv.surname = this._surname;     }
        if (this._firstname  !== undefined ) { rv.firstname = this._firstname; }
        return rv;
    }

    public verifyPassword (value: string): boolean {
        const pwHash = this.passwordHash;
        if (password.isHashed(value)) {
            return value === pwHash;
        } else {
            return password.verify(value, pwHash);
        }
    }

    public get userid (): string {
        return this._userid;
    }

    public get surname (): string {
        return this._surname;
    }

    public get firstname (): string {
        return this._firstname;
    }

    public get password (): string {
        return this._password;
    }

    public get passwordHash (): string {
        return this._passwordHash;
    }

    public get login (): UserLoginLogout {
        return this._login;
    }

    public get logout (): UserLoginLogout {
        return this._logout;
    }


}

// ******************************************************

export interface IUserLoginLogout {
    at: number | Date;
    socket: string;
}

export class UserLoginLogout implements IUserLoginLogout {
    private _at: Date;
    private _socket: string;

    constructor (data: IUserLoginLogout) {
        try {
            if (!data.at) { throw new Error('illegal/missing at'); }
            const atMillis = data.at instanceof Date ? data.at.getTime() : data.at;
            if (isNaN(atMillis) || atMillis < 0) { throw new Error('illegal at'); }
            this._at = new Date(atMillis);

            if (!data.socket || typeof(data.socket) !== 'string') { throw new Error('illegal/missing socket'); }
            this._socket = data.socket;

            if (Object.keys(this).length !== Object.keys(data).length) {
                throw new Error('illegal attributes');
            }
        } catch (err) {
            console.log(err);
            console.log(data);
            throw new Error('Illegal IUserLoginLogout');
        }
    }

    public toObject (preserveDate?: boolean): IUserLoginLogout {
        const rv: IUserLoginLogout  = {
            at: preserveDate ? new Date(this._at) : this._at.getTime(),
            socket: this._socket
        };
        return rv;
    }

    public get at (): Date {
        return this._at;
    }

    public get atMillis (): number {
        return this._at.getTime();
    }

    public get socket (): string {
        return this._socket;
    }

}

// ******************************************************

export interface IDbUserRecord extends IUser {
    _id: string | mongodb.ObjectId;
    createdAt: number | Date;
    savedAt: number | Date;
}

export class DbUserRecord extends User {
    private __id: string;
    private _createdAt: Date;
    private _savedAt: Date;

    constructor (data: IDbUserRecord) {
        super(data, [ '__v', '_id', 'createdAt', 'savedAt' ]);
        try {
            if (data._id instanceof mongodb.ObjectId) {
                this.__id = data._id.toString();
            } else if (typeof data._id === 'string') {
                this.__id = data._id;
            } else {
                throw new Error('invalid _id');
            }

            const createdMillis = data.createdAt instanceof Date ? data.createdAt.getTime() : data.createdAt;
            if (isNaN(createdMillis) || createdMillis <= 0) { throw new Error('invalid createdAt'); }
            this._createdAt = new Date(createdMillis);

            const savedMillis = data.savedAt instanceof Date ? data.savedAt.getTime() : data.savedAt;
            if (isNaN(savedMillis) || savedMillis <= 0) { throw new Error('invalid savedAt'); }
            this._savedAt = new Date(savedMillis);


        } catch (err) {
            console.log(err);
            console.log(data);
            throw new Error('invalid attributes');
        }
    }

    public toObject (preserveDate?: boolean): IDbUserRecord {
        const rv = super.toObject(preserveDate) as IDbUserRecord;
        rv._id = this.__id;
        rv.createdAt = preserveDate ? new Date(this._createdAt) : this._createdAt.getTime();
        rv.savedAt = preserveDate ? new Date(this._savedAt) : this._savedAt.getTime();
        return rv;
    }

    public toIUserObject (preserveDate?: boolean): IUser {
        const rv = super.toObject(preserveDate);
        return rv;
    }

    public get _id (): string {
        return this._id;
    }

    public get createdAt (): Date {
        return this._createdAt;
    }

    public get createdAtMillis (): number {
        return this._createdAt.getTime();
    }

    public get savedAt (): Date {
        return this._savedAt;
    }

    public get savedAtMillis (): number {
        return this._savedAt.getTime();
    }

}
