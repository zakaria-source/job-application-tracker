import {Injectable} from '@angular/core';
import {
    ApplicationPriority,
    ContractType,
    Interview,
    JobApplication,
    SalaryPeriod
} from '../models/job-application.model';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';

interface StoredEnvelope {
    version: number;
    applications: unknown[];
    exportedAt?: string;
}

@Injectable({providedIn: 'root'})
export class LocalStorageJobApplicationRepository {
    private readonly storageKey = 'job-applications';
    private readonly schemaVersion = 2;
    private readonly contractTypes: readonly ContractType[] = ['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance', 'Autre'];
    private readonly priorities: readonly ApplicationPriority[] = ['Haute', 'Moyenne', 'Basse'];
    private readonly salaryPeriods: readonly SalaryPeriod[] = ['Annuel', 'Journalier'];
    private readonly interviewTypes: readonly Interview['type'][] = ['Téléphone', 'Visioconférence', 'En personne'];

    constructor(private readonly workflow: ApplicationWorkflowService) {}

    load(): JobApplication[] {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) {
            return [];
        }

        try {
            return this.parseApplications(raw);
        } catch (error) {
            console.error('Unable to restore stored applications', error);
            return [];
        }
    }

    save(applications: JobApplication[]): void {
        const envelope: StoredEnvelope = {
            version: this.schemaVersion,
            applications
        };
        localStorage.setItem(this.storageKey, JSON.stringify(envelope));
    }

    export(applications: JobApplication[]): string {
        const envelope: StoredEnvelope = {
            version: this.schemaVersion,
            exportedAt: new Date().toISOString(),
            applications
        };
        return JSON.stringify(envelope, null, 2);
    }

    import(serialized: string): JobApplication[] {
        return this.parseApplications(serialized);
    }

    private parseApplications(serialized: string): JobApplication[] {
        const parsed: unknown = JSON.parse(serialized);
        const rawApplications = Array.isArray(parsed)
            ? parsed
            : this.isEnvelope(parsed)
                ? parsed.applications
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
        const workflow = this.workflow.normalize(rawStatus, rawStage);
        const contractType = this.isOneOf(raw['contractType'], this.contractTypes) ? raw['contractType'] : 'CDI';

        return {
            id: this.readString(raw['id']) || this.generateId(),
            company: this.readString(raw['company']),
            position: this.readString(raw['position']),
            applicationDate,
            status: workflow.status,
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
            stage: workflow.stage,
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

    private isEnvelope(value: unknown): value is StoredEnvelope {
        return this.isRecord(value) && Array.isArray(value['applications']);
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
}
