import {Injectable} from '@angular/core';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {
  ApplicationPriority,
  ContractType,
  Interview,
  JobApplication,
  SalaryPeriod
} from '@app/features/applications/models/application.model';

export interface ImportPreview {
  detected: number;
  ready: number;
  duplicates: number;
  applications: JobApplication[];
}

@Injectable({providedIn: 'root'})
export class ApplicationImportService {
  private readonly contractTypes: readonly ContractType[] = ['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance', 'Autre'];
  private readonly priorities: readonly ApplicationPriority[] = ['Haute', 'Moyenne', 'Basse'];
  private readonly salaryPeriods: readonly SalaryPeriod[] = ['Annuel', 'Journalier'];
  private readonly interviewTypes: readonly Interview['type'][] = ['Téléphone', 'Visioconférence', 'En personne'];

  constructor(private readonly workflow: ApplicationWorkflowService) {}

  preview(serialized: string, existing: readonly JobApplication[]): ImportPreview {
    const detected = this.parseApplications(serialized);
    const ready = this.findMissing(detected, existing);

    return {
      detected: detected.length,
      ready: ready.length,
      duplicates: detected.length - ready.length,
      applications: ready
    };
  }

  findMissing(candidates: readonly JobApplication[], existing: readonly JobApplication[]): JobApplication[] {
    return candidates.filter(candidate =>
      !existing.some(current => this.isSameApplication(current, candidate))
    );
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
