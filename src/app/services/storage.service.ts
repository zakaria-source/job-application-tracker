import {Inject, Injectable, Optional} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {CloudApiService} from '../cloud/cloud-api.service';
import {
  JobApplication,
  JobStatistics,
  RecruitmentStage,
  Suggestion
} from '../models/job-application.model';
import {LocalStorageJobApplicationRepository} from '../data/local-storage-job-application.repository';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';

@Injectable({providedIn: 'root'})
export class StorageService {
  private applications: JobApplication[];
  private readonly applicationsSubject: BehaviorSubject<JobApplication[]>;
  private cloudMode = false;

  constructor(
    private readonly repository: LocalStorageJobApplicationRepository,
    private readonly analytics: ApplicationAnalyticsService,
    private readonly followUps: FollowUpService,
    private readonly workflow: ApplicationWorkflowService,
    @Optional() @Inject(CloudApiService) private readonly cloudApi: CloudApiService | null = null
  ) {
    this.applications = this.repository.load();
    this.applicationsSubject = new BehaviorSubject<JobApplication[]>([...this.applications]);
  }

  getApplications(): Observable<JobApplication[]> {
    return this.applicationsSubject.asObservable();
  }

  isCloudMode(): boolean {
    return this.cloudMode;
  }

  getLocalApplicationsSnapshot(): JobApplication[] {
    return this.repository.load().map(application => this.cloneApplication(application));
  }

  connectCloud(applications: readonly JobApplication[]): void {
    this.cloudMode = true;
    this.applications = applications.map(application => this.cloneApplication(application));
    this.publishMemory();
  }

  disconnectCloud(): void {
    this.cloudMode = false;
    this.applications = this.repository.load();
    this.publishMemory();
  }

  refreshCloud(): void {
    if (!this.cloudMode || !this.cloudApi) return;
    this.cloudApi.listApplications().subscribe({
      next: applications => this.connectCloud(applications),
      error: error => console.error('Unable to refresh cloud applications', error)
    });
  }

  getApplicationById(id: string): JobApplication | undefined {
    return this.applications.find(app => app.id === id);
  }

  addApplication(application: JobApplication): void {
    if (this.cloudMode && this.cloudApi) {
      this.cloudApi.createApplication(application).subscribe({
        next: saved => {
          this.applications = [...this.applications, this.cloneApplication(saved)];
          this.publishMemory();
        },
        error: error => console.error('Unable to create cloud application', error)
      });
      return;
    }

    this.applications = [...this.applications, this.cloneApplication(application)];
    this.persistLocalAndPublish();
  }

  mergeApplications(candidates: readonly JobApplication[]): number {
    const missing = candidates.filter(candidate =>
      !this.applications.some(existing => this.isSameApplication(existing, candidate))
    );

    if (missing.length === 0) {
      return 0;
    }

    if (this.cloudMode && this.cloudApi) {
      this.cloudApi.importApplications(missing).subscribe({
        next: () => this.refreshCloud(),
        error: error => console.error('Unable to import cloud applications', error)
      });
      return missing.length;
    }

    this.applications = [
      ...this.applications,
      ...missing.map(application => this.cloneApplication(application))
    ];
    this.persistLocalAndPublish();
    return missing.length;
  }

  updateApplication(updatedApplication: JobApplication): void {
    const previous = this.getApplicationById(updatedApplication.id);
    if (!previous) {
      return;
    }

    this.applications = this.applications.map(app =>
      app.id === updatedApplication.id ? this.cloneApplication(updatedApplication) : app
    );

    if (this.cloudMode && this.cloudApi) {
      this.publishMemory();
      this.cloudApi.updateApplication(updatedApplication).subscribe({
        next: saved => this.replaceApplication(saved),
        error: error => {
          this.replaceApplication(previous);
          console.error('Unable to update cloud application', error);
        }
      });
      return;
    }

    this.persistLocalAndPublish();
  }

  updateApplicationStage(id: string, stage: RecruitmentStage, now = new Date()): void {
    const application = this.getApplicationById(id);
    if (!application || application.stage === stage) {
      return;
    }

    const status = this.workflow.statusForStage(stage);
    const responseDate = application.responseDate ?? (status === 'Envoyé' ? undefined : now);
    const optimistic: JobApplication = {
      ...application,
      stage,
      status,
      responseDate,
      lastUpdated: now
    };

    if (this.cloudMode && this.cloudApi) {
      this.applications = this.applications.map(item => item.id === id ? this.cloneApplication(optimistic) : item);
      this.publishMemory();
      this.cloudApi.moveApplication(id, stage).subscribe({
        next: saved => this.replaceApplication(saved),
        error: error => {
          this.replaceApplication(application);
          console.error('Unable to move cloud application', error);
        }
      });
      return;
    }

    this.updateApplication(optimistic);
  }

  deleteApplication(id: string): void {
    const previous = this.getApplicationById(id);
    if (!previous) {
      return;
    }

    this.applications = this.applications.filter(app => app.id !== id);

    if (this.cloudMode && this.cloudApi) {
      this.publishMemory();
      this.cloudApi.deleteApplication(id).subscribe({
        error: error => {
          this.applications = [...this.applications, this.cloneApplication(previous)];
          this.publishMemory();
          console.error('Unable to delete cloud application', error);
        }
      });
      return;
    }

    this.persistLocalAndPublish();
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

  exportData(): string {
    return this.repository.export(this.applications);
  }

  importData(serialized: string): number {
    const imported = this.repository.import(serialized);

    if (this.cloudMode && this.cloudApi) {
      this.cloudApi.importApplications(imported).subscribe({
        next: () => this.refreshCloud(),
        error: error => console.error('Unable to import cloud backup', error)
      });
      return imported.length;
    }

    this.applications = imported;
    this.persistLocalAndPublish();
    return this.applications.length;
  }

  private replaceApplication(application: JobApplication): void {
    this.applications = this.applications.map(existing =>
      existing.id === application.id ? this.cloneApplication(application) : existing
    );
    this.publishMemory();
  }

  private isSameApplication(left: JobApplication, right: JobApplication): boolean {
    if (left.id === right.id) {
      return true;
    }

    const leftOffer = this.normalizeOfferUrl(left.offerUrl);
    const rightOffer = this.normalizeOfferUrl(right.offerUrl);
    if (leftOffer && rightOffer && leftOffer === rightOffer) {
      return true;
    }

    return this.normalizeText(left.company) === this.normalizeText(right.company)
      && this.normalizeText(left.position) === this.normalizeText(right.position);
  }

  private normalizeOfferUrl(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`.replace(/\/$/, '').toLowerCase();
    } catch {
      return value.split('?')[0].replace(/\/$/, '').toLowerCase();
    }
  }

  private normalizeText(value: string): string {
    return value.trim().toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ');
  }

  private cloneApplication(application: JobApplication): JobApplication {
    return {
      ...application,
      applicationDate: new Date(application.applicationDate.getTime()),
      lastUpdated: new Date(application.lastUpdated.getTime()),
      responseDate: application.responseDate
        ? new Date(application.responseDate.getTime())
        : undefined,
      followUpDate: application.followUpDate
        ? new Date(application.followUpDate.getTime())
        : undefined,
      interviews: (application.interviews ?? []).map(interview => ({
        ...interview,
        date: new Date(interview.date.getTime())
      }))
    };
  }

  private persistLocalAndPublish(): void {
    try {
      this.repository.save(this.applications);
    } catch (error) {
      console.error('Unable to persist applications', error);
    }
    this.publishMemory();
  }

  private publishMemory(): void {
    this.applicationsSubject.next([...this.applications]);
  }
}
