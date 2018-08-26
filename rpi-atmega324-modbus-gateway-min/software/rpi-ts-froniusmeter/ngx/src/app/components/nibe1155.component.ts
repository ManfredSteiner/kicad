import { Component, OnInit, OnDestroy } from '@angular/core';
import { DataService } from '../services/data.service';
import { ConfigService } from '../services/config.service';
import * as nibe1155 from '../server/nibe1155-values';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-nibe1155',
    templateUrl: 'nibe1155.component.html',
    styles: [ `
        .form-group {
            margin-bottom: 0.5rem;
        }
        .input-group {
            margin-bottom: 1rem;
        }
        .input-group input {
            background-color: white;
        }
        .filter {
            min-width: 1rem;
            text-align: center;
        }
        .table-sm {
            font-size: 0.75rem;
        }
    `]
})
export class Nibe1155Component implements OnInit, OnDestroy {

    private _nibe1155: nibe1155.INibe1155Values;

    private _accordionData: {
        overview:   IAccordion;
        controller: IAccordion;
        logsetIds:  IAccordion;
        others:     IAccordion;
    };

    private _timer: any;
    private _subsciption: Subscription;
    private _logsetIds: number [];
    private _nonLogsetIds: number [];
    private _values: { [ id: number ]: nibe1155.Nibe1155Value };

    public accordions: IAccordion [];


    public constructor (private _dataService: DataService, private _configService: ConfigService) {
        console.log('constructor');
        const x = this._configService.pop('nibe1155:__accordionData');
        if (x) {
            this._accordionData = x;
        } else {
            this._accordionData = {
                overview:   {
                    infos: [], filter: { isDisabled: false, value: '', filter: null }, isOpen: false, header: 'Überblick'
                },
                controller: { infos: [], filter: {isDisabled: false, value: '', filter: null }, isOpen: false, header: 'Controller'},
                logsetIds:  { infos: [], filter: {isDisabled: false, value: '', filter: null }, isOpen: false, header: 'LOG.SET Register'},
                others:     { infos: [], filter: {isDisabled: false, value: '', filter: null }, isOpen: false, header: 'Weitere Register'}
            };
        }
        this._accordionData.overview.filter.filter = (data) => this.filter(this._accordionData.overview, data);
        this._accordionData.controller.filter.filter = (data) => this.filter(this._accordionData.controller, data);
        this._accordionData.logsetIds.filter.filter = (data) => this.filter(this._accordionData.logsetIds, data);
        this._accordionData.others.filter.filter = (data) => this.filter(this._accordionData.others, data);
    }

    public ngOnInit () {
        console.log('onInit');
        this._nibe1155 = {};
        this._dataService.getNibe1155Values({ controller: true, completeValues: true }).subscribe( (values) => {
            console.log(values);
            if (values.controller) {
                this.handleControllerValues(values.controller);
            }
            this.handleValues(values, true);
            this.handleControllerValues(values.controller);
            this.handleLogsetIds();
            this.handleNonLogsetIds();
        });

        this.accordions = [];
        for (const a in this._accordionData) {
            if (!this._accordionData.hasOwnProperty(a)) { continue; }
            this.accordions.push(this._accordionData[a]);
        }
    }

    public ngOnDestroy() {
        console.log('onDestroy');
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        if (this._subsciption) {
            this._subsciption.unsubscribe();
            this._subsciption = null;
        }
        this._configService.push('nibe1155:__accordionData', this._accordionData);
        this._nibe1155 = null;
    }

    public onAccordionOpenChanged (acc: IAccordion, open: boolean) {
        console.log(acc, open);
    }

    public async onButtonRefresh (a: IAccordion) {
        if (a === this._accordionData.overview) {
            this._dataService.getNibe1155Values().subscribe( (values) => {
                console.log(values);
                // this.handleSymoFroniusRegister(values);
            });

        } else if (a === this._accordionData.controller) {
            this._dataService.getNibe1155Values({ controller: true }).subscribe( (values) => {
                this.handleControllerValues(values.controller);
            });

        } else if (a === this._accordionData.logsetIds) {
            this._dataService.getNibe1155Values({ ids: this._logsetIds }).subscribe( (values) => {
                this.handleValues(values);
                this.handleLogsetIds();
            });

        } else if (a === this._accordionData.others) {
            this._dataService.getNibe1155Values({ ids: this._nonLogsetIds }).subscribe( (values) => {
                this.handleValues(values);
                this.handleNonLogsetIds();
            });

        }
    }

    public changeFilter (event, a: IAccordion) {
        a.filter.value = event;
    }

    public onButtonFilter (a: IAccordion) {
        console.log('onButtonFilter', a);
        if (a && a.filter) {
            a.filter.isDisabled = !a.filter.isDisabled;
        }
    }

    private filter (a: IAccordion, items: IInfo []): any [] {
        let rv: any [];
        if (a.filter.isDisabled || !a.filter.value) {
            rv = items;
        } else {
            rv = [];
            for (const i of items) {
                if (typeof i.key !== 'string') { continue; }
                if (i.key === 'createdAt' || i.key.indexOf(a.filter.value) !== -1) {
                    rv.push(i);
                }
            }
        }
        return rv;
    }


    private handleControllerValues (v: nibe1155.IController) {
        if (!this._nibe1155) { return; }
        if (!v) {
            this._nibe1155.controller = null;
            this._accordionData.controller.infos = [];
        } else {
            const a = this._accordionData.controller;
            a.infos = this.createAccordionInfo(v);
        }

    }

    private handleLogsetIds () {
        const x: { [ key: string ]: string } = {};
        if (Array.isArray(this._logsetIds)) {
            for (const id of this._logsetIds) {
                const v = this._values[id];
                if (!v) {
                    x['? (' + id + ')'] = '?';
                } else {
                    x[v.label + ' (' + v.id + ')'] = v.valueAsString(true);
                }
            }
        }
        const a = this._accordionData.logsetIds;
        console.log(x);
        a.infos = this.createAccordionInfo(x);
    }

    private handleNonLogsetIds () {
        const x: { [ key: string ]: string } = {};
        if (Array.isArray(this._nonLogsetIds)) {
            for (const id of this._nonLogsetIds) {
                const v = this._values[id];
                if (!v) {
                    x['? (' + id + ')'] = '?';
                } else {
                    x[v.label + ' (' + v.id + ')'] = v.valueAsString(true);
                }
            }
        }
        const a = this._accordionData.others;
        console.log(x);
        a.infos = this.createAccordionInfo(x);
    }

    private handleValues (v: nibe1155.INibe1155Values, clear?: boolean) {
        if (clear) {
            if (Array.isArray(v.logsetIds)) {
                this._logsetIds = [].concat(v.logsetIds);
            } else {
                console.log(new Error('unexpected response, missing logsetIds'));
                this._logsetIds = [];
            }
            this._nonLogsetIds = [];
            if (v.completeValues) {
                for (const id in v.completeValues) {
                    if (!v.completeValues.hasOwnProperty(id)) { continue; }
                    if (!Array.isArray(this._logsetIds) || !this._logsetIds.find( (i) => i === +id)) {
                        this._nonLogsetIds.push(+id);
                    }
                }
            }
            console.log(this._logsetIds);
            console.log(this._nonLogsetIds);
            this._values = {};
        }

        if (v.completeValues) {
            let cnt = 0;
            for (const id in v.completeValues) {
                if (!v.completeValues.hasOwnProperty(id)) { continue; }
                this._values[id] = nibe1155.Nibe1155Value.createInstance(v.completeValues[id]);
                cnt++;
            }
            console.log(cnt + ' completeValues defined');
        }
        if (v.simpleValues) {
            let cnt = 0;
            for (const id in v.simpleValues) {
                if (!v.simpleValues.hasOwnProperty(id)) { continue; }
                const x = this._values[+id];
                if (!x) {
                    console.log(new Error('missing complete value for simpleValue id ' + id));
                } else {
                    x.setRawValue(v.simpleValues[id].rawValue, new Date(v.simpleValues[id].rawValueAt));
                    cnt++;
                }
            }
            console.log(cnt + ' simpleValues updated');
        }
    }

    // private handleSymoFroniusRegister (v: symo.IFroniusSymoValues) {
    //     if (!this._symo) { return; }
    //     if (v.froniusRegister) {
    //         if (v.froniusRegister.error) {
    //             this._symo.froniusRegister = null;
    //             this._accordionData.froniusRegister.infos = [];
    //         } else {
    //             const a = this._accordionData.froniusRegister;
    //             this._symo.froniusRegister = new symo.FroniusRegister(v.froniusRegister.createdAt, v.froniusRegister.regs);
    //             a.infos = this.createAccordionInfo(this._symo.froniusRegister.toHumanReadableObject());
    //         }
    //     }
    // }



    private createAccordionInfo (data: any, width?: string): { key: string, value: string, width: string } [] {
        const rv: { key: string, value: string, width: string } [] = [];
        let kLength = 0;
        for (const k in data) {
            if (!data.hasOwnProperty(k)) { continue; }
            let v = data[k];
            if (v instanceof Date) {
                v = v.toLocaleString();
            }
            rv.push( { key: k, value: v, width: width } );
            kLength = Math.max(kLength, k.length);
        }
        if (!width) {
            const w = (kLength / 2 + 1) + 'rem';
            for (const d of rv) {
                d.width = w;
            }
        }
        return rv;
    }

}


interface IFilter {
    isDisabled: boolean;
    value: string;
    filter: (items: any []) => any [];
}

interface ITableRow {
    id: string;
    text: string [];
}

interface IInfo {
    key: string;
    value: string;
    width: string;
}

interface IAccordion {
    isOpen: boolean;
    header: string;
    infos: IInfo [];
    table?: { headers: string [], rows: ITableRow [] };
    filter?: IFilter;
    showComponent?: { name: string, config?: any, data?: any } [];
}
