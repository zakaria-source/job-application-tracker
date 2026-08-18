import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, catchError, forkJoin, map, tap, throwError} from 'rxjs';
import {StorageService} from '../services/storage.service';
import {UserProfileService} from '../services/user-profile.service';
import {CloudApiService} from './cloud-api.service';
import {CloudSessionStore} from './cloud-session.store';

export type CloudWorkspaceState = 'signed-out' | 'loading' | 'ready' | 'error';

@Injectable({providedIn: 'root'})
export class CloudWorkspaceService {
  private readonly stateSubject = new BehaviorSubject<CloudWorkspaceState>('signed-out');
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
