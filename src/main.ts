import {provideZoneChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideAnimations} from '@angular/platform-browser/animations';
import {provideCharts, withDefaultRegisterables} from 'ng2-charts';
import {App} from './app/app.component';

bootstrapApplication(App, {
    providers: [
        provideCharts(withDefaultRegisterables()),
        provideZoneChangeDetection(),
        provideAnimations()
    ]
}).catch(err => console.error(err));
