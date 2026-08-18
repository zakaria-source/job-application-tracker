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
import {UserProfileService} from '../../services/user-profile.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <section class="account-layout">
      @if (!session) {
        <article class="account-card auth-card">
          <div class="card-icon"><mat-icon>person_outline</mat-icon></div>
          <span class="eyebrow">JOBTRACKR</span>
          <h2>{{ mode === 'login' ? 'Connectez-vous' : 'Créez votre compte' }}</h2>
          <p class="lead">Votre compte sauvegarde vos candidatures et votre profil en ligne.</p>

          <div class="mode-switch" role="tablist" aria-label="Authentification">
            <button type="button" [class.active]="mode === 'login'" (click)="setMode('login')">Connexion</button>
            <button type="button" [class.active]="mode === 'register'" (click)="setMode('register')">Créer un compte</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">
            @if (mode === 'register') {
              <label>
                <span>Nom</span>
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
      } @else {
        <article class="account-card connected-card">
          <div class="connected-heading">
            <div class="avatar">{{ initials(session.user.displayName) }}</div>
            <div>
              <span class="eyebrow">COMPTE</span>
              <h2>{{ session.user.displayName }}</h2>
              <p>{{ session.user.email }}</p>
            </div>
            <span class="cloud-state" [class.loading]="workspaceState === 'loading'" [class.error]="workspaceState === 'error'">
              <span></span>{{ workspaceLabel }}
            </span>
          </div>

          <div class="cloud-benefits">
            <div><mat-icon>cloud_done</mat-icon><span><strong>Sauvegardé</strong><small>Données conservées en ligne</small></span></div>
            <div><mat-icon>devices</mat-icon><span><strong>Multi-appareils</strong><small>Le même espace après connexion</small></span></div>
            <div><mat-icon>lock_outline</mat-icon><span><strong>Privé</strong><small>Données isolées par compte</small></span></div>
          </div>

          @if (message) {
            <div class="feedback success"><mat-icon>task_alt</mat-icon><span>{{ message }}</span></div>
          }
          @if (errorMessage) {
            <div class="feedback error"><mat-icon>error_outline</mat-icon><span>{{ errorMessage }}</span></div>
          }

          <div class="account-actions">
            <button type="button" class="secondary" [disabled]="syncing" (click)="refresh()"><mat-icon>refresh</mat-icon>Actualiser</button>
            <button type="button" class="secondary danger" (click)="logout()"><mat-icon>logout</mat-icon>Se déconnecter</button>
          </div>
        </article>
      }
    </section>
  `,
  styles: [`
    .account-layout { max-width: 700px; display: grid; gap: 14px; }
    .account-card { border: 1px solid var(--jt-border); border-radius: 20px; padding: 26px; background: #fff; box-shadow: var(--jt-shadow-sm); }
    .auth-card { max-width: 560px; }
    .card-icon { width: 44px; height: 44px; display: grid; place-items: center; margin-bottom: 16px; border-radius: 13px; color: var(--jt-primary); background: var(--jt-primary-soft); }
    .eyebrow { color: var(--jt-text-soft); font-size: 9px; font-weight: 800; letter-spacing: .12em; }
    h2 { margin: 6px 0; color: var(--jt-text); font-size: 25px; letter-spacing: -.035em; }
    p { color: var(--jt-text-muted); line-height: 1.55; }
    .lead { margin: 0 0 20px; font-size: 13px; }
    .mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-bottom: 18px; padding: 3px; border-radius: 11px; background: #f1f5f9; }
    .mode-switch button { min-height: 38px; border: 0; border-radius: 8px; color: var(--jt-text-muted); background: transparent; font-weight: 700; cursor: pointer; }
    .mode-switch button.active { color: var(--jt-text); background: #fff; box-shadow: 0 1px 5px rgba(15,23,42,.08); }
    form { display: grid; gap: 13px; }
    label { display: grid; gap: 6px; color: #334155; font-size: 11px; font-weight: 700; }
    input { min-height: 43px; padding: 0 12px; border: 1px solid var(--jt-border-strong); border-radius: 10px; color: var(--jt-text); background: #fff; font: inherit; }
    input:focus { outline: 3px solid rgba(79,70,229,.1); border-color: var(--jt-primary); }
    button.primary, button.secondary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 10px; font: inherit; font-weight: 720; cursor: pointer; }
    button.primary { min-height: 43px; margin-top: 3px; border: 0; color: #fff; background: var(--jt-text); }
    button.primary:disabled, button.secondary:disabled { opacity: .5; cursor: not-allowed; }
    button mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .connected-heading { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; }
    .avatar { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 14px; color: #fff; background: var(--jt-text); font-weight: 800; }
    .connected-heading h2 { margin: 2px 0; font-size: 20px; }
    .connected-heading p { margin: 0; font-size: 11px; }
    .cloud-state { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid #bbf7d0; border-radius: 999px; color: #15803d; background: #f0fdf4; font-size: 9px; font-weight: 750; }
    .cloud-state > span { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
    .cloud-state.loading { border-color: #bfdbfe; color: #1d4ed8; background: #eff6ff; }
    .cloud-state.loading > span { background: #3b82f6; }
    .cloud-state.error { border-color: #fecdd3; color: #be123c; background: #fff1f2; }
    .cloud-state.error > span { background: #e11d48; }
    .cloud-benefits { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 20px; }
    .cloud-benefits > div { display: flex; gap: 8px; padding: 12px; border: 1px solid var(--jt-border); border-radius: 12px; background: var(--jt-surface-muted); }
    .cloud-benefits mat-icon { color: var(--jt-primary); }
    .cloud-benefits span { display: grid; gap: 2px; }
    .cloud-benefits strong { font-size: 10px; }
    .cloud-benefits small { color: var(--jt-text-muted); font-size: 9px; line-height: 1.35; }
    button.secondary { min-height: 37px; padding: 0 12px; border: 1px solid var(--jt-border-strong); color: #334155; background: #fff; }
    button.secondary.danger { color: var(--jt-danger); }
    .account-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 20px; }
    .feedback { display: flex; align-items: flex-start; gap: 7px; margin-top: 14px; padding: 10px 11px; border-radius: 10px; font-size: 11px; line-height: 1.4; }
    .feedback mat-icon { width: 17px; height: 17px; flex: 0 0 17px; font-size: 17px; }
    .feedback.error { color: #be123c; background: #fff1f2; }
    .feedback.success { color: #15803d; background: #f0fdf4; }
    @media (max-width: 700px) { .account-card { padding: 20px; } .connected-heading { grid-template-columns: auto 1fr; } .cloud-state { grid-column: 1 / -1; width: fit-content; } .cloud-benefits { grid-template-columns: 1fr; } .account-actions { flex-direction: column; } button.secondary { width: 100%; } }
  `]
})
export class AccountComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly sessions = inject(CloudSessionStore);
  private readonly workspace = inject(CloudWorkspaceService);
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
    if (this.workspaceState === 'error') return 'À vérifier';
    if (this.workspaceState === 'ready') return 'Synchronisé';
    return 'Déconnecté';
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

  refresh(): void {
    this.syncing = true;
    this.errorMessage = '';
    this.message = '';
    this.workspace.connect().subscribe({
      next: () => {
        this.syncing = false;
        this.message = 'Données actualisées.';
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
    void this.router.navigate(['/account']);
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
      if (error.status === 0) return 'Le serveur JobTrackr est indisponible. Réessayez dans quelques instants.';
      if (error.status === 401) return 'Email ou mot de passe incorrect.';
      if (error.status === 409) return 'Un compte existe déjà avec cet email.';
    }
    return 'Impossible de terminer cette opération.';
  }
}
