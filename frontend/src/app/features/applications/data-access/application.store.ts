import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError} from 'rxjs';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {ApplicationAnalyticsService} from '@app/features/applications/domain/application-analytics.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {FollowUpService} from '@app/features/applications/domain/follow-up.service';
import {JobStatistics, Suggestion} from '@app/features/applications/models/application-analytics.model';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';
import {FollowUp} from '@app/features/applications/models/application-tracking.model';
import {ApplicationImportService} from './application-import.service';

@Injectable({providedIn: 'root'})
export class ApplicationStore {
  private applications: JobApplication[] = [];
  private readonly applicationsSubject = new BehaviorSubject<JobApplication[]>([]);

  constructor(
    private readonly api: JobTrackrApiService,
    private readonly analytics: ApplicationAnalyticsService,
    private readonly followUps: FollowUpService,
    private readonly workflow: ApplicationWorkflowService,
    private readonly imports: ApplicationImportService
  ) {}

  getApplications(): Observable<JobApplication[]> {
    return this.applicationsSubject.asObservable();
  }

  connect(applications: readonly JobApplication[]): void {
    this.applications = applications.map(application => this.cloneApplication(application));
    this.publish();
  }

  clear(): void {
    this.applications = [];
    this.publish();
  }

  refresh(): Observable<JobApplication[]> {
    return this.api.listApplications().pipe(
      tap(applications => this.connect(applications))
    );
  }

  loadApplication(id: string): Observable<JobApplication> {
    return this.api.getApplication(id).pipe(
      tap(application => this.replaceApplication(application))
    );
  }

  exportSnapshot(): Observable<JobApplication[]> {
    return this.api.exportApplications();
  }

  getApplicationById(id: string): JobApplication | undefined {
    return this.applications.find(application => application.id === id);
  }

  addApplication(application: JobApplication): Observable<JobApplication> {
    return this.api.createApplication(application).pipe(
      tap(saved => {
        this.applications = [...this.applications, this.cloneApplication(saved)];
        this.publish();
      })
    );
  }

  mergeApplications(candidates: readonly JobApplication[]): Observable<number> {
    const missing = this.imports.findMissing(candidates, this.applications);
    if (!missing.length) return of(0);

    return this.api.importApplications(missing).pipe(
      switchMap(summary => this.refresh().pipe(map(() => summary.imported)))
    );
  }

  updateApplication(updatedApplication: JobApplication): Observable<JobApplication> {
    const previous = this.getApplicationById(updatedApplication.id);
    if (!previous) {
      return throwError(() => new Error(`Unknown application ${updatedApplication.id}`));
    }

    this.replaceApplication(updatedApplication);
    return this.api.updateApplication(updatedApplication).pipe(
      tap(saved => this.replaceApplication(saved)),
      catchError(error => {
        this.replaceApplication(previous);
        return throwError(() => error);
      })
    );
  }

  updateApplicationStage(
    id: string,
    stage: RecruitmentStage,
    now = new Date()
  ): Observable<JobApplication | null> {
    const application = this.getApplicationById(id);
    if (!application || application.stage === stage) return of(application ?? null);

    const status = this.workflow.statusForStage(stage);
    const responseDate = application.responseDate ?? (status === 'Envoyé' ? undefined : now);
    const optimistic: JobApplication = {...application, stage, status, responseDate, lastUpdated: now};
    this.replaceApplication(optimistic);

    return this.api.moveApplication(id, stage).pipe(
      tap(saved => this.replaceApplication(saved)),
      map(saved => saved as JobApplication | null),
      catchError(error => {
        this.replaceApplication(application);
        return throwError(() => error);
      })
    );
  }

  completeFollowUp(id: string, now = new Date()): Observable<FollowUp | null> {
    const application = this.getApplicationById(id);
    if (!application?.followUpDate) return of(null);

    const optimistic: JobApplication = {...application, followUpDate: undefined, lastUpdated: now};
    this.replaceApplication(optimistic);

    return this.api.completeCurrentFollowUp(id).pipe(
      switchMap(followUp => this.loadApplication(id).pipe(
        map(() => followUp as FollowUp | null),
        catchError(() => {
          const current = this.getApplicationById(id);
          if (current) this.replaceApplication({...current, version: undefined});
          return of(followUp as FollowUp | null);
        })
      )),
      catchError(error => {
        this.replaceApplication(application);
        return throwError(() => error);
      })
    );
  }

  deleteApplication(id: string): Observable<void> {
    const previous = this.getApplicationById(id);
    if (!previous) return of(undefined);

    this.applications = this.applications.filter(application => application.id !== id);
    this.publish();

    return this.api.deleteApplication(id).pipe(
      catchError(error => {
        this.applications = [...this.applications, this.cloneApplication(previous)];
        this.publish();
        return throwError(() => error);
      })
    );
  }

  getDueFollowUps(now = new Date()): JobApplication[] {
    return this.followUps.getDue(this.applications, now);
  }

  calculateStatistics(): JobStatistics {
    return this.analytics.calculate(this.applications);
  }

  generateSuggestions(): Suggestion[] {
    return this.followUps.generateSuggestions(this.applications);
  }

  private replaceApplication(application: JobApplication): void {
    this.applications = this.applications.map(existing =>
      existing.id === application.id ? this.cloneApplication(application) : existing
    );
    this.publish();
  }

  private cloneApplication(application: JobApplication): JobApplication {
    return {
      ...application,
      applicationDate: new Date(application.applicationDate.getTime()),
      lastUpdated: new Date(application.lastUpdated.getTime()),
      responseDate: application.responseDate ? new Date(application.responseDate.getTime()) : undefined,
      followUpDate: application.followUpDate ? new Date(application.followUpDate.getTime()) : undefined,
      interviews: (application.interviews ?? []).map(interview => ({
        ...interview,
        date: new Date(interview.date.getTime())
      }))
    };
  }

  private publish(): void {
    this.applicationsSubject.next([...this.applications]);
  }
}
