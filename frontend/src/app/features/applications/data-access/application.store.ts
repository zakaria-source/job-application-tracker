import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {
  ApplicationPriority,
  ContractType,
  Interview,
  JobApplication,
  JobStatistics,
  RecruitmentStage,
  SalaryPeriod,
  Suggestion
} from '@app/features/applications/models/application.model';
import {ApplicationAnalyticsService} from '@app/features/applications/domain/application-analytics.service';
import {FollowUpService} from '@app/features/applications/domain/follow-up.service';

interface ExportEnvelope {
  version: number;
  exportedAt: string;
  applications: JobApplication[];
}

export interface ImportPreview {
  detected: number;
  ready: number;
  duplicates: number;
  applications: JobApplication[];
}

@Injectable({providedIn: 'root'})
export class ApplicationStore {
  private applications: JobApplication[] = [];
  private readonly applicationsSubject = new BehaviorSubject<JobApplication[]>([]);
  private readonly contractTypes: readonly ContractType[] = ['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance', 'Autre'];
  private readonly priorities: readonly ApplicationPriority[] = ['Haute', 'Moyenne', 'Basse'];
  private readonly salaryPeriods: readonly SalaryPeriod[] = ['Annuel', 'Journalier'];
  private readonly interviewTypes: readonly Interview['type'][] = ['Téléphone', 'Visioconférence', 'En personne'];

  constructor(
    private readonly cloudApi: JobTrackrApiService,
    private readonly analytics: ApplicationAnalyticsService,
    private readonly followUps: FollowUpService,
    private readonly workflow: ApplicationWorkflowService
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

  refresh(): void {
    this.cloudApi.listApplications().subscribe({
      next: applications => this.connect(applications),
      error: error => console.error('Unable to refresh applications', error)
    });
  }

  getApplicationById(id: string): JobApplication | undefined {
    return this.applications.find(application => application.id === id);
  }

  addApplication(application: JobApplication): void {
    this.cloudApi.createApplication(application).subscribe({
      next: saved => {
        this.applications = [...this.applications, this.cloneApplication(saved)];
        this.publish();
      },
      error: error => console.error('Unable to create application', error)
    });
  }

  mergeApplications(candidates: readonly JobApplication[]): number {
    const missing = candidates.filter(candidate =>
      !this.applications.some(existing => this.isSameApplication(existing, candidate))
    );

    if (missing.length === 0) {
      return 0;
    }

    this.cloudApi.importApplications(missing).subscribe({
      next: () => this.refresh(),
      error: error => console.error('Unable to import applications', error)
    });
    return missing.length;
  }

  updateApplication(updatedApplication: JobApplication): void {
    const previous = this.getApplicationById(updatedApplication.id);
    if (!previous) {
      return;
    }

    this.replaceApplication(updatedApplication);
    this.cloudApi.updateApplication(updatedApplication).subscribe({
      next: saved => this.replaceApplication(saved),
      error: error => {
        this.replaceApplication(previous);
        console.error('Unable to update application', error);
      }
    });
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

    this.replaceApplication(optimistic);
    this.cloudApi.moveApplication(id, stage).subscribe({
      next: saved => this.replaceApplication(saved),
      error: error => {
        this.replaceApplication(application);
        console.error('Unable to move application', error);
      }
    });
  }

  completeFollowUp(id: string, now = new Date()): void {
    const application = this.getApplicationById(id);
    if (!application?.followUpDate) {
      return;
    }

    this.updateApplication({...application, followUpDate: undefined, lastUpdated: now});
  }

  deleteApplication(id: string): void {
    const previous = this.getApplicationById(id);
    if (!previous) {
      return;
    }

    this.applications = this.applications.filter(application => application.id !== id);
    this.publish();

    this.cloudApi.deleteApplication(id).subscribe({
      error: error => {
        this.applications = [...this.applications, this.cloneApplication(previous)];
        this.publish();
        console.error('Unable to delete application', error);
      }
    });
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
    const envelope: ExportEnvelope = {
      version: 2,
      exportedAt: new Date().toISOString(),
      applications: this.applications
    };
    return JSON.stringify(envelope, null, 2);
  }

  previewImport(serialized: string): ImportPreview {
    const detected = this.parseApplications(serialized);
    const ready = detected.filter(candidate =>
      !this.applications.some(existing => this.isSameApplication(existing, candidate))
    );

    return {
      detected: detected.length,
      ready: ready.length,
      duplicates: detected.length - ready.length,
      applications: ready
    };
  }

  importPreview(preview: ImportPreview): number {
    if (preview.applications.length === 0) {
      return 0;
    }

    this.cloudApi.importApplications(preview.applications).subscribe({
      next: () => this.refresh(),
      error: error => console.error('Unable to import backup', error)
    });
    return preview.applications.length;
  }

  importData(serialized: string): number {
    return this.importPreview(this.previewImport(serialized));
  }

  private replaceApplication(application: JobApplication): void {
    this.applications = this.applications.map(existing =>
      existing.id === application.id ? this.cloneApplication(application) : existing
    );
    this.publish();
  }

  private parseApplications(serialized: string): JobApplication[] {
    const parsed: unknown = JSON.parse(serialized);
    const rawApplications = Array.isArray(parsed)
      ? parsed
      : this.isRecord(parsed) && Array.isArray(parsed['applications'])
        ? parsed['applications']
        : null;

    if (!rawApplications) {
      throw new Error('Unsupported JobTrackr data format');
    }

    return rawApplications
      .filter(item => this.isRecord(item))
      .map(item => this.hydrateApplication(item));
  }

  private hydrateApplication(raw: Record<string, unknown>): JobApplication {
    const applicationDate = this.toDate(raw['applicationDate'], new Date());
    const rawStatus = this.workflow.isStatus(raw['status']) ? raw['status'] : 'Envoyé';
    const rawStage = this.workflow.isStage(raw['stage'])
      ? raw['stage']
      : this.workflow.defaultStageForStatus(rawStatus);
    const normalizedWorkflow = this.workflow.normalize(rawStatus, rawStage);
    const contractType = this.isOneOf(raw['contractType'], this.contractTypes) ? raw['contractType'] : 'CDI';

    return {
      id: this.readString(raw['id']) || this.generateId(),
      company: this.readString(raw['company']),
      position: this.readString(raw['position']),
      applicationDate,
      status: normalizedWorkflow.status,
      notes: this.readString(raw['notes']),
      lastUpdated: this.toDate(raw['lastUpdated'], applicationDate),
      responseDate: this.optionalDate(raw['responseDate']),
      offerUrl: this.optionalString(raw['offerUrl']),
      contractType,
      salaryTarget: typeof raw['salaryTarget'] === 'number' && Number.isFinite(raw['salaryTarget'])
        ? raw['salaryTarget']
        : undefined,
      salaryPeriod: this.isOneOf(raw['salaryPeriod'], this.salaryPeriods)
        ? raw['salaryPeriod']
        : contractType === 'Freelance' ? 'Journalier' : 'Annuel',
      followUpDate: this.optionalDate(raw['followUpDate']),
      recruiterName: this.optionalString(raw['recruiterName']) ?? this.optionalString(raw['contactPerson']),
      recruiterEmail: this.optionalString(raw['recruiterEmail']) ?? this.optionalString(raw['contactEmail']),
      recruiterPhone: this.optionalString(raw['recruiterPhone']) ?? this.optionalString(raw['contactPhone']),
      stage: normalizedWorkflow.stage,
      priority: this.isOneOf(raw['priority'], this.priorities) ? raw['priority'] : 'Moyenne',
      interviews: Array.isArray(raw['interviews'])
        ? raw['interviews'].filter(item => this.isRecord(item)).map(item => this.hydrateInterview(item))
        : []
    };
  }

  private hydrateInterview(raw: Record<string, unknown>): Interview {
    return {
      id: this.readString(raw['id']) || this.generateId(),
      date: this.toDate(raw['date'], new Date()),
      type: this.isOneOf(raw['type'], this.interviewTypes) ? raw['type'] : 'Téléphone',
      notes: this.readString(raw['notes']),
      reminderSet: raw['reminderSet'] === true
    };
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
      responseDate: application.responseDate ? new Date(application.responseDate.getTime()) : undefined,
      followUpDate: application.followUpDate ? new Date(application.followUpDate.getTime()) : undefined,
      interviews: (application.interviews ?? []).map(interview => ({
        ...interview,
        date: new Date(interview.date.getTime())
      }))
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
    return typeof value === 'string' && values.includes(value as T);
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private optionalString(value: unknown): string | undefined {
    const result = this.readString(value).trim();
    return result || undefined;
  }

  private optionalDate(value: unknown): Date | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const date = this.toDate(value, new Date(Number.NaN));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private toDate(value: unknown, fallback: Date): Date {
    const candidate = value instanceof Date
      ? new Date(value.getTime())
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : new Date(Number.NaN);
    return Number.isNaN(candidate.getTime()) ? new Date(fallback.getTime()) : candidate;
  }

  private generateId(): string {
    return globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  private publish(): void {
    this.applicationsSubject.next([...this.applications]);
  }
}
