import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, catchError, forkJoin, map, tap, throwError} from 'rxjs';
import {ApplicationStore} from '@app/features/applications/data-access/application.store';
import {UserProfileService} from '@app/features/profile/user-profile.service';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {SessionStore} from '@app/core/auth/session.store';

export type WorkspaceState = 'signed-out' | 'loading' | 'ready' | 'error';

@Injectable({providedIn: 'root'})
export class WorkspaceService {
  private readonly stateSubject = new BehaviorSubject<WorkspaceState>('signed-out');
  private bootstrapped = false;

  readonly state$ = this.stateSubject.asObservable();

  constructor(
    private readonly sessions: SessionStore,
    private readonly api: JobTrackrApiService,
    private readonly storage: ApplicationStore,
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
    this.connect().subscribe({
      error: () => undefined
    });
  }

  connect(): Observable<void> {
    if (!this.sessions.isAuthenticated()) {
      this.stateSubject.next('signed-out');
      return throwError(() => new Error('An authenticated session is required'));
    }

    this.stateSubject.next('loading');
    return forkJoin({
      profile: this.api.getProfile(),
      applications: this.api.listApplications()
    }).pipe(
      tap(({profile, applications}) => {
        this.profiles.connect(profile);
        this.storage.connect(applications);
        this.stateSubject.next('ready');
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
    this.storage.clear();
    this.profiles.clear();
    this.stateSubject.next('signed-out');
    this.bootstrapped = false;
  }
}
