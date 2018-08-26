import { FroniusRegister, IFroniusRegister, IInverter, Inverter, IInverterExtension, InverterExtension,
         IStorage, Storage, IMeter, Meter, INameplate, Nameplate } from './fronius-symo-values';
import { IFroniusMeterValues } from './fronius-meter-values';
import { ISaiaAle3Meter } from './saia-ale3-meter';

export interface ICalculated {
    pvSouthEnergyDaily: number;
    saiaDe1Offset: number;
    froniusSiteDailyOffset: number;
}

export interface IHeating {
    brinePumpPower: number;
    supplyPumpPower: number;
    compressorPower: number;
    electricHeaterPower: number;
    compressorFrequency: number;
}

export interface IMonitorRecordRawData {
    froniusRegister:   { _createdAt: Date, _regs: IFroniusRegister };
    inverter:          { _createdAt: Date, _regs: IInverter };
    nameplate:         { _createdAt: Date, _regs: INameplate };
    inverterExtension: { _createdAt: Date, _regs: IInverterExtension };
    storage:           { _createdAt: Date, _regs: IStorage };
    meter?:            { _createdAt: Date, _regs: IMeter };
    gridmeter?:        IFroniusMeterValues;
    extPvMeter?:       ISaiaAle3Meter [];
    heating?:          IHeating;
    calculated?:       ICalculated;
}

export interface IMonitorRecordData {
    froniusRegister:   FroniusRegister;
    inverter:          Inverter;
    nameplate:         Nameplate;
    inverterExtension: InverterExtension;
    storage:           Storage;
    meter?:            Meter;
    gridmeter?:        IFroniusMeterValues;
    extPvMeter?:       ISaiaAle3Meter [];
    heating?:          IHeating;
    calculated?:       ICalculated;
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
        };
        if (data.meter) {
            d.meter = new Meter(data.meter._createdAt, data.meter._regs);
        }
        if (data.gridmeter) {
            d.gridmeter = data.gridmeter;
        }
        d.extPvMeter = [];
        if (Array.isArray(data.extPvMeter)) {
            for (const m of data.extPvMeter) {
                d.extPvMeter.push(m);
            }
        }
        if (data.calculated) {
            d.calculated = data.calculated;
        }
        if (data.heating) {
            d.heating = data.heating;
        }
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
        const rv: IMonitorRecordRawData = {
            froniusRegister:   { _createdAt: this._data.froniusRegister.createdAt, _regs: this._data.froniusRegister.regs },
            inverter:          { _createdAt: this._data.inverter.createdAt, _regs: this._data.inverter.regs },
            nameplate:         { _createdAt: this._data.nameplate.createdAt, _regs: this._data.nameplate.regs },
            inverterExtension: { _createdAt: this._data.inverterExtension.createdAt, _regs: this._data.inverterExtension.regs },
            storage:           { _createdAt: this._data.storage.createdAt, _regs: this._data.storage.regs }
        };
        if (this._data.meter) {
            rv.meter = { _createdAt: this._data.meter.createdAt, _regs: this._data.meter.regs };
        }
        if (this._data.gridmeter) {
            rv.gridmeter = this._data.gridmeter;
        }
        rv.extPvMeter = [];
        for (const m of this._data.extPvMeter) {
            rv.extPvMeter.push(m);
        }
        if (this._data.calculated) {
            rv.calculated = this._data.calculated;
        }
        if (this._data.heating) {
            rv.heating = this._data.heating;
        }
        return rv;
    }

    public get pvSouthEnergyDaily (): number {
        return this._data.calculated ? this._data.calculated.pvSouthEnergyDaily : Number.NaN;
    }

    public get gridActivePower (): number {
        if (this._data.gridmeter) {
            return this._data.gridmeter.activePower;
        } else if (this._data.meter) {
            return this._data.meter.activePower;
        } else {
            return Number.NaN;
        }
    }

    public get pvActivePower (): number {
        return this.pvSouthActivePower + this.pvEastWestActivePower;
    }

    public get pvEnergyDaily (): number {
        // return this._data.froniusRegister.siteEnergyDay + this._data.extPvMeter[0].de1;
        return this._data.calculated.pvSouthEnergyDaily + this._data.extPvMeter[0].de1 - this._data.calculated.saiaDe1Offset;
    }

    public get pvEnergy (): number {
        return this._data.froniusRegister.siteEnergyTotal + this._data.extPvMeter[0].e1;
    }

    public get pvSouthActivePower (): number {
        return this._data.inverterExtension.string1_Power;
    }

    public get froniusEnergyDaily (): number {
        return this._data.froniusRegister.siteEnergyDay - this._data.calculated.froniusSiteDailyOffset;
    }

    public get froniusEnergy (): number {
        return this._data.froniusRegister.siteEnergyTotal;
    }

    public get pvEastWestActivePower (): number {
        return this._data.extPvMeter[0].p;
    }

    public get pvEastWestEnergyDaily (): number {
        return this._data.extPvMeter[0].de1 - this._data.calculated.saiaDe1Offset;
    }

    public get pvEastWestEnergy (): number {
        return this._data.extPvMeter[0].e1;
    }

    public get storageEnergyInPercent (): number {
        return this._data.storage.chargeLevelInPercent;
    }

    public get storagePower (): number {
        const sign = this.storageCurrent > 0 ? 1 : -1;
        return sign * this._data.inverterExtension.string2_Power;
    }

    public get storageVoltage (): number {
        return this._data.inverterExtension.string2_Voltage;
    }

    public get storageCurrent (): number {
        if (this.data.inverter.dcPower < 0) { // power AC -> DC ==> charging
            return -this._data.inverterExtension.string2_Current;
        } else if (this._data.storage.isCharging || this._data.storage.isInCalibration) {
            return -this._data.inverterExtension.string2_Current;
        } else if (this._data.storage.isDischarging) {
            return this._data.inverterExtension.string2_Current;
        } else {
            // Fronius storage is able to discharge on 100%, but state is shown as FULL
            return this._data.inverterExtension.string2_Current;
        }
    }

    public get froniusInverterActivePower (): number {
        return this._data.inverter.activePower;
    }

    public get froniusLoadActivePower (): number {
        return this.froniusInverterActivePower + this.gridActivePower;
    }

    public get loadActivePower (): number {
        let rv = this.froniusInverterActivePower;
        rv += this.gridActivePower;
        rv += this.pvEastWestActivePower;
        return rv;
    }


    public get eOut (): number {
        return this._data.gridmeter ? this._data.gridmeter.activeFeedEnergy : Number.NaN;
    }

    public get eIn (): number {
        return this._data.gridmeter ? this._data.gridmeter.activeEnergy : Number.NaN;
    }

    public get heatingBrinePumpPower (): number {
        return this._data.heating.brinePumpPower;
    }

    public get heatingSupplyPumpPower (): number {
        return this._data.heating.supplyPumpPower;
    }

    public get heatingCompressorPower (): number {
        return this._data.heating.compressorPower;
    }

    public get heatingElectricHeaterPower (): number {
        return this._data.heating.electricHeaterPower;
    }

    public get heatingCompressorFrequency (): number {
        return this._data.heating.compressorFrequency;
    }

    public toHumanReadableObject (): Object {
        const rv = {
            gridActivePower:            this.normaliseUnit(this.gridActivePower, 2, 'W'),
            loadActivePower:            this.normaliseUnit(this.loadActivePower, 2, 'W'),
            pvActivePower:              this.normaliseUnit(this.pvActivePower, 2, 'W'),
            pvEnergyDaily:              this.normaliseUnit(this.pvEnergyDaily, 1, 'Wh'),
            pvEnergy:                   this.normaliseUnit(this.pvEnergy, 0, 'Wh'),
            pvSouthActivePower:         this.normaliseUnit(this.pvSouthActivePower, 2, 'W'),
            pvSouthEnergyDaily:         this.normaliseUnit(this.pvSouthEnergyDaily, 1, 'Wh'),
            froniusEnergyDaily:         this.normaliseUnit(this.froniusEnergyDaily, 1, 'Wh'),
            froniusEnergy:              this.normaliseUnit(this.froniusEnergy, 0, 'Wh'),
            pvEastWestActivePower:      this.normaliseUnit(this.pvEastWestActivePower, 2, 'W'),
            pvEastWestEnergyDaily:      this.normaliseUnit(this.pvEastWestEnergyDaily, 1, 'Wh'),
            pvEastWestEnergy:           this.normaliseUnit(this.pvEastWestEnergy, 0, 'Wh'),
            froniusInverterActivePower: this.normaliseUnit(this.froniusInverterActivePower, 2, 'W'),
            storagePower:               this.normaliseUnit(this.storagePower, 2, 'W'),
            storageEnergyInPercent:     this.normaliseUnit(this.storageEnergyInPercent, 0, '%'),
            storageVoltage:             this.normaliseUnit(this.storageVoltage, 2, 'V'),
            storageCurrent:             this.normaliseUnit(this.storageCurrent, 2, 'A'),
            froniusLoadActivePower:     this.normaliseUnit(this.froniusLoadActivePower, 2, 'W'),
            eIn:                        this.normaliseUnit(this.eIn, 2, 'Wh'),
            eOut:                       this.normaliseUnit(this.eOut, 2, 'Wh'),
            heatingBrinePumpPower:      this.normaliseUnit(this.heatingBrinePumpPower, 1, 'W'),
            heatingSupplyPumpPower:     this.normaliseUnit(this.heatingSupplyPumpPower, 1, 'W'),
            heatingCompressorPower:     this.normaliseUnit(this.heatingSupplyPumpPower, 0, 'W'),
            heatingElectricHeaterPower: this.normaliseUnit(this.heatingElectricHeaterPower, 0, 'W'),
            heatingCompressorFrequency: this.normaliseUnit(this.heatingElectricHeaterPower, 1, 'Hz'),
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

