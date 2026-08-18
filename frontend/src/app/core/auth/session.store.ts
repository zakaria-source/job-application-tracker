import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

export interface CloudUser {
  id: string;
  email: string;
  displayName: string;
}

export interface CloudSession {
  accessToken: string;
  expiresAt: string;
  user: CloudUser;
}

@Injectable({providedIn: 'root'})
export class SessionStore {
  private readonly storageKey = 'jobtrackr-cloud-session-v1';
  private readonly sessionSubject = new BehaviorSubject<CloudSession | null>(this.restore());

  readonly session$: Observable<CloudSession | null> = this.sessionSubject.asObservable();

  get current(): CloudSession | null {
    return this.sessionSubject.value;
  }

  get accessToken(): string | null {
    return this.current?.accessToken ?? null;
  }

  isAuthenticated(): boolean {
    return this.current !== null;
  }

  save(session: CloudSession): void {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  clear(): void {
    localStorage.removeItem(this.storageKey);
    this.sessionSubject.next(null);
  }

  private restore(): CloudSession | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as CloudSession;
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
