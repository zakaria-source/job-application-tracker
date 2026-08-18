import {HttpErrorResponse} from '@angular/common/http';
import {Component, DestroyRef, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {Router, RouterLink} from '@angular/router';
import {switchMap} from 'rxjs';
import {AuthService} from '../../cloud/auth.service';
import {CloudSession, CloudSessionStore} from '../../cloud/cloud-session.store';
import {CloudWorkspaceService, CloudWorkspaceState} from '../../cloud/cloud-workspace.service';
import {UserProfileService} from '../../services/user-profile.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, RouterLink],
  template: `
    <section class="account-layout">
      @if (!session) {
        <article class="account-card auth-card">
          <div class="card-icon"><mat-icon>work_outline</mat-icon></div>
          <h2>{{ mode === 'login' ? 'Bon retour' : 'Créer votre compte' }}</h2>
          <p class="lead">Retrouvez vos candidatures sur tous vos appareils.</p>

          <div class="mode-switch" role="tablist" aria-label="Authentification">
            <button type="button" [class.active]="mode === 'login'" (click)="setMode('login')">Connexion</button>
            <button type="button" [class.active]="mode === 'register'" (click)="setMode('register')">Inscription</button>
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
              @if (submitting) { <mat-icon class="spin">progress_activity</mat-icon> }
              {{ submitting ? 'Connexion…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte' }}
            </button>
          </form>
        </article>
      } @else {
        <article class="account-card connected-card">
          <div class="connected-heading">
            <div class="avatar">{{ initials(session.user.displayName) }}</div>
            <div>
              <h2>{{ session.user.displayName }}</h2>
              <p>{{ session.user.email }}</p>
            </div>
          </div>

          @if (workspaceState === 'loading') {
            <div class="feedback neutral"><mat-icon class="spin">progress_activity</mat-icon><span>Synchronisation en cours…</span></div>
          }

          @if (workspaceState === 'error' || errorMessage) {
            <div class="feedback error">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMessage || 'Impossible de synchroniser vos données.' }}</span>
            </div>
          }

          <div class="settings-list">
            <a routerLink="/settings/profile">
              <span><mat-icon>person_outline</mat-icon><strong>Profil</strong></span>
              <mat-icon>chevron_right</mat-icon>
            </a>
          </div>

          <div class="account-actions">
            @if (workspaceState === 'error') {
              <button type="button" class="secondary" (click)="retry()"><mat-icon>refresh</mat-icon>Réessayer</button>
            }
            <button type="button" class="secondary danger" (click)="logout()"><mat-icon>logout</mat-icon>Se déconnecter</button>
          </div>
        </article>
      }
    </section>
  `,
  styles: [`
    .account-layout { max-width: 560px; margin: 0 auto; }
    .account-card { border: 1px solid var(--jt-border); border-radius: 16px; padding: 28px; background: #fff; }
    .auth-card { margin-top: 18px; }
    .card-icon { width: 44px; height: 44px; display: grid; place-items: center; margin-bottom: 18px; border-radius: 12px; color: #fff; background: var(--jt-primary); }
    h2 { margin: 0; color: var(--jt-text); font-size: 26px; font-weight: 780; letter-spacing: -.04em; }
    p { color: var(--jt-text-muted); line-height: 1.5; }
    .lead { margin: 7px 0 22px; font-size: 13px; }
    .mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-bottom: 18px; padding: 3px; border-radius: 11px; background: #f1f5f9; }
    .mode-switch button { min-height: 38px; border: 0; border-radius: 8px; color: var(--jt-text-muted); background: transparent; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
    .mode-switch button.active { color: var(--jt-text); background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
    form { display: grid; gap: 14px; }
    label { display: grid; gap: 7px; color: #334155; font-size: 12px; font-weight: 680; }
    input { min-height: 44px; padding: 0 12px; border: 1px solid var(--jt-border-strong); border-radius: 10px; color: var(--jt-text); background: #fff; font: inherit; font-size: 13px; }
    input:focus { outline: none; border-color: var(--jt-primary); box-shadow: 0 0 0 3px rgba(79,70,229,.1); }
    button.primary, button.secondary { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    button.primary { min-height: 44px; margin-top: 2px; border: 0; color: #fff; background: var(--jt-primary); }
    button.primary:hover { background: var(--jt-primary-strong); }
    button.primary:disabled, button.secondary:disabled { opacity: .5; cursor: not-allowed; }
    button mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .connected-heading { display: flex; align-items: center; gap: 13px; padding-bottom: 22px; border-bottom: 1px solid var(--jt-border); }
    .avatar { width: 48px; height: 48px; display: grid; place-items: center; flex: 0 0 48px; border-radius: 50%; color: #fff; background: var(--jt-text); font-size: 13px; font-weight: 800; }
    .connected-heading h2 { font-size: 20px; }
    .connected-heading p { margin: 3px 0 0; font-size: 12px; }
    .settings-list { margin-top: 14px; }
    .settings-list a { min-height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; border-radius: 10px; color: var(--jt-text); text-decoration: none; }
    .settings-list a:hover { background: var(--jt-surface-muted); }
    .settings-list a > span { display: inline-flex; align-items: center; gap: 9px; }
    .settings-list mat-icon { width: 19px; height: 19px; color: var(--jt-text-muted); font-size: 19px; }
    .settings-list strong { font-size: 13px; }
    button.secondary { min-height: 40px; padding: 0 13px; border: 1px solid var(--jt-border-strong); color: var(--jt-text-muted); background: #fff; }
    button.secondary.danger { color: var(--jt-danger); }
    .account-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--jt-border); }
    .feedback { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 10px 11px; border-radius: 10px; font-size: 12px; line-height: 1.4; }
    .feedback mat-icon { width: 17px; height: 17px; flex: 0 0 17px; font-size: 17px; }
    .feedback.error { color: #b91c1c; background: var(--jt-danger-soft); }
    .feedback.neutral { color: #475569; background: #f8fafc; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 620px) { .account-card { padding: 22px; } .account-actions { flex-direction: column; } button.secondary { width: 100%; } }
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
  errorMessage = '';

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

  setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.errorMessage = '';
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

  retry(): void {
    this.errorMessage = '';
    this.workspace.connect().subscribe({
      error: error => this.errorMessage = this.readError(error)
    });
  }

  logout(): void {
    this.workspace.disconnect();
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
