import {Routes} from '@angular/router';
import {authRequiredGuard} from '@app/core/auth/auth-required.guard';

export const APP_ROUTES: Routes = [
    {
        path: 'account',
        loadComponent: () => import('@app/features/account/account.component').then(module => module.AccountComponent),
        title: 'JobTrackr · Compte'
    },
    {
        path: 'onboarding',
        loadComponent: () => import('@app/features/profile/profile-editor.component').then(module => module.ProfileEditorComponent),
        canActivate: [authRequiredGuard],
        title: 'JobTrackr · Bienvenue'
    },
    {
        path: 'dashboard',
        loadComponent: () => import('@app/features/dashboard/dashboard.component').then(module => module.DashboardComponent),
        canActivate: [authRequiredGuard],
        title: 'JobTrackr · Dashboard'
    },
    {
        path: 'applications',
        loadComponent: () => import('@app/features/applications/pages/applications-page/applications-page.component')
            .then(module => module.ApplicationsPageComponent),
        canActivate: [authRequiredGuard],
        title: 'JobTrackr · Candidatures'
    },
    {
        path: 'settings/profile',
        loadComponent: () => import('@app/features/profile/profile-editor.component').then(module => module.ProfileEditorComponent),
        canActivate: [authRequiredGuard],
        title: 'JobTrackr · Profil'
    },
    {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
    {path: '**', redirectTo: 'dashboard'}
];
