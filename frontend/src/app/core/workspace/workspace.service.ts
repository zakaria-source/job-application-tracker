import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, catchError, map, tap, throwError} from 'rxjs';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {AuthService} from '@app/core/auth/auth.service';
import {SessionStore} from '@app/core/auth/session.store';
import {ApplicationStore} from '@app/features/applications/data-access/application.store';
import {UserProfileService} from '@app/features/profile/user-profile.service';

export type WorkspaceState = 'signed-out' | 'loading' | 'ready' | 'error';

@Injectable({providedIn: 'root'})
export class WorkspaceService {
  private readonly stateSubject = new BehaviorSubject<WorkspaceState>('signed-out');
  private bootstrapped = false;

  readonly state$ = this.stateSubject.asObservable();

  constructor(
    private readonly sessions: SessionStore,
    private readonly auth: AuthService,
    private readonly api: JobTrackrApiService,
    private readonly applications: ApplicationStore,
    private readonly profiles: UserProfileService
  ) {}

  get state(): WorkspaceState {
    return this.stateSubject.value;
  }

  bootstrap(): void {
    if (this.bootstrapped || !this.sessions.isAuthenticated()) {
      return;
    }

    this.bootstrapped = true;
    this.connect().subscribe({error: () => undefined});
  }

  connect(): Observable<void> {
    if (!this.sessions.isAuthenticated()) {
      this.stateSubject.next('signed-out');
      return throwError(() => new Error('An authenticated session is required'));
    }

    this.stateSubject.next('loading');
    return this.api.getWorkspaceBootstrap().pipe(
      tap(({profile, applications}) => {
        this.profiles.connect(profile);
        this.applications.connect(applications);
        this.stateSubject.next('ready');
        // Prepare CSRF for later mutations without delaying the first usable render.
        this.auth.ensureCsrfToken().subscribe({error: () => undefined});
      }),
      map(() => undefined),
      catchError(error => {
        this.stateSubject.next('error');
        return throwError(() => error);
      })
    );
  }

  disconnect(): void {
    this.sessions.clear();
    this.applications.clear();
    this.profiles.clear();
    this.stateSubject.next('signed-out');
    this.bootstrapped = false;
  }
}
