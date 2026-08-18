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

  get accountInitials(): string {
    const name = this.sessions.current?.user.displayName ?? 'JT';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'JT';
  }

  get pageTitle(): string {
    if (this.router.url.startsWith('/applications')) return 'Candidatures';
    if (this.router.url.startsWith('/settings/profile')) return 'Profil';
    if (this.router.url.startsWith('/account')) return 'Compte';
    if (this.isOnboarding) return 'Bienvenue';
    return 'Vue d’ensemble';
  }
}
