import {Component, DestroyRef, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CloudSessionStore} from './cloud/cloud-session.store';
import {CloudWorkspaceService} from './cloud/cloud-workspace.service';
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
    readonly sessions: CloudSessionStore,
    storageService: StorageService,
    notificationService: NotificationService,
    cloudWorkspace: CloudWorkspaceService
  ) {
    cloudWorkspace.bootstrap();
    storageService.getApplications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(applications => notificationService.syncReminders(applications));
  }

  get isOnboarding(): boolean {
    return this.router.url.startsWith('/onboarding');
  }

  get cloudConnected(): boolean {
    return this.sessions.isAuthenticated();
  }

  get pageTitle(): string {
    if (this.router.url.startsWith('/applications')) return 'Candidatures';
    if (this.router.url.startsWith('/settings/profile')) return 'Profil';
    if (this.router.url.startsWith('/account')) return 'Compte';
    if (this.isOnboarding) return 'Bienvenue sur JobTrackr';
    return 'Vue d’ensemble';
  }

  get pageDescription(): string {
    if (this.router.url.startsWith('/applications')) {
      return 'Suivez chaque opportunité, relance et entretien.';
    }
    if (this.router.url.startsWith('/settings/profile')) {
      return 'Adaptez votre espace à votre recherche.';
    }
    if (this.router.url.startsWith('/account')) {
      return 'Gérez votre connexion et la synchronisation de vos données.';
    }
    if (this.isOnboarding) {
      return this.cloudConnected
        ? 'Complétez votre profil pour démarrer.'
        : 'Quelques informations suffisent pour commencer.';
    }
    return 'Vos prochaines actions et l’état de votre recherche.';
  }
}
