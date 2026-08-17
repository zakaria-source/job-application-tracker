import {Routes} from '@angular/router';
import {DashboardComponent} from './components/dashboard/dashboard.component';
import {JobListComponent} from './components/job-list/job-list.component';

export const APP_ROUTES: Routes = [
    {path: 'dashboard', component: DashboardComponent, title: 'JobTrackr · Dashboard'},
    {path: 'applications', component: JobListComponent, title: 'JobTrackr · Candidatures'},
    {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
    {path: '**', redirectTo: 'dashboard'}
];
