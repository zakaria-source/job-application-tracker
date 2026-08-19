import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, catchError, finalize, map, of, shareReplay, switchMap, tap} from 'rxjs';
import {AuthSession, SessionStore} from '@app/core/auth/session.store';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly authUrl = '/api/v1/auth';
  private refreshRequest?: Observable<AuthSession>;

  constructor(
    private readonly http: HttpClient,
    private readonly sessions: SessionStore
  ) {}

  login(email: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.authUrl}/login`, {email, password}).pipe(
      tap(session => this.sessions.save(session)),
      switchMap(session => this.ensureCsrfToken().pipe(map(() => session)))
    );
  }

  register(email: string, password: string, displayName: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.authUrl}/register`, {email, password, displayName}).pipe(
      tap(session => this.sessions.save(session)),
      switchMap(session => this.ensureCsrfToken().pipe(map(() => session)))
    );
  }

  refreshSession(): Observable<AuthSession> {
    if (!this.refreshRequest) {
      this.refreshRequest = this.http.post<AuthSession>(`${this.authUrl}/refresh`, {}).pipe(
        tap(session => this.sessions.save(session)),
        switchMap(session => this.ensureCsrfToken().pipe(map(() => session))),
        finalize(() => this.refreshRequest = undefined),
        shareReplay({bufferSize: 1, refCount: false})
      );
    }
    return this.refreshRequest;
  }

  ensureCsrfToken(): Observable<void> {
    return this.http.get(`${this.authUrl}/csrf`).pipe(
      map(() => undefined),
      // During the rollout an older backend may not expose /csrf yet. The
      // compatibility path disappears naturally once the backend is updated.
      catchError(() => of(undefined))
    );
  }

  logout(): Observable<void> {
    return this.ensureCsrfToken().pipe(
      switchMap(() => this.http.post<void>(`${this.authUrl}/logout`, {})),
      catchError(() => of(undefined)),
      tap(() => this.sessions.clear())
    );
  }
}
