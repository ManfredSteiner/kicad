import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { BaseChartDirective } from 'ng4-charts';
import { DataService } from '../services/data.service';
import { IMonitorRecordData, MonitorRecord } from '../server/monitor-record';

@Component({
    selector: 'app-overview-chart',
    templateUrl: 'overview-chart.component.html',
    styles: [ ``]
})
export class OverviewChartComponent implements OnInit, OnDestroy {

    @ViewChild(BaseChartDirective)
    public chart: BaseChartDirective;

    public chartOptions: any = {
        scaleShowVerticalLines: false,
        responsive: true
    };

    // public barChartLabels: string [] = ['-10', '', '', '', '', '', '0'];
    public chartLabels: string [] = [];
    public chartType = 'line';
    public chartLegend = true;

    public chartData: IBarChartData [] = [
        { data: [], label: 'Netz' },
        { data: [], label: 'Speicher' },
        { data: [], label: 'PV' },
        { data: [], label: 'Verbrauch', type: 'line' },
        { data: [], label: 'Heizung', type: 'line' },
    ];

    public chartColors: any [] = [
        { backgroundColor: 'rgba(0,0,0,0.0)', borderColor: '#000000', pointRadius: 0 },
        { backgroundColor: 'rgba(0,0,0,0.0)', borderColor: '#0000ff', pointRadius: 0 },
        { backgroundColor: 'rgba(0,0,0,0.0)', borderColor: '#00ff00', pointRadius: 0 },
        { backgroundColor: 'rgba(0,0,0,0.0)', borderColor: '#ff0000', pointRadius: 0 },
        { backgroundColor: 'rgba(0,0,0,0.0)', borderColor: '#8b4513', pointRadius: 0 }
    ];

    public showValues: { key: string, value: string, br?: boolean } [] = [];

    private _monitorValuesSubsciption: Subscription;

    constructor (private dataService: DataService) {
        for (let i = 0; i < 60; i++) {
            this.chartLabels.push( (i % 10) === 0 ? (i - 60) + 's' : '');
        }
    }

    public ngOnInit () {
        for (let i = 0; i < 60; i++) {
            for (let j = 0; j < this.chartData.length; j++) {
                this.chartData[j].data.push(null);
            }
        }
        this._monitorValuesSubsciption =
            this.dataService.monitorObservable.subscribe((value) => this.handleMonitorValues(value));
    }

    public ngOnDestroy() {
        this._monitorValuesSubsciption.unsubscribe();
        this._monitorValuesSubsciption = null;
    }

    public chartClicked(e: any): void {
        // console.log(e);
    }

    public chartHovered(e: any): void {
        // console.log(e);
    }


    private handleMonitorValues (v: MonitorRecord) {
        if (!v) {
            this.chartData[0].data.push(null);
            this.chartData[1].data.push(null);
            this.chartData[2].data.push(null);
            this.chartData[3].data.push(null);
            this.chartData[4].data.push(null);
        } else {
            this.chartData[0].data.push(v.gridActivePower);
            this.chartData[1].data.push(v.storagePower);
            this.chartData[2].data.push(v.pvActivePower);
            const heatPumpPower = v.heatingElectricHeaterPower + v.heatingCompressorPower +
                                  v.heatingBrinePumpPower + v.heatingSupplyPumpPower;
            if (typeof(heatPumpPower) === 'number' && !Number.isNaN(heatPumpPower)) {
                this.chartData[3].data.push(-v.loadActivePower + heatPumpPower);
                this.chartData[4].data.push(-heatPumpPower);
            } else {
                this.chartData[3].data.push(-v.loadActivePower);
                this.chartData[4].data.push(null);
            }

        }
        if (this.chartData[0].data.length >  this.chartLabels.length) {
            for (let j = 0; j < this.chartData.length; j++) {
                this.chartData[j].data.splice(0, 1);
            }
        }
        this.chart.chart.update();


        this.showValues = [];
        // const invExt = v.data.inverterExtension.toHumanReadableObject();
        // const inv = v.data.inverter.toHumanReadableObject();
        // this.showValues.push({ key: 'string1_P', value: invExt['string1_Power'] });
        // this.showValues.push({ key: 'string2_P', value: invExt['string2_Power'] });
        // this.showValues.push({ key: 'dcPower', value: inv['dcPower'] });
        if (v) {
            const pv = { key: 'PV', value: '' };
            const pvS = {
                key: 'PV-Süd',
                value: Math.round(v.data.inverterExtension.string1_Power).toString() + 'W / ' +
                       Math.round(v.data.calculated.pvSouthEnergyDaily) + 'Wh' +
                       '(' + Math.round(v.data.froniusRegister.siteEnergyDay) + 'Wh)'
            };
            const pvEW = { key: 'PV-Ost/West', value: '', br: true };
            this.showValues.push(pv);
            this.showValues.push(pvS);
            this.showValues.push(pvEW);

            if (Array.isArray(v.data.extPvMeter) && v.data.extPvMeter.length === 1) {
                pvEW.value = v.data.extPvMeter[0].p + 'W / ' + v.data.extPvMeter[0].de1 + 'Wh';
                pv.value = Math.round(v.data.inverterExtension.string1_Power + v.data.extPvMeter[0].p).toString() + 'W / ' +
                           Math.round(v.data.calculated.pvSouthEnergyDaily + v.data.extPvMeter[0].de1).toString() + 'Wh' ;
            } else {
                pv.value = Math.round(v.data.inverterExtension.string1_Power).toString() + 'W / ' + 
                Math.round(v.data.calculated.pvSouthEnergyDaily).toString() + 'Wh' ;
            }

            const battery = {
                key: 'Speicher',
                value: v.data.storage.chargeLevelInPercent + '% / ' +
                    (v.data.nameplate.nominalStorageEnergy * v.data.storage.chargeLevelInPercent / 100) + 'Wh' +
                    ' (' + v.data.storage.chargeState + ')',
                br: false
            };
            this.showValues.push(battery);
            if (v.data.heating) {
                const x = v.data.heating;
                battery.br = true;
                const hp = {
                    key: 'Wärmepumpe',
                    value: 'Kompressor '
                }
                if (typeof x.compressorFrequency === 'number' && !Number.isNaN(x.compressorFrequency)) {
                    let s = (Math.round(x.compressorFrequency * 10) / 10).toString();
                    if (!s.match(/\.[0-9]$/)) { s += '.0'; }
                    hp.value += s + 'Hz';
                } else {
                    hp.value += '?';
                }
                if (x.brinePumpPower === 0) {
                    hp.value += ' / Sole AUS';
                } else if (x.brinePumpPower > 0) {
                    hp.value += ' / Sole EIN';
                } else {
                    hp.value += ' / Sole ?';
                }
                if (x.supplyPumpPower === 0) {
                    hp.value += ' / Puffer AUS';
                } else if (x.supplyPumpPower > 0) {
                    hp.value += ' / Puffer EIN';
                } else {
                    hp.value += ' / Puffer ?';
                }
                if (x.electricHeaterPower === 0) {
                    hp.value += ' / Elektrostab AUS';
                } else if (x.electricHeaterPower > 0) {
                    hp.value += ' / Elektrostab ' + Math.round(x.electricHeaterPower / 100) / 10 + 'kW';
                } else {
                    hp.value += ' / Elektrostab ?';
                }
                this.showValues.push(hp);
            }
        }

    }

}

interface IBarChartData {
    data: number [];
    label: string;
    type?: string;
}
