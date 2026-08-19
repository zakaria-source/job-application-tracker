import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthSession {
  expiresAt: string;
  sessionExpiresAt?: string;
  user: AuthUser;
  /**
   * Compatibility only: older backend deployments returned the bearer token
   * in the authentication response. New deployments authenticate with
   * HttpOnly access/refresh cookies and omit this field.
   */
  accessToken?: string;
}

@Injectable({providedIn: 'root'})
export class SessionStore {
  private readonly storageKey = 'jobtrackr-cloud-session-v1';
  private readonly fallbackTokenKey = 'jobtrackr-legacy-access-token-v1';
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(this.restore());

  readonly session$: Observable<AuthSession | null> = this.sessionSubject.asObservable();

  get current(): AuthSession | null {
    return this.sessionSubject.value;
  }

  get accessToken(): string | null {
    const token = sessionStorage.getItem(this.fallbackTokenKey)?.trim();
    return token || null;
  }

  isAuthenticated(): boolean {
    const session = this.current;
    if (!session) return false;

    if (this.isSessionExpired(session)) {
      this.clear();
      return false;
    }
    return true;
  }

  save(session: AuthSession): void {
    const fallbackToken = session.accessToken?.trim();
    if (fallbackToken) {
      sessionStorage.setItem(this.fallbackTokenKey, fallbackToken);
    } else {
      sessionStorage.removeItem(this.fallbackTokenKey);
    }

    const sanitized = this.sanitize(session);
    localStorage.setItem(this.storageKey, JSON.stringify(sanitized));
    this.sessionSubject.next(sanitized);
  }

  clear(): void {
    this.removeStoredSession();
    this.sessionSubject.next(null);
  }

  private restore(): AuthSession | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      sessionStorage.removeItem(this.fallbackTokenKey);
      return null;
    }

    try {
      const candidate = JSON.parse(raw) as Partial<AuthSession> & {
        accessToken?: unknown;
        user?: Partial<AuthUser>;
      };
      if (!candidate.expiresAt || !candidate.user?.id || !candidate.user?.email) {
        this.removeStoredSession();
        return null;
      }

      const session = this.sanitize({
        expiresAt: candidate.expiresAt,
        sessionExpiresAt: candidate.sessionExpiresAt,
        user: {
          id: candidate.user.id,
          email: candidate.user.email,
          displayName: candidate.user.displayName ?? candidate.user.email
        }
      });

      if (this.isSessionExpired(session)) {
        this.removeStoredSession();
        return null;
      }

      localStorage.setItem(this.storageKey, JSON.stringify(session));
      return session;
    } catch {
      this.removeStoredSession();
      return null;
    }
  }

  private sanitize(session: AuthSession): AuthSession {
    return {
      expiresAt: session.expiresAt,
      ...(session.sessionExpiresAt ? {sessionExpiresAt: session.sessionExpiresAt} : {}),
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName
      }
    };
  }

  private isSessionExpired(session: AuthSession): boolean {
    const expiresAt = new Date(session.sessionExpiresAt ?? session.expiresAt).getTime();
    return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
  }

  private removeStoredSession(): void {
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.fallbackTokenKey);
  }
}
