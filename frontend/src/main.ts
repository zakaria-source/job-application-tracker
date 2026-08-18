import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideZoneChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {provideCharts, withDefaultRegisterables} from 'ng2-charts';
import {authInterceptor} from '@app/core/auth/auth.interceptor';
import {App} from './app/app.component';
import {APP_ROUTES} from './app/app.routes';

bootstrapApplication(App, {
  providers: [
    provideCharts(withDefaultRegisterables()),
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(APP_ROUTES)
  ]
}).catch(err => console.error(err));
