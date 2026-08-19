import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthSession {
  expiresAt: string;
  user: AuthUser;
}

@Injectable({providedIn: 'root'})
export class SessionStore {
  // Keep the existing browser key so legacy sessions can be migrated without leaving JWTs behind.
  private readonly storageKey = 'jobtrackr-cloud-session-v1';
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(this.restore());

  readonly session$: Observable<AuthSession | null> = this.sessionSubject.asObservable();

  get current(): AuthSession | null {
    return this.sessionSubject.value;
  }

  isAuthenticated(): boolean {
    const session = this.current;
    if (!session) return false;

    if (this.isExpired(session)) {
      this.clear();
      return false;
    }
    return true;
  }

  save(session: AuthSession): void {
    const sanitized = this.sanitize(session);
    localStorage.setItem(this.storageKey, JSON.stringify(sanitized));
    this.sessionSubject.next(sanitized);
  }

  clear(): void {
    localStorage.removeItem(this.storageKey);
    this.sessionSubject.next(null);
  }

  private restore(): AuthSession | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;

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
        user: {
          id: candidate.user.id,
          email: candidate.user.email,
          displayName: candidate.user.displayName ?? candidate.user.email
        }
      });

      if (this.isExpired(session)) {
        this.removeStoredSession();
        return null;
      }

      // Rewrites legacy storage immediately, stripping any previously persisted accessToken.
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
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName
      }
    };
  }

  private isExpired(session: AuthSession): boolean {
    const expiresAt = new Date(session.expiresAt).getTime();
    return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
  }

  private removeStoredSession(): void {
    localStorage.removeItem(this.storageKey);
  }
}
