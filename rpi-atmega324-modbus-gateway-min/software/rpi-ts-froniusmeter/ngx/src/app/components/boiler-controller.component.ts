import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { DataService } from '../services/data.service';
import { Subscription } from 'rxjs';
import { MonitorRecord } from '../data/common/monitor-record';
import { ValidatorElement } from '../directives/validator.directive';

@Component({
    selector: 'app-boiler-controller',
    templateUrl: 'boiler-controller.component.html',
    styles: [`
    .ng-valid[required], .ng-valid.required  {
        border-left: 5px solid #00ff00; /* green */
      }
      .ng-invalid:not(form)  {
        border-left: 5px solid #ff0000; /* red */
      }
    `]

})
export class BoilerControllerComponent implements OnInit, OnDestroy {

    @Input() config: any;
    @Input() data: any;

    public validatorMode: ValidatorElement<string>;
    public validatorPin: ValidatorElement<string>;
    public currentMode: string;
    public inputs: IInput [] = [];

    private _monitorValuesSubsciption: Subscription;
    private _inputPower: IInput;
    private _inputPin: IInput;

    constructor (private dataService: DataService) {
        this.currentMode = '?';

        this.validatorMode = new ValidatorElement<string>(
            'off', (e, n, v) => {
                switch (v) {
                    case 'off': {
                        this._inputPower.hidden = true;
                        break;
                    }

                    case 'power': {
                        this._inputPower.hidden = false;
                        break;
                    }
                }
            });


        this._inputPower = {
            id: 'idPower', type: 'number', key: 'Leistung/W', name: 'power',
            min: 0, max: 2000, hidden: true, validator: null, pattern: '[0-9]*', mode: ''
        };
        this._inputPower.validator = new ValidatorElement<number>(2000, null, (e, n, v) => {
            if (Number.isNaN(+v)) { return false; }
            if (+v < 0) { return false; }
            if (+v > 2000) { return false; }
            return true;
        });

        this._inputPin = {
            id: 'idPin', type: 'password', key: 'PIN', name: 'pin',
            min: '', max: '', hidden: false, validator: null, pattern: '[0-9]*', mode: 'numeric'
        };
        this._inputPin.validator = new ValidatorElement<string>('', null, (e, n, v) => {
            if (Number.isNaN(+v)) { return false; }
            const rv = !(+v < 0  || +v > 9999 || (typeof v === 'string' && v.length !== 4));
            return rv;
        });

        this.inputs = [
            this._inputPower, this._inputPin
        ];

    }

    public ngOnInit () {
        this._monitorValuesSubsciption =
            this.dataService.monitorObservable.subscribe((value) => this.handleMonitorValues(value));
    }

    public ngOnDestroy() {
        this._monitorValuesSubsciption.unsubscribe();
        this._monitorValuesSubsciption = null;
    }

    public onSubmit() {
        // this.dataService.setHeatPumpMode({
        //     createdAt:        new Date(),
        //     desiredMode:      this.validatorMode.value,
        //     pin:              this._inputPin.validator.value,
        //     fSetpoint:        this._inputFrequency.validator.value,
        //     fMin:             this._inputFrequencyMin.validator.value,
        //     fMax:             this._inputFrequencyMax.validator.value,
        //     tempSetpoint:     this._inputTemp.validator.value,
        //     tempMin:          this._inputTempMin.validator.value,
        //     tempMax:          this._inputTempMax.validator.value
        // }).subscribe( (rv) =>  {
        //     console.log(rv);
        // }, (error) => {
        //     console.log(error);
        // });
    }

    private handleMonitorValues (v: MonitorRecord) {
        this.currentMode = '??';
        // console.log(v.hwcMonitorRecord);
    }

}

interface IInput {
    id: string;
    key: string;
    type: string;
    name: string;
    min: string | number;
    max: string | number;
    hidden: boolean;
    pattern: string;
    mode: string;
    validator: ValidatorElement<any>;
}
