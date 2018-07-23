import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { FilterPipe } from './pipes/filter-pipe';
import { AppComponent } from './app.component';
import { TestComponent } from './test.component';
import { GridComponent } from './components/grid.component';
import { OverviewComponent } from './components/overview.component';
import { OverviewChartComponent } from './components/overview-chart.component';
import { FroniusmeterComponent } from './components/froniusmeter.component';
import { FroniusSymoComponent } from './components/fronius-symo.component';

import { ChartsModule } from 'ng4-charts/ng4-charts';
import { AccordionModule, AlertModule, CollapseModule } from 'ngx-bootstrap';



const appRoutes: Routes = [
    { path: '', redirectTo: '/app/grid', pathMatch: 'full' },
    { path: 'app/grid', component: GridComponent },
    { path: 'app/overview', component: OverviewComponent },
    { path: 'app/froniusmeter', component: FroniusmeterComponent },
    { path: 'app/froniussymo', component: FroniusSymoComponent }
];

@NgModule({
    declarations: [
        FilterPipe,
        AppComponent,
        TestComponent,
        GridComponent,
        OverviewComponent, OverviewChartComponent,
        FroniusmeterComponent,
        FroniusSymoComponent
    ],
    imports: [
        BrowserModule,
        FormsModule,
        HttpClientModule,
        RouterModule.forRoot(
          appRoutes,
          { enableTracing: false } // <-- debugging purposes only
        ),
        ChartsModule,
        AccordionModule.forRoot(),
        AlertModule.forRoot(),
        CollapseModule.forRoot()
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule { }
