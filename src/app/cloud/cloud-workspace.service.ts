import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap, tap, throwError} from 'rxjs';
import {StorageService} from '../services/storage.service';
import {UserProfileService} from '../services/user-profile.service';
import {CloudApiService, CloudImportSummary} from './cloud-api.service';
import {CloudSessionStore} from './cloud-session.store';

export type CloudWorkspaceState = 'local' | 'loading' | 'cloud' | 'error';

@Injectable({providedIn: 'root'})
export class CloudWorkspaceService {
  private readonly stateSubject = new BehaviorSubject<CloudWorkspaceState>('local');
  private bootstrapped = false;

  readonly state$ = this.stateSubject.asObservable();

  constructor(
    private readonly sessions: CloudSessionStore,
    private readonly api: CloudApiService,
    private readonly storage: StorageService,
    private readonly profiles: UserProfileService
  ) {}

  get state(): CloudWorkspaceState {
    return this.stateSubject.value;
  }

  bootstrap(): void {
    if (this.bootstrapped || !this.sessions.isAuthenticated()) {
      return;
    }
    this.bootstrapped = true;
    this.connect().subscribe({
      error: () => this.disconnect()
    });
  }

  connect(): Observable<void> {
    if (!this.sessions.isAuthenticated()) {
      return throwError(() => new Error('A cloud session is required'));
    }

    this.stateSubject.next('loading');
    return forkJoin({
      profile: this.api.getProfile(),
      applications: this.api.listApplications()
    }).pipe(
      tap(({profile, applications}) => {
        this.profiles.connectCloud(profile);
        this.storage.connectCloud(applications);
        this.stateSubject.next('cloud');
      }),
      map(() => undefined),
      catchError(error => {
        this.stateSubject.next('error');
        return throwError(() => error);
      })
    );
  }

  importLocalData(): Observable<CloudImportSummary> {
    const localProfile = this.profiles.getLocalProfileSnapshot();
    const localApplications = this.storage.getLocalApplicationsSnapshot();

    const profileRequest = localProfile
      ? this.api.updateProfile(localProfile)
      : of(null);
    const applicationsRequest = localApplications.length > 0
      ? this.api.importApplications(localApplications)
      : of<CloudImportSummary>({imported: 0, skipped: 0});

    this.stateSubject.next('loading');
    return forkJoin({profile: profileRequest, summary: applicationsRequest}).pipe(
      switchMap(({summary}) => this.connect().pipe(map(() => summary))),
      catchError(error => {
        this.stateSubject.next('error');
        return throwError(() => error);
      })
    );
  }

  disconnect(): void {
    this.sessions.clear();
    this.storage.disconnectCloud();
    this.profiles.disconnectCloud();
    this.stateSubject.next('local');
    this.bootstrapped = false;
  }
}
