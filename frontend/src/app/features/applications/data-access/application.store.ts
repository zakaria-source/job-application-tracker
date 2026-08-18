import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {ApplicationAnalyticsService} from '@app/features/applications/domain/application-analytics.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {FollowUpService} from '@app/features/applications/domain/follow-up.service';
import {JobStatistics, Suggestion} from '@app/features/applications/models/application-analytics.model';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';
import {ApplicationImportService} from './application-import.service';

export interface ApplicationCreateCallbacks {
  onSuccess?: (application: JobApplication) => void;
  onError?: (error: unknown) => void;
}

@Injectable({providedIn: 'root'})
export class ApplicationStore {
  private applications: JobApplication[] = [];
  private readonly applicationsSubject = new BehaviorSubject<JobApplication[]>([]);
  constructor(private readonly api: JobTrackrApiService, private readonly analytics: ApplicationAnalyticsService, private readonly followUps: FollowUpService,
    private readonly workflow: ApplicationWorkflowService, private readonly imports: ApplicationImportService) {}
  getApplications(): Observable<JobApplication[]> { return this.applicationsSubject.asObservable(); }
  connect(applications: readonly JobApplication[]): void { this.applications = applications.map(application => this.cloneApplication(application)); this.publish(); }
  clear(): void { this.applications = []; this.publish(); }
  refresh(): void { this.api.listApplications().subscribe({next: applications => this.connect(applications), error: error => console.error('Unable to refresh applications', error)}); }
  getApplicationById(id: string): JobApplication | undefined { return this.applications.find(application => application.id === id); }
  addApplication(application: JobApplication, callbacks: ApplicationCreateCallbacks = {}): void { this.api.createApplication(application).subscribe({next: saved => { this.applications = [...this.applications, this.cloneApplication(saved)]; this.publish(); callbacks.onSuccess?.(saved); }, error: error => { console.error('Unable to create application', error); callbacks.onError?.(error); }}); }
  mergeApplications(candidates: readonly JobApplication[]): number { const missing = this.imports.findMissing(candidates, this.applications); if (!missing.length) return 0; this.api.importApplications(missing).subscribe({next: () => this.refresh(), error: error => console.error('Unable to import applications', error)}); return missing.length; }
  updateApplication(updatedApplication: JobApplication): void { const previous = this.getApplicationById(updatedApplication.id); if (!previous) return; this.replaceApplication(updatedApplication); this.api.updateApplication(updatedApplication).subscribe({next: saved => this.replaceApplication(saved), error: error => { this.replaceApplication(previous); console.error('Unable to update application', error); }}); }
  updateApplicationStage(id: string, stage: RecruitmentStage, now = new Date()): void { const application = this.getApplicationById(id); if (!application || application.stage === stage) return; const status = this.workflow.statusForStage(stage); const responseDate = application.responseDate ?? (status === 'Envoyé' ? undefined : now); const optimistic: JobApplication = {...application, stage, status, responseDate, lastUpdated: now}; this.replaceApplication(optimistic); this.api.moveApplication(id, stage).subscribe({next: saved => this.replaceApplication(saved), error: error => { this.replaceApplication(application); console.error('Unable to move application', error); }}); }
  completeFollowUp(id: string, now = new Date()): void { const application = this.getApplicationById(id); if (!application?.followUpDate) return; const optimistic = {...application, followUpDate: undefined, lastUpdated: now}; this.replaceApplication(optimistic); this.api.completeCurrentFollowUp(id).subscribe({error: error => { this.replaceApplication(application); console.error('Unable to complete follow-up', error); }}); }
  deleteApplication(id: string): void { const previous = this.getApplicationById(id); if (!previous) return; this.applications = this.applications.filter(application => application.id !== id); this.publish(); this.api.deleteApplication(id).subscribe({error: error => { this.applications = [...this.applications, this.cloneApplication(previous)]; this.publish(); console.error('Unable to delete application', error); }}); }
  getDueFollowUps(now = new Date()): JobApplication[] { return this.followUps.getDue(this.applications, now); }
  calculateStatistics(): JobStatistics { return this.analytics.calculate(this.applications); }
  generateSuggestions(): Suggestion[] { return this.followUps.generateSuggestions(this.applications); }
  private replaceApplication(application: JobApplication): void { this.applications = this.applications.map(existing => existing.id === application.id ? this.cloneApplication(application) : existing); this.publish(); }
  private cloneApplication(application: JobApplication): JobApplication { return {...application, applicationDate: new Date(application.applicationDate.getTime()), lastUpdated: new Date(application.lastUpdated.getTime()), responseDate: application.responseDate ? new Date(application.responseDate.getTime()) : undefined, followUpDate: application.followUpDate ? new Date(application.followUpDate.getTime()) : undefined, interviews: (application.interviews ?? []).map(interview => ({...interview, date: new Date(interview.date.getTime())}))}; }
  private publish(): void { this.applicationsSubject.next([...this.applications]); }
}
