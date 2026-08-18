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

  get isOnboarding(): boolean {
    return this.router.url.startsWith('/onboarding');
  }

  get pageTitle(): string {
    if (this.router.url.startsWith('/applications')) {
      return 'Candidatures';
    }
    if (this.router.url.startsWith('/settings/profile')) {
      return 'Profil & préférences';
    }
    if (this.isOnboarding) {
      return 'Bienvenue sur JobTrackr';
    }
    return 'Tableau de bord';
  }

  get pageDescription(): string {
    if (this.router.url.startsWith('/applications')) {
      return 'Pilotez votre pipeline, vos relances et chaque étape du recrutement depuis un seul espace.';
    }
    if (this.router.url.startsWith('/settings/profile')) {
      return 'Ajustez votre positionnement et les informations affichées sur votre tableau de bord.';
    }
    if (this.isOnboarding) {
      return 'Créez votre espace local en quelques informations, puis commencez à suivre vos candidatures.';
    }
    return 'Voyez immédiatement ce qui mérite votre attention : relances, priorités, entretiens et progression.';
  }
}
