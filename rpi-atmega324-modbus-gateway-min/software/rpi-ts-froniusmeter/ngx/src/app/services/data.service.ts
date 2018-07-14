import { Injectable, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { Observable, Subscriber, TeardownLogic, of } from 'rxjs';

import { IFroniusMeterValues } from '../server/fronius-meter-values';


@Injectable({ providedIn: 'root' })
export class DataService {

    public froniusMeterObservable: Observable<IFroniusMeterValues>;

    private _serverUri: string;
    private _froniusMeterSubject: Subject<IFroniusMeterValues>;
    private _froniusMeterObservers: Subscriber<IFroniusMeterValues> [] = [];
    private _froniusMeterTimer: any;
    private _froniusMeterValues: IFroniusMeterValues [] = [];

    constructor (private http: HttpClient) {
        this._serverUri = isDevMode() ? 'http://rpi:8080' : '';
        this.froniusMeterObservable = new Observable((s) => this.froniusMeterSubscriber(s));
    }

    public getFroniusMeterValues (): IFroniusMeterValues [] {
        return this._froniusMeterValues;
    }

    private froniusMeterSubscriber (subscriber: Subscriber<IFroniusMeterValues>): TeardownLogic {
        console.log('subscribing...');
        console.log(subscriber);
        const thiz = this;

        this._froniusMeterObservers.push(subscriber);
        if (this._froniusMeterObservers.length === 1) {
            console.log('start request/response...');
            this._froniusMeterTimer = setInterval( () => this.refreshFroniusMeterValues(), 1000);
        }
        return { unsubscribe() {
            thiz._froniusMeterObservers.splice(thiz._froniusMeterObservers.indexOf(subscriber), 1);
            console.log('unsubscribe...');
            if (thiz._froniusMeterObservers.length === 0) {
                console.log('stop request/response...');
                clearInterval(thiz._froniusMeterTimer);
                this._froniusMeterTimer = null;
            }
        } };
    }

    private refreshFroniusMeterValues () {
        console.log('refresh ... ' + this._froniusMeterObservers.length);
        this.http.get(this._serverUri + '/data/froniusmeter').subscribe( (v: IFroniusMeterValues) => {
            console.log(v);
            this._froniusMeterObservers.forEach( (o) => o.next(v));
            this._froniusMeterValues.push(v);
            if (this._froniusMeterValues.length > 60) {
                this._froniusMeterValues.splice(0, 1);
            }
        }, (error) => {
            console.log(error);
            this._froniusMeterObservers.forEach( (o) => o.next(null));
        });
    }


}
