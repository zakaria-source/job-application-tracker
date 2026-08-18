import {Routes} from '@angular/router';
import {AccountComponent} from '@app/features/account/account.component';
import {DashboardComponent} from '@app/features/dashboard/dashboard.component';
import {ApplicationsPageComponent} from '@app/features/applications/pages/applications-page/applications-page.component';
import {ProfileEditorComponent} from '@app/features/profile/profile-editor.component';
import {authRequiredGuard} from '@app/core/auth/auth-required.guard';

export const APP_ROUTES: Routes = [
    {path: 'account', component: AccountComponent, title: 'JobTrackr · Compte'},
    {path: 'onboarding', component: ProfileEditorComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Bienvenue'},
    {path: 'dashboard', component: DashboardComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Dashboard'},
    {path: 'applications', component: ApplicationsPageComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Candidatures'},
    {path: 'settings/profile', component: ProfileEditorComponent, canActivate: [authRequiredGuard], title: 'JobTrackr · Profil'},
    {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
    {path: '**', redirectTo: 'dashboard'}
];
