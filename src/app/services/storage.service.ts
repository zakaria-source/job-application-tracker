import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
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

    constructor(
        private readonly repository: LocalStorageJobApplicationRepository,
        private readonly analytics: ApplicationAnalyticsService,
        private readonly followUps: FollowUpService,
        private readonly workflow: ApplicationWorkflowService
    ) {
        this.applications = this.repository.load();
        this.applicationsSubject = new BehaviorSubject<JobApplication[]>([...this.applications]);
    }

    getApplications(): Observable<JobApplication[]> {
        return this.applicationsSubject.asObservable();
    }

    getApplicationById(id: string): JobApplication | undefined {
        return this.applications.find(app => app.id === id);
    }

    addApplication(application: JobApplication): void {
        this.applications = [...this.applications, application];
        this.persistAndPublish();
    }

    updateApplication(updatedApplication: JobApplication): void {
        if (!this.applications.some(app => app.id === updatedApplication.id)) return;
        this.applications = this.applications.map(app => app.id === updatedApplication.id ? {...updatedApplication} : app);
        this.persistAndPublish();
    }

    updateApplicationStage(id: string, stage: RecruitmentStage, now = new Date()): void {
        const application = this.getApplicationById(id);
        if (!application || application.stage === stage) {
            return;
        }

        const status = this.workflow.statusForStage(stage);
        const responseDate = application.responseDate ?? (status === 'Envoyé' ? undefined : now);

        this.updateApplication({
            ...application,
            stage,
            status,
            responseDate,
            lastUpdated: now
        });
    }

    deleteApplication(id: string): void {
        const next = this.applications.filter(app => app.id !== id);
        if (next.length === this.applications.length) return;
        this.applications = next;
        this.persistAndPublish();
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
        this.applications = this.repository.import(serialized);
        this.persistAndPublish();
        return this.applications.length;
    }

    private persistAndPublish(): void {
        try {
            this.repository.save(this.applications);
        } catch (error) {
            console.error('Unable to persist applications', error);
        }
        this.applicationsSubject.next([...this.applications]);
    }
}
