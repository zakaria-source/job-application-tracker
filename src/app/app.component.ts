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
    if (this.router.url.startsWith('/applications')) {
      return 'Pipeline de candidatures';
    }
    if (this.router.url.startsWith('/settings/profile')) {
      return 'Profil & préférences';
    }
    if (this.router.url.startsWith('/onboarding')) {
      return 'Bienvenue sur JobTrackr';
    }
    return 'Tableau de bord';
  }

  get pageDescription(): string {
    if (this.router.url.startsWith('/applications')) {
      return 'Candidatures, relances, contacts et étapes de recrutement centralisés au même endroit.';
    }
    if (this.router.url.startsWith('/settings/profile')) {
      return 'Personnalisez le contexte affiché dans votre espace de recherche.';
    }
    if (this.router.url.startsWith('/onboarding')) {
      return 'Créez votre espace local en quelques informations, puis commencez à suivre vos candidatures.';
    }
    return 'Priorités, relances, entretiens et progression de votre recherche d’emploi.';
  }
}
