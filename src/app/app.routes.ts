import {Routes} from '@angular/router';
import {AccountComponent} from './components/account/account.component';
import {DashboardComponent} from './components/dashboard/dashboard.component';
import {JobListComponent} from './components/job-list/job-list.component';
import {ProfileEditorComponent} from './components/profile-editor/profile-editor.component';
import {authRequiredGuard} from './guards/auth-required.guard';

export const APP_ROUTES: Routes = [
    {path: 'account', component: AccountComponent, title: 'JobTrackr · Compte'},
    {path: 'onboarding', component: ProfileEditorComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Bienvenue'},
    {path: 'dashboard', component: DashboardComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Dashboard'},
    {path: 'applications', component: JobListComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Candidatures'},
    {path: 'settings/profile', component: ProfileEditorComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Profil'},
    {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
    {path: '**', redirectTo: 'dashboard'}
];
