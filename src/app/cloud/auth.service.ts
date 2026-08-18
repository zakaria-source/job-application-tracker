import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, tap} from 'rxjs';
import {CloudSession, CloudSessionStore} from './cloud-session.store';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly authUrl = '/api/v1/auth';

  constructor(
    private readonly http: HttpClient,
    private readonly sessions: CloudSessionStore
  ) {}

  login(email: string, password: string): Observable<CloudSession> {
    return this.http.post<CloudSession>(`${this.authUrl}/login`, {email, password})
      .pipe(tap(session => this.sessions.save(session)));
  }

  register(email: string, password: string, displayName: string): Observable<CloudSession> {
    return this.http.post<CloudSession>(`${this.authUrl}/register`, {email, password, displayName})
      .pipe(tap(session => this.sessions.save(session)));
  }

  logout(): void {
    this.sessions.clear();
  }
}
