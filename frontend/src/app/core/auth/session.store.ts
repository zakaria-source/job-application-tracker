import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

@Injectable({providedIn: 'root'})
export class SessionStore {
  // Keep the existing browser key to preserve active sessions across this internal refactor.
  private readonly storageKey = 'jobtrackr-cloud-session-v1';
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(this.restore());

  readonly session$: Observable<AuthSession | null> = this.sessionSubject.asObservable();

  get current(): AuthSession | null {
    return this.sessionSubject.value;
  }

  get accessToken(): string | null {
    return this.current?.accessToken ?? null;
  }

  isAuthenticated(): boolean {
    return this.current !== null;
  }

  save(session: AuthSession): void {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  clear(): void {
    localStorage.removeItem(this.storageKey);
    this.sessionSubject.next(null);
  }

  private restore(): AuthSession | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      if (!session.accessToken || !session.expiresAt || !session.user?.id || !session.user?.email) {
        this.removeStoredSession();
        return null;
      }

      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        this.removeStoredSession();
        return null;
      }

      return session;
    } catch {
      this.removeStoredSession();
      return null;
    }
  }

  private removeStoredSession(): void {
    localStorage.removeItem(this.storageKey);
  }
}
