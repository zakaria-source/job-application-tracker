import {Routes} from '@angular/router';
import {AccountComponent} from './components/account/account.component';
import {DashboardComponent} from './components/dashboard/dashboard.component';
import {JobListComponent} from './components/job-list/job-list.component';
import {ProfileEditorComponent} from './components/profile-editor/profile-editor.component';
import {profileRequiredGuard} from './guards/profile-required.guard';

export const APP_ROUTES: Routes = [
    {path: 'onboarding', component: ProfileEditorComponent, title: 'JobTrackr · Bienvenue'},
    {path: 'dashboard', component: DashboardComponent, canActivate: [profileRequiredGuard], title: 'JobTrackr · Dashboard'},
    {path: 'applications', component: JobListComponent, canActivate: [profileRequiredGuard], title: 'JobTrackr · Candidatures'},
    {path: 'settings/profile', component: ProfileEditorComponent, title: 'JobTrackr · Profil'},
    {path: 'account', component: AccountComponent, title: 'JobTrackr · Compte'},
    {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
    {path: '**', redirectTo: 'dashboard'}
];
