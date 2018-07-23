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
    ];

    public chartColors: any [] = [
        { backgroundColor: Array(60).fill('rgba(0,0,0,0)'), borderColor: '#000000', pointRadius: 0 },
        { backgroundColor: Array(60).fill('rgba(0,0,0,0)'), borderColor: '#0000ff', pointRadius: 0 },
        { backgroundColor: Array(60).fill('rgba(0,0,0,0)'), borderColor: '#00ff00', pointRadius: 0 },
        { backgroundColor: Array(60).fill('rgba(0,0,0,0)'), borderColor: '#ff0000', pointRadius: 0 }
    ];

    public showValues: { key: string, value: string } [] = [];

    private _monitorValuesSubsciption: Subscription;


    constructor (private dataService: DataService) {
        console.log('constructor');
        for (let i = 0; i < 60; i++) {
            this.chartLabels.push( (i % 10) === 0 ? (i - 60) + 's' : '');
        }
    }

    public ngOnInit () {
        this._monitorValuesSubsciption =
            this.dataService.monitorObservable.subscribe((value) => this.handleMonitorValues(value));
    }

    public ngOnDestroy() {
        this._monitorValuesSubsciption.unsubscribe();
        this._monitorValuesSubsciption = null;
    }

    public chartClicked(e: any): void {
        console.log(e);
    }

    public chartHovered(e: any): void {
        console.log(e);
    }


    private handleMonitorValues (v: MonitorRecord) {
        this.chartData[0].data.push(v.gridActivePower);
        this.chartData[1].data.push(v.storagePower);
        this.chartData[2].data.push(v.pvActivePower);
        this.chartData[3].data.push(-v.loadActivePower);
        if (this.chartData[0].data.length >  this.chartLabels.length) {
            this.chartData[0].data.splice(0, 1);
            this.chartData[1].data.splice(0, 1);
            this.chartData[2].data.splice(0, 1);
            this.chartData[3].data.splice(0, 1);
        }
        this.chart.chart.update();


        this.showValues = [];
        // const invExt = v.data.inverterExtension.toHumanReadableObject();
        // const inv = v.data.inverter.toHumanReadableObject();
        // this.showValues.push({ key: 'string1_P', value: invExt['string1_Power'] });
        // this.showValues.push({ key: 'string2_P', value: invExt['string2_Power'] });
        // this.showValues.push({ key: 'dcPower', value: inv['dcPower'] });
        this.showValues.push({
            key: 'PV-Süd',
            value: v.data.inverterExtension.string1_Power.toString() + 'W / ' + v.data.froniusRegister.siteEnergyDay + 'Wh'
        });
        this.showValues.push({
            key: 'PV-Ost/West',
            value: v.data.saiaMeter.p + 'W / ' + v.data.saiaMeter.de1 + 'Wh'
        });
        this.showValues.push({
            key: 'Speicher',
            value: v.data.storage.chargeLevelInPercent + '% / ' +
                   (v.data.nameplate.nominalStorageEnergy * v.data.storage.chargeLevelInPercent / 100) + 'Wh'
        });

    }

}

interface IBarChartData {
    data: number [];
    label: string;
    type?: string;
}
