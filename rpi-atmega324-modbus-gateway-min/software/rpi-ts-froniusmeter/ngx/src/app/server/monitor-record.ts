import { FroniusRegister, IFroniusRegister, IInverter, Inverter, IInverterExtension, InverterExtension,
         IStorage, Storage, IMeter, Meter, INameplate, Nameplate } from './fronius-symo-values';
import { ISaiaAle3Meter } from './saia-ale3-meter';

export interface IMonitorRecordRawData {
    froniusRegister:   { _createdAt: Date, _regs: IFroniusRegister };
    inverter:          { _createdAt: Date, _regs: IInverter };
    nameplate:         { _createdAt: Date, _regs: INameplate };
    inverterExtension: { _createdAt: Date, _regs: IInverterExtension };
    storage:           { _createdAt: Date, _regs: IStorage };
    meter:             { _createdAt: Date, _regs: IMeter };
    saiaMeter:         ISaiaAle3Meter;
}

export interface IMonitorRecordData {
    froniusRegister:   FroniusRegister;
    inverter:          Inverter;
    nameplate:         Nameplate;
    inverterExtension: InverterExtension;
    storage:           Storage;
    meter:             Meter;
    saiaMeter:         ISaiaAle3Meter;
}

export class MonitorRecord {

    public static create (data: IMonitorRecordData): MonitorRecord {
        return new MonitorRecord(data);
    }

    public static createFromRawData (data: IMonitorRecordRawData ): MonitorRecord {
        const d: IMonitorRecordData = {
            froniusRegister:   new FroniusRegister(data.froniusRegister._createdAt, data.froniusRegister._regs),
            inverter:          new Inverter(data.inverter._createdAt, data.inverter._regs),
            nameplate:         new Nameplate(data.nameplate._createdAt, data.nameplate._regs),
            inverterExtension: new InverterExtension(data.inverterExtension._createdAt, data.inverterExtension._regs),
            storage:           new Storage(data.storage._createdAt, data.storage._regs),
            meter:             new Meter(data.meter._createdAt, data.meter._regs),
            saiaMeter:         data.saiaMeter
        };
        return new MonitorRecord(d);
    }

    /* tslint:disable:member-ordering */
    private _createdAt: Date;
    private _data: IMonitorRecordData;
    /* tslint:enable:member-ordering */

    private constructor (data: IMonitorRecordData) {
        this._createdAt = new Date();
        this._data = data;
    }

    public get createdAt (): Date {
        return this._createdAt;
    }

    public get data (): IMonitorRecordData {
        return this._data;
    }

    public get rawData (): IMonitorRecordRawData {
        return {
            froniusRegister:   { _createdAt: this._data.froniusRegister.createdAt, _regs: this._data.froniusRegister.regs },
            inverter:          { _createdAt: this._data.inverter.createdAt, _regs: this._data.inverter.regs },
            nameplate:         { _createdAt: this._data.nameplate.createdAt, _regs: this._data.nameplate.regs },
            inverterExtension: { _createdAt: this._data.inverterExtension.createdAt, _regs: this._data.inverterExtension.regs },
            storage:           { _createdAt: this._data.storage.createdAt, _regs: this._data.storage.regs },
            meter:             { _createdAt: this._data.meter.createdAt, _regs: this._data.meter.regs },
            saiaMeter:         this._data.saiaMeter
        };
    }

    public get gridActivePower (): number {
        return this._data.meter.activePower;
    }

    public get pvActivePower (): number {
        return this.pvSouthActivePower + this.pvEastWestActivePower;
    }

    public get pvSouthActivePower (): number {
        return this._data.inverterExtension.string1_Power;
    }

    public get pvEastWestActivePower (): number {
        return this._data.saiaMeter.p;
    }

    public get storageEnergyInPercent (): number {
        return this._data.storage.chargeLevelInPercent;
    }

    public get storagePower (): number {
        const sign = this._data.inverter.dcPower >= this._data.inverterExtension.string2_Power ? 1 : -1;
        return sign * this._data.inverterExtension.string2_Power;
    }

    public get storageVoltage (): number {
        return this._data.inverterExtension.string2_Voltage;
    }

    public get storageCurrent (): number {
        if (this._data.storage.isCharging || this._data.storage.isInCalibration) {
            return -this._data.inverterExtension.string2_Current;
        } else if (this._data.storage.isDischarging) {
            return this._data.inverterExtension.string2_Current;
        } else {
            return 0;
        }
    }

    public get froniusInverterActivePower (): number {
        return this._data.inverter.activePower;
    }

    public get froniusLoadActivePower (): number {
        return this.froniusInverterActivePower + this._data.meter.activePower;
    }

    public get loadActivePower (): number {
        let rv = this.froniusInverterActivePower;
        rv += this.gridActivePower;
        rv += this.pvEastWestActivePower;
        return rv;
    }

    public toHumanReadableObject (): Object {
        const rv = {
            gridActivePower:            this.normaliseUnit(this.gridActivePower, 2, 'W'),
            loadActivePower:            this.normaliseUnit(this.loadActivePower, 2, 'W'),
            pvActivePower:              this.normaliseUnit(this.pvActivePower, 2, 'W'),
            pvSouthActivePower:         this.normaliseUnit(this.pvSouthActivePower, 2, 'W'),
            pvEastWestActivePower:      this.normaliseUnit(this.pvEastWestActivePower, 2, 'W'),
            froniusInverterActivePower: this.normaliseUnit(this.froniusInverterActivePower, 2, 'W'),
            storagePower:               this.normaliseUnit(this.storagePower, 2, 'W'),
            storageEnergyInPercent:     this.normaliseUnit(this.storageEnergyInPercent, 0, '%'),
            storageVoltage:             this.normaliseUnit(this.storageVoltage, 2, 'V'),
            storageCurrent:             this.normaliseUnit(this.storageCurrent, 2, 'A'),
            froniusLoadActivePower:     this.normaliseUnit(this.froniusLoadActivePower, 2, 'W')
        };
        return rv;
    }

    protected normaliseUnit (x: number, digits = 2, unit?: string): string {
        let k: number;
        switch (digits) {
            case 3: k = 1000; break;
            case 2: k = 100; break;
            case 1: k = 10; break;
            case 0:  k = 1; break;
            default: {
                k = 1;
                while (digits > 0) {
                    k *= 10;
                    digits--;
                }
            }
        }
        if (!unit)                   { return (Math.round(x * k) / k).toString(); }
        if (Math.abs(x) >   1000000) { return Math.round(x * k / 1000000) / k + 'M' + unit; }
        if (Math.abs(x) >      1000) { return Math.round(x * k / 1000) / k + 'k' + unit; }
        if (Math.abs(x) >=      0.1) { return Math.round(x * k) / k + unit; }
        if (Math.abs(x) >=    0.001) { return Math.round(x * k * 1000) / k + 'm' + unit; }
        if (Math.abs(x) >= 0.000001) { return Math.round(x * k * 1000000) / k + 'µ' + unit; }
        return x + unit;
    }
}

