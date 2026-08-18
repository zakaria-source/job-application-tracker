import {HttpErrorResponse} from '@angular/common/http';
import {Component, DestroyRef, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {Router} from '@angular/router';
import {switchMap} from 'rxjs';
import {AuthService} from '../../cloud/auth.service';
import {CloudSession, CloudSessionStore} from '../../cloud/cloud-session.store';
import {CloudWorkspaceService, CloudWorkspaceState} from '../../cloud/cloud-workspace.service';
import {StorageService} from '../../services/storage.service';
import {UserProfileService} from '../../services/user-profile.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <section class="account-layout">
      @if (!session) {
        <article class="account-card auth-card">
          <div class="card-icon"><mat-icon>cloud_sync</mat-icon></div>
          <span class="eyebrow">CLOUD OPTIONNEL</span>
          <h2>{{ mode === 'login' ? 'Retrouvez votre espace partout' : 'Créer un compte JobTrackr' }}</h2>
          <p class="lead">
            Le mode local reste disponible sans compte. Une connexion cloud n'envoie jamais vos données locales automatiquement.
          </p>

          <div class="mode-switch" role="tablist" aria-label="Authentification">
            <button type="button" [class.active]="mode === 'login'" (click)="setMode('login')">Connexion</button>
            <button type="button" [class.active]="mode === 'register'" (click)="setMode('register')">Créer un compte</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">
            @if (mode === 'register') {
              <label>
                <span>Nom affiché</span>
                <input formControlName="displayName" autocomplete="name" placeholder="Alex Martin">
              </label>
            }
            <label>
              <span>Email</span>
              <input formControlName="email" type="email" autocomplete="email" placeholder="alex@example.com">
            </label>
            <label>
              <span>Mot de passe</span>
              <input formControlName="password" type="password" [attr.autocomplete]="mode === 'login' ? 'current-password' : 'new-password'" placeholder="10 caractères minimum">
            </label>

            @if (errorMessage) {
              <div class="feedback error"><mat-icon>error_outline</mat-icon><span>{{ errorMessage }}</span></div>
            }

            <button class="primary" type="submit" [disabled]="submitting || form.invalid || (mode === 'register' && !form.controls.displayName.value.trim())">
              <mat-icon>{{ submitting ? 'sync' : mode === 'login' ? 'login' : 'person_add' }}</mat-icon>
              {{ submitting ? 'Connexion…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte' }}
            </button>
          </form>
        </article>

        <aside class="privacy-card">
          <mat-icon>shield_lock</mat-icon>
          <div>
            <strong>Local-first reste le comportement par défaut</strong>
            <p>Vous pouvez continuer à utiliser JobTrackr sans compte. Après connexion, un bouton séparé permet d'importer volontairement les données déjà présentes dans ce navigateur.</p>
          </div>
        </aside>
      } @else {
        <article class="account-card connected-card">
          <div class="connected-heading">
            <div class="avatar">{{ initials(session.user.displayName) }}</div>
            <div>
              <span class="eyebrow">COMPTE CLOUD</span>
              <h2>{{ session.user.displayName }}</h2>
              <p>{{ session.user.email }}</p>
            </div>
            <span class="cloud-state" [class.loading]="workspaceState === 'loading'">
              <span></span>{{ workspaceLabel }}
            </span>
          </div>

          <div class="cloud-benefits">
            <div><mat-icon>database</mat-icon><span><strong>Données serveur</strong><small>PostgreSQL, isolées par compte</small></span></div>
            <div><mat-icon>sync</mat-icon><span><strong>Même espace</strong><small>API prête pour plusieurs appareils</small></span></div>
            <div><mat-icon>lock</mat-icon><span><strong>Accès authentifié</strong><small>Session JWT</small></span></div>
          </div>

          @if (message) {
            <div class="feedback success"><mat-icon>task_alt</mat-icon><span>{{ message }}</span></div>
          }
          @if (errorMessage) {
            <div class="feedback error"><mat-icon>error_outline</mat-icon><span>{{ errorMessage }}</span></div>
          }

          <div class="migration-panel">
            <div>
              <strong>Importer les données de ce navigateur</strong>
              <p>{{ localApplicationCount }} candidature{{ localApplicationCount > 1 ? 's' : '' }} locale{{ localApplicationCount > 1 ? 's' : '' }} détectée{{ localApplicationCount > 1 ? 's' : '' }}. Les doublons côté cloud sont ignorés.</p>
            </div>
            <button type="button" class="secondary accent" [disabled]="syncing || !hasLocalData" (click)="importLocal()">
              <mat-icon>cloud_upload</mat-icon>{{ syncing ? 'Import…' : 'Importer mes données locales' }}
            </button>
          </div>

          <div class="account-actions">
            <button type="button" class="secondary" [disabled]="syncing" (click)="refreshCloud()"><mat-icon>refresh</mat-icon>Actualiser</button>
            <button type="button" class="secondary danger" (click)="logout()"><mat-icon>logout</mat-icon>Se déconnecter</button>
          </div>
        </article>
      }
    </section>
  `,
  styles: [`
    .account-layout { max-width: 860px; display: grid; gap: 18px; }
    .account-card, .privacy-card { border: 1px solid var(--jt-border); border-radius: 22px; background: rgba(255,255,255,.96); box-shadow: var(--jt-shadow-sm); }
    .account-card { padding: 30px; }
    .auth-card { max-width: 620px; }
    .card-icon { width: 48px; height: 48px; display: grid; place-items: center; margin-bottom: 18px; border-radius: 15px; color: #fff; background: linear-gradient(145deg,var(--jt-primary),var(--jt-blue)); box-shadow: 0 10px 24px rgba(79,70,229,.2); }
    .eyebrow { color: var(--jt-primary); font-size: 10px; font-weight: 820; letter-spacing: .14em; }
    h2 { margin: 7px 0 7px; color: var(--jt-text); font-size: 27px; letter-spacing: -.035em; }
    p { color: var(--jt-text-muted); line-height: 1.6; }
    .lead { margin: 0 0 22px; }
    .mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 20px; padding: 4px; border-radius: 12px; background: #f1f5f9; }
    .mode-switch button { min-height: 39px; border: 0; border-radius: 9px; color: var(--jt-text-muted); background: transparent; font-weight: 700; cursor: pointer; }
    .mode-switch button.active { color: var(--jt-text); background: #fff; box-shadow: 0 2px 8px rgba(15,23,42,.07); }
    form { display: grid; gap: 14px; }
    label { display: grid; gap: 7px; color: #334155; font-size: 12px; font-weight: 700; }
    input { min-height: 44px; padding: 0 12px; border: 1px solid var(--jt-border-strong); border-radius: 11px; color: var(--jt-text); background: #fff; font: inherit; }
    input:focus { outline: 3px solid rgba(79,70,229,.12); border-color: var(--jt-primary); }
    button.primary, button.secondary { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 11px; font: inherit; font-weight: 720; cursor: pointer; }
    button.primary { min-height: 44px; margin-top: 4px; border: 0; color: #fff; background: linear-gradient(135deg,var(--jt-primary),var(--jt-blue)); }
    button.primary:disabled, button.secondary:disabled { opacity: .5; cursor: not-allowed; }
    button mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .privacy-card { display: flex; gap: 14px; padding: 18px 20px; }
    .privacy-card > mat-icon { color: var(--jt-success); }
    .privacy-card strong { color: var(--jt-text); font-size: 13px; }
    .privacy-card p { margin: 4px 0 0; font-size: 12px; }
    .connected-heading { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; }
    .avatar { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 16px; color: #fff; background: var(--jt-text); font-weight: 800; }
    .connected-heading h2 { margin: 3px 0 2px; font-size: 22px; }
    .connected-heading p { margin: 0; font-size: 12px; }
    .cloud-state { display: inline-flex; align-items: center; gap: 7px; padding: 7px 10px; border: 1px solid #bbf7d0; border-radius: 999px; color: #15803d; background: #f0fdf4; font-size: 10px; font-weight: 750; }
    .cloud-state > span { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
    .cloud-state.loading { border-color: #bfdbfe; color: #1d4ed8; background: #eff6ff; }
    .cloud-benefits { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 24px; }
    .cloud-benefits > div { display: flex; gap: 9px; padding: 13px; border: 1px solid var(--jt-border); border-radius: 13px; background: var(--jt-surface-muted); }
    .cloud-benefits mat-icon { color: var(--jt-primary); }
    .cloud-benefits span { display: grid; gap: 3px; }
    .cloud-benefits strong { font-size: 11px; }
    .cloud-benefits small { color: var(--jt-text-muted); font-size: 10px; line-height: 1.35; }
    .migration-panel { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 22px; padding: 17px; border: 1px solid #dbeafe; border-radius: 15px; background: #f8fbff; }
    .migration-panel strong { font-size: 13px; }
    .migration-panel p { margin: 4px 0 0; font-size: 11px; }
    button.secondary { min-height: 39px; padding: 0 13px; border: 1px solid var(--jt-border-strong); color: #334155; background: #fff; }
    button.secondary.accent { flex: 0 0 auto; border-color: #c7d2fe; color: var(--jt-primary); }
    button.secondary.danger { color: var(--jt-danger); }
    .account-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    .feedback { display: flex; align-items: flex-start; gap: 8px; margin-top: 16px; padding: 11px 12px; border-radius: 11px; font-size: 12px; line-height: 1.45; }
    .feedback mat-icon { width: 18px; height: 18px; flex: 0 0 18px; font-size: 18px; }
    .feedback.error { color: #be123c; background: #fff1f2; }
    .feedback.success { color: #15803d; background: #f0fdf4; }
    @media (max-width: 700px) { .account-card { padding: 22px; } .connected-heading { grid-template-columns: auto 1fr; } .cloud-state { grid-column: 1 / -1; width: fit-content; } .cloud-benefits { grid-template-columns: 1fr; } .migration-panel { align-items: stretch; flex-direction: column; } .account-actions { flex-direction: column; } button.secondary { width: 100%; } }
  `]
})
export class AccountComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly sessions = inject(CloudSessionStore);
  private readonly workspace = inject(CloudWorkspaceService);
  private readonly storage = inject(StorageService);
  private readonly profiles = inject(UserProfileService);
  private readonly router = inject(Router);

  mode: 'login' | 'register' = 'login';
  session: CloudSession | null = this.sessions.current;
  workspaceState: CloudWorkspaceState = this.workspace.state;
  submitting = false;
  syncing = false;
  errorMessage = '';
  message = '';

  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(10)]]
  });

  constructor() {
    this.sessions.session$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(session => this.session = session);
    this.workspace.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => this.workspaceState = state);
  }

  get workspaceLabel(): string {
    if (this.workspaceState === 'loading') return 'Synchronisation';
    if (this.workspaceState === 'error') return 'Connexion à vérifier';
    return 'Cloud connecté';
  }

  get localApplicationCount(): number {
    return this.storage.getLocalApplicationsSnapshot().length;
  }

  get hasLocalData(): boolean {
    return this.localApplicationCount > 0 || this.profiles.getLocalProfileSnapshot() !== null;
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.errorMessage = '';
    this.message = '';
  }

  submit(): void {
    if (this.form.invalid || (this.mode === 'register' && !this.form.controls.displayName.value.trim())) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.submitting = true;
    this.errorMessage = '';

    const authRequest = this.mode === 'login'
      ? this.auth.login(value.email.trim(), value.password)
      : this.auth.register(value.email.trim(), value.password, value.displayName.trim());

    authRequest.pipe(
      switchMap(() => this.workspace.connect())
    ).subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate([this.profiles.hasProfile() ? '/dashboard' : '/onboarding']);
      },
      error: error => {
        this.submitting = false;
        this.errorMessage = this.readError(error);
      }
    });
  }

  importLocal(): void {
    if (!this.hasLocalData || this.syncing) return;
    this.syncing = true;
    this.errorMessage = '';
    this.message = '';
    this.workspace.importLocalData().subscribe({
      next: summary => {
        this.syncing = false;
        this.message = `${summary.imported} candidature(s) importée(s), ${summary.skipped} doublon(s) ignoré(s).`;
      },
      error: error => {
        this.syncing = false;
        this.errorMessage = this.readError(error);
      }
    });
  }

  refreshCloud(): void {
    this.syncing = true;
    this.errorMessage = '';
    this.workspace.connect().subscribe({
      next: () => {
        this.syncing = false;
        this.message = 'Données cloud actualisées.';
      },
      error: error => {
        this.syncing = false;
        this.errorMessage = this.readError(error);
      }
    });
  }

  logout(): void {
    this.workspace.disconnect();
    this.message = '';
    this.errorMessage = '';
    void this.router.navigate(['/dashboard']);
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'JT';
  }

  private readError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail = typeof error.error === 'object' && error.error !== null && 'detail' in error.error
        ? String((error.error as {detail?: unknown}).detail ?? '')
        : '';
      if (detail) return detail;
      if (error.status === 0) return 'Le backend cloud est indisponible. Le mode local reste utilisable.';
      if (error.status === 401) return 'Email ou mot de passe incorrect.';
      if (error.status === 409) return 'Un compte existe déjà avec cet email.';
    }
    return 'Impossible de terminer cette opération cloud.';
  }
}
