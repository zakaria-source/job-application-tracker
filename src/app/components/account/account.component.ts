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
    <section class="account-layout" [class.signed-out]="!session">
      @if (!session) {
        <article class="auth-shell">
          <aside class="auth-intro">
            <span class="auth-monogram">JT</span>
            <div>
              <span class="eyebrow">JOBTRACKR</span>
              <h2>Votre recherche,<br>au même endroit.</h2>
              <p>Candidatures, relances et entretiens restent organisés dans un espace privé.</p>
            </div>
            <small>Suivi de candidatures · Cloud</small>
          </aside>

          <div class="auth-form-panel">
            <div class="auth-heading">
              <h3>{{ mode === 'login' ? 'Se connecter' : 'Créer un compte' }}</h3>
              <p>{{ mode === 'login' ? 'Accédez à votre espace JobTrackr.' : 'Créez votre espace en quelques secondes.' }}</p>
            </div>

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
          </div>
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
              <span><mat-icon>person_outline</mat-icon><strong>Profil professionnel</strong></span>
              <mat-icon>arrow_forward</mat-icon>
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
    .account-layout { max-width: 640px; margin: 0 auto; }
    .account-layout.signed-out { max-width: 920px; }
    .auth-shell { min-height: 540px; display: grid; grid-template-columns: minmax(280px,.85fr) minmax(360px,1.15fr); overflow: hidden; border: 1px solid var(--jt-border); border-radius: 12px; background: #fff; box-shadow: var(--jt-shadow-md); }
    .auth-intro { display: flex; flex-direction: column; justify-content: space-between; padding: 34px; color: #d4d4d8; background: #151518; }
    .auth-monogram { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #3f3f46; border-radius: 8px; color: #d7d3ff; background: #242429; font-size: 10px; font-weight: 760; }
    .eyebrow { display: block; margin-bottom: 9px; color: #8b93a3; font-size: 9px; font-weight: 720; letter-spacing: .15em; }
    .auth-intro h2 { margin: 0; color: #fff; font-size: 29px; font-weight: 590; letter-spacing: -.045em; line-height: 1.08; }
    .auth-intro p { max-width: 300px; margin: 14px 0 0; color: #a1a1aa; font-size: 12px; line-height: 1.65; }
    .auth-intro small { color: #71717a; font-size: 10px; }
    .auth-form-panel { display: flex; flex-direction: column; justify-content: center; padding: 42px; }
    .auth-heading h3 { margin: 0; color: var(--jt-text); font-size: 23px; font-weight: 640; letter-spacing: -.035em; }
    .auth-heading p { margin: 6px 0 22px; color: var(--jt-text-muted); font-size: 12px; line-height: 1.5; }
    .mode-switch { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 20px; border-bottom: 1px solid var(--jt-border); }
    .mode-switch button { min-height: 39px; border: 0; border-bottom: 2px solid transparent; color: var(--jt-text-muted); background: transparent; font: inherit; font-size: 11px; font-weight: 620; cursor: pointer; }
    .mode-switch button.active { color: var(--jt-text); border-bottom-color: var(--jt-accent); }
    form { display: grid; gap: 14px; }
    label { display: grid; gap: 7px; color: #344054; font-size: 11px; font-weight: 620; }
    input { min-height: 43px; padding: 0 12px; border: 1px solid var(--jt-border-strong); border-radius: 8px; color: var(--jt-text); background: #fff; font: inherit; font-size: 12px; }
    input:focus { outline: none; border-color: var(--jt-accent); box-shadow: 0 0 0 3px rgba(98,91,246,.11); }
    button.primary, button.secondary { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
    button.primary { min-height: 43px; margin-top: 2px; border: 0; color: #fff; background: var(--jt-primary); }
    button.primary:hover { background: var(--jt-primary-strong); }
    button.primary:disabled, button.secondary:disabled { opacity: .5; cursor: not-allowed; }
    button mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .account-card { border: 1px solid var(--jt-border); border-radius: 12px; padding: 28px; background: #fff; box-shadow: var(--jt-shadow-sm); }
    .connected-heading { display: flex; align-items: center; gap: 14px; padding-bottom: 22px; border-bottom: 1px solid var(--jt-border); }
    .avatar { width: 46px; height: 46px; display: grid; place-items: center; flex: 0 0 46px; border: 1px solid #35353c; border-radius: 9px; color: #fff; background: #202024; font-size: 12px; font-weight: 720; }
    .connected-heading h2 { margin: 0; color: var(--jt-text); font-size: 19px; font-weight: 640; letter-spacing: -.025em; }
    .connected-heading p { margin: 4px 0 0; color: var(--jt-text-muted); font-size: 11px; }
    .settings-list { margin-top: 12px; }
    .settings-list a { min-height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 9px; border-radius: 7px; color: var(--jt-text); text-decoration: none; }
    .settings-list a:hover { background: #f7f7f8; }
    .settings-list a > span { display: inline-flex; align-items: center; gap: 9px; }
    .settings-list mat-icon { width: 18px; height: 18px; color: var(--jt-text-muted); font-size: 18px; }
    .settings-list strong { font-size: 12px; font-weight: 620; }
    button.secondary { min-height: 39px; padding: 0 12px; border: 1px solid var(--jt-border-strong); color: var(--jt-text-muted); background: #fff; }
    button.secondary.danger { color: var(--jt-danger); }
    .account-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; padding-top: 17px; border-top: 1px solid var(--jt-border); }
    .feedback { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 10px 11px; border: 1px solid transparent; border-radius: 7px; font-size: 11px; line-height: 1.4; }
    .feedback mat-icon { width: 16px; height: 16px; flex: 0 0 16px; font-size: 16px; }
    .feedback.error { border-color: #fecaca; color: #b42318; background: var(--jt-danger-soft); }
    .feedback.neutral { border-color: var(--jt-border); color: #475467; background: #fafafa; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 760px) { .auth-shell { grid-template-columns: 1fr; } .auth-intro { min-height: 220px; padding: 26px; } .auth-intro small { display: none; } .auth-form-panel { padding: 28px; } }
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
