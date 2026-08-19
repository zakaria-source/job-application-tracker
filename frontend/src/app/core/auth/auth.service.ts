import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, catchError, of, tap} from 'rxjs';
import {AuthSession, SessionStore} from '@app/core/auth/session.store';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly authUrl = '/api/v1/auth';

  constructor(
    private readonly http: HttpClient,
    private readonly sessions: SessionStore
  ) {}

  login(email: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.authUrl}/login`, {email, password})
      .pipe(tap(session => this.sessions.save(session)));
  }

  register(email: string, password: string, displayName: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.authUrl}/register`, {email, password, displayName})
      .pipe(tap(session => this.sessions.save(session)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.authUrl}/logout`, {}).pipe(
      catchError(() => of(undefined)),
      tap(() => this.sessions.clear())
    );
  }
}
