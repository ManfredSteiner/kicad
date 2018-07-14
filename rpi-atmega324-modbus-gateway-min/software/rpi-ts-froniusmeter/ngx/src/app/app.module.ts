import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { TestComponent } from './test.component';
import { FroniusmeterComponent } from './components/froniusmeter.component';

import { ChartsModule } from 'ng4-charts/ng4-charts';

const appRoutes: Routes = [
    { path: '', redirectTo: '/app/test', pathMatch: 'full' },
    { path: 'app/test', component: TestComponent },
    { path: 'app/froniusmeter', component: FroniusmeterComponent }
];

@NgModule({
    declarations: [
        AppComponent,
        TestComponent,
        FroniusmeterComponent
    ],
    imports: [
        BrowserModule,
        HttpClientModule,
        RouterModule.forRoot(
          appRoutes,
          { enableTracing: false } // <-- debugging purposes only
        ),
        ChartsModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule { }
