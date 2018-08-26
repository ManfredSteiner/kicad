import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { FilterPipe } from './pipes/filter-pipe';
import { AppComponent } from './app.component';
import { NavbarComponent } from './navbar.component';
import { TestComponent } from './test.component';
import { GridComponent } from './components/grid.component';
import { OverviewComponent } from './components/overview.component';
import { OverviewChartComponent } from './components/overview-chart.component';
import { FroniusmeterComponent } from './components/froniusmeter.component';
import { FroniusSymoComponent } from './components/fronius-symo.component';
import { Nibe1155Component } from './components/nibe1155.component';

import { ChartsModule } from 'ng4-charts/ng4-charts';
import { AccordionModule, AlertModule, CollapseModule } from 'ngx-bootstrap';



const appRoutes: Routes = [
    { path: '', redirectTo: '/app/overview', pathMatch: 'full' },
    { path: 'app/grid', component: GridComponent },
    { path: 'app/overview', component: OverviewComponent },
    { path: 'app/froniusmeter', component: FroniusmeterComponent },
    { path: 'app/froniussymo', component: FroniusSymoComponent },
    { path: 'app/nibe1155', component: Nibe1155Component }
];

@NgModule({
    declarations: [
        FilterPipe,
        AppComponent, NavbarComponent,
        TestComponent,
        GridComponent,
        OverviewComponent, OverviewChartComponent,
        FroniusmeterComponent,
        FroniusSymoComponent,
        Nibe1155Component
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
