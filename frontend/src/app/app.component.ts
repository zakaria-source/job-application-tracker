import {Component, DestroyRef, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatIconModule} from '@angular/material/icon';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {SessionStore} from '@app/core/auth/session.store';
import {NotificationService} from '@app/core/notifications/notification.service';
import {WorkspaceService} from '@app/core/workspace/workspace.service';
import {ApplicationStore} from '@app/features/applications/data-access/application.store';
import {BrandMarkComponent} from '@app/shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BrandMarkComponent, MatIconModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App {
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    readonly router: Router,
    readonly sessions: SessionStore,
    applicationStore: ApplicationStore,
    notificationService: NotificationService,
    workspace: WorkspaceService
  ) {
    workspace.bootstrap();
    applicationStore.getApplications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(applications => notificationService.syncReminders(applications));
  }

  get isOnboarding(): boolean {
    return this.router.url.startsWith('/onboarding');
  }

  get isPublicEntry(): boolean {
    return !this.cloudConnected && this.router.url.startsWith('/account');
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
    if (this.router.url.startsWith('/settings/profile')) return 'Profil professionnel';
    if (this.router.url.startsWith('/account')) return 'Compte';
    if (this.isOnboarding) return 'Bienvenue';
    return 'Vue d’ensemble';
  }

  get pageDescription(): string {
    if (this.router.url.startsWith('/applications')) return 'Suivez chaque opportunité, du premier envoi à la décision finale.';
    if (this.router.url.startsWith('/settings/profile')) return 'Les informations qui personnalisent votre espace JobTrackr.';
    if (this.router.url.startsWith('/account')) return 'Gérez votre identité et votre session.';
    return 'Vos prochaines actions, entretiens et mouvements de pipeline en un coup d’œil.';
  }
}
