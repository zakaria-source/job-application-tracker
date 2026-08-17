import {Component, DestroyRef, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {StorageService} from './services/storage.service';
import {NotificationService} from './services/notification.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [MatIconModule, RouterLink, RouterLinkActive, RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class App {
    private readonly destroyRef = inject(DestroyRef);

    constructor(
        readonly router: Router,
        storageService: StorageService,
        notificationService: NotificationService
    ) {
        storageService.getApplications()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(applications => notificationService.syncReminders(applications));
    }

    get pageTitle(): string {
        return this.router.url.startsWith('/applications') ? 'Pipeline de candidatures' : 'Vue d’ensemble';
    }

    get pageDescription(): string {
        return this.router.url.startsWith('/applications')
            ? 'Centralisez vos offres, relances, contacts et étapes de recrutement.'
            : 'Les actions et opportunités qui méritent votre attention aujourd’hui.';
    }
}
