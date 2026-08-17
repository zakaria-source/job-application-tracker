from pathlib import Path
import json
import textwrap

FILES = {
"src/app/app.routes.ts": r'''
import {Routes} from '@angular/router';
import {DashboardComponent} from './components/dashboard/dashboard.component';
import {JobListComponent} from './components/job-list/job-list.component';

export const APP_ROUTES: Routes = [
    {path: 'dashboard', component: DashboardComponent, title: 'JobTrackr · Dashboard'},
    {path: 'applications', component: JobListComponent, title: 'JobTrackr · Candidatures'},
    {path: '', pathMatch: 'full', redirectTo: 'dashboard'},
    {path: '**', redirectTo: 'dashboard'}
];
''',
"src/app/domain/application-workflow.service.ts": r'''
import {Injectable} from '@angular/core';
import {ApplicationStatus, RecruitmentStage} from '../models/job-application.model';

@Injectable({providedIn: 'root'})
export class ApplicationWorkflowService {
    readonly stages: readonly RecruitmentStage[] = [
        'Candidature',
        'Screening RH',
        'Entretien technique',
        'Hiring Manager',
        'Entretien final',
        'Offre',
        'Clôturé'
    ];

    readonly statuses: readonly ApplicationStatus[] = ['Envoyé', 'Entretien', 'Accepté', 'Refusé'];

    statusForStage(stage: RecruitmentStage): ApplicationStatus {
        switch (stage) {
            case 'Candidature':
                return 'Envoyé';
            case 'Screening RH':
            case 'Entretien technique':
            case 'Hiring Manager':
            case 'Entretien final':
                return 'Entretien';
            case 'Offre':
                return 'Accepté';
            case 'Clôturé':
                return 'Refusé';
        }
    }

    defaultStageForStatus(status: ApplicationStatus): RecruitmentStage {
        switch (status) {
            case 'Entretien':
                return 'Screening RH';
            case 'Accepté':
                return 'Offre';
            case 'Refusé':
                return 'Clôturé';
            case 'Envoyé':
                return 'Candidature';
        }
    }

    normalize(status: ApplicationStatus, stage: RecruitmentStage): {status: ApplicationStatus; stage: RecruitmentStage} {
        return {status: this.statusForStage(stage), stage};
    }

    isStage(value: unknown): value is RecruitmentStage {
        return typeof value === 'string' && this.stages.includes(value as RecruitmentStage);
    }

    isStatus(value: unknown): value is ApplicationStatus {
        return typeof value === 'string' && this.statuses.includes(value as ApplicationStatus);
    }
}
''',
"src/app/data/local-storage-job-application.repository.ts": r'''
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
''',
"src/app/services/application-analytics.service.ts": r'''
import {Injectable} from '@angular/core';
import {JobApplication, JobStatistics} from '../models/job-application.model';

@Injectable({providedIn: 'root'})
export class ApplicationAnalyticsService {
    calculate(applications: JobApplication[]): JobStatistics {
        const statusCounts = {sent: 0, interview: 0, accepted: 0, rejected: 0};
        let responsesCount = 0;
        const responseTimes: number[] = [];

        applications.forEach(app => {
            switch (app.status) {
                case 'Envoyé': statusCounts.sent++; break;
                case 'Entretien': statusCounts.interview++; responsesCount++; break;
                case 'Accepté': statusCounts.accepted++; responsesCount++; break;
                case 'Refusé': statusCounts.rejected++; responsesCount++; break;
            }
            if (app.status !== 'Envoyé' && app.responseDate) {
                responseTimes.push(this.daysBetween(app.applicationDate, app.responseDate));
            }
        });

        return {
            totalApplications: applications.length,
            responseRate: applications.length ? responsesCount / applications.length * 100 : 0,
            averageResponseTime: responseTimes.length
                ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
                : 0,
            statusCounts,
            applicationsByWeek: this.getApplicationsByWeek(applications),
            mostResponsiveCompanies: this.getMostResponsiveCompanies(applications)
        };
    }

    private getApplicationsByWeek(applications: JobApplication[]): {week: string; count: number}[] {
        const weeks = new Map<string, number>();
        applications.forEach(app => {
            const week = this.getWeekNumber(app.applicationDate).toString().padStart(2, '0');
            const key = `${app.applicationDate.getFullYear()}-W${week}`;
            weeks.set(key, (weeks.get(key) ?? 0) + 1);
        });
        return [...weeks.entries()].map(([week, count]) => ({week, count})).sort((a, b) => a.week.localeCompare(b.week));
    }

    private getWeekNumber(date: Date): number {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDays = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
    }

    private getMostResponsiveCompanies(applications: JobApplication[]): {company: string; responseTime: number}[] {
        const companies = new Map<string, {count: number; totalTime: number}>();
        applications.forEach(app => {
            if (!app.responseDate || app.status === 'Envoyé') return;
            const current = companies.get(app.company) ?? {count: 0, totalTime: 0};
            companies.set(app.company, {
                count: current.count + 1,
                totalTime: current.totalTime + this.daysBetween(app.applicationDate, app.responseDate)
            });
        });
        return [...companies.entries()]
            .map(([company, stats]) => ({company, responseTime: stats.totalTime / stats.count}))
            .sort((a, b) => a.responseTime - b.responseTime)
            .slice(0, 5);
    }

    private daysBetween(start: Date, end: Date): number {
        return Math.max(0, (end.getTime() - start.getTime()) / 86400000);
    }
}
''',
"src/app/services/follow-up.service.ts": r'''
import {Injectable} from '@angular/core';
import {JobApplication, Suggestion} from '../models/job-application.model';

@Injectable({providedIn: 'root'})
export class FollowUpService {
    getDue(applications: JobApplication[], now = new Date()): JobApplication[] {
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return applications
            .filter(app => app.status !== 'Accepté' && app.status !== 'Refusé' && !!app.followUpDate && app.followUpDate < tomorrow)
            .sort((a, b) => (a.followUpDate?.getTime() ?? 0) - (b.followUpDate?.getTime() ?? 0));
    }

    generateSuggestions(applications: JobApplication[], now = new Date()): Suggestion[] {
        const suggestions: Suggestion[] = [];
        const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

        this.getDue(applications, now).forEach(app => {
            const daysLate = app.followUpDate ? Math.floor(this.daysBetween(app.followUpDate, now)) : 0;
            const timing = daysLate > 0 ? `en retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}` : 'prévue aujourd\'hui';
            suggestions.push({
                id: `follow-up-${app.id}`,
                type: 'warning',
                message: `Relance ${timing} : ${app.company} — ${app.position}.`,
                relatedApplicationId: app.id
            });
        });

        applications
            .filter(app => app.status === 'Envoyé' && !app.followUpDate && app.applicationDate < oneWeekAgo)
            .forEach(app => suggestions.push({
                id: `pending-${app.id}`,
                type: 'warning',
                message: `Aucune relance planifiée pour ${app.company}. Candidature envoyée il y a ${Math.floor(this.daysBetween(app.applicationDate, now))} jours.`,
                relatedApplicationId: app.id
            }));

        const latest = applications.reduce<JobApplication | undefined>((current, app) =>
            !current || app.applicationDate > current.applicationDate ? app : current, undefined);
        if (latest && latest.applicationDate < twoWeeksAgo) {
            suggestions.push({id: 'no-recent-applications', type: 'info', message: 'Vous n\'avez pas postulé depuis 2 semaines. Pensez à relancer votre pipeline.'});
        }
        if (applications.filter(app => app.status === 'Refusé').length >= 3) {
            suggestions.push({id: 'multiple-rejections', type: 'info', message: 'Plusieurs candidatures ont été refusées. Comparez les postes ciblés et adaptez votre CV ou votre approche.'});
        }
        return suggestions;
    }

    private daysBetween(start: Date, end: Date): number {
        return Math.max(0, (end.getTime() - start.getTime()) / 86400000);
    }
}
''',
"src/app/services/storage.service.ts": r'''
import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {JobApplication, JobStatistics, Suggestion} from '../models/job-application.model';
import {LocalStorageJobApplicationRepository} from '../data/local-storage-job-application.repository';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';

@Injectable({providedIn: 'root'})
export class StorageService {
    private applications: JobApplication[];
    private readonly applicationsSubject: BehaviorSubject<JobApplication[]>;

    constructor(
        private readonly repository: LocalStorageJobApplicationRepository,
        private readonly analytics: ApplicationAnalyticsService,
        private readonly followUps: FollowUpService
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
''',
"src/app/services/notification.service.ts": r'''
import {Injectable} from '@angular/core';
import {JobApplication} from '../models/job-application.model';

@Injectable({providedIn: 'root'})
export class NotificationService {
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly maxTimeout = 2_147_000_000;

    async ensurePermission(): Promise<boolean> {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        return (await Notification.requestPermission()) === 'granted';
    }

    syncReminders(applications: JobApplication[]): void {
        this.clearTimers();
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        applications.forEach(application => {
            (application.interviews ?? [])
                .filter(interview => interview.reminderSet)
                .forEach(interview => {
                    const reminderTime = interview.date.getTime() - 60 * 60 * 1000;
                    if (reminderTime > Date.now()) {
                        this.scheduleAt(`${application.id}:${interview.id}`, reminderTime, () => {
                            this.showNotification(
                                `Rappel d'entretien avec ${application.company}`,
                                `Vous avez un entretien ${interview.type} dans 1 heure pour le poste de ${application.position}.`
                            );
                        });
                    }
                });
        });
    }

    showNotification(title: string, body: string): void {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            new Notification(title, {body});
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }

    private scheduleAt(key: string, targetTime: number, callback: () => void): void {
        const remaining = targetTime - Date.now();
        if (remaining <= 0) return;
        const timer = setTimeout(() => {
            this.timers.delete(key);
            if (targetTime - Date.now() > 1000) {
                this.scheduleAt(key, targetTime, callback);
            } else {
                callback();
            }
        }, Math.min(remaining, this.maxTimeout));
        this.timers.set(key, timer);
    }

    private clearTimers(): void {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
    }
}
''',
"src/app/app.component.ts": r'''
import {Component, DestroyRef, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {StorageService} from './services/storage.service';
import {NotificationService} from './services/notification.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [MatIconModule, RouterLink, RouterLinkActive, RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class App {
    private readonly destroyRef = inject(DestroyRef);

    constructor(
        readonly router: Router,
        storageService: StorageService,
        notificationService: NotificationService
    ) {
        storageService.getApplications()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(applications => notificationService.syncReminders(applications));
    }

    get pageTitle(): string {
        return this.router.url.startsWith('/applications') ? 'Pipeline de candidatures' : 'Vue d’ensemble';
    }

    get pageDescription(): string {
        return this.router.url.startsWith('/applications')
            ? 'Centralisez vos offres, relances, contacts et étapes de recrutement.'
            : 'Les actions et opportunités qui méritent votre attention aujourd’hui.';
    }
}
''',
"src/app/app.component.html": r'''
<div class="app-shell">
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" routerLink="/dashboard" aria-label="JobTrackr - Dashboard">
        <div class="brand-mark"><mat-icon>work_outline</mat-icon></div>
        <div class="brand-copy"><strong>JobTrackr</strong><span>Career workspace</span></div>
      </a>
      <div class="product-status" title="Vos données restent dans ce navigateur">
        <span class="status-dot"></span><span>Local-first</span>
      </div>
    </div>
  </header>

  <main class="workspace">
    <section class="page-heading">
      <div>
        <span class="eyebrow">JOB SEARCH OS</span>
        <h1>{{ pageTitle }}</h1>
        <p>{{ pageDescription }}</p>
      </div>
    </section>

    <nav class="workspace-nav" aria-label="Navigation principale">
      <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
        <mat-icon>space_dashboard</mat-icon><span>Dashboard</span>
      </a>
      <a routerLink="/applications" routerLinkActive="active">
        <mat-icon>view_list</mat-icon><span>Candidatures</span>
      </a>
    </nav>

    <div class="route-content"><router-outlet></router-outlet></div>
  </main>
</div>
''',
"src/app/app.component.css": r'''
:host { display: block; min-height: 100vh; }
.app-shell { min-height: 100vh; }
.topbar { position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid rgba(15,23,42,.08); background: rgba(248,250,252,.88); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
.topbar-inner { width: min(1440px, calc(100% - 48px)); min-height: 72px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.brand { display: inline-flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
.brand-mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 13px; color: #fff; background: linear-gradient(145deg,#4f46e5,#2563eb); box-shadow: 0 8px 20px rgba(79,70,229,.24); }
.brand-mark mat-icon { width: 21px; height: 21px; font-size: 21px; }
.brand-copy { display: flex; flex-direction: column; line-height: 1.15; }
.brand-copy strong { color: #0f172a; font-size: 16px; font-weight: 750; letter-spacing: -.02em; }
.brand-copy span { margin-top: 4px; color: #94a3b8; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.product-status { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 12px; border: 1px solid #e2e8f0; border-radius: 999px; background: rgba(255,255,255,.8); color: #64748b; font-size: 12px; font-weight: 650; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.12); }
.workspace { width: min(1440px, calc(100% - 48px)); margin: 0 auto; padding: 38px 0 56px; }
.page-heading { margin-bottom: 24px; }
.eyebrow { display: block; margin-bottom: 8px; color: #6366f1; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
.page-heading h1 { margin: 0; color: #0f172a; font-size: clamp(28px,3vw,40px); font-weight: 760; letter-spacing: -.045em; line-height: 1.05; }
.page-heading p { max-width: 720px; margin: 10px 0 0; color: #64748b; font-size: 15px; line-height: 1.6; }
.workspace-nav { width: fit-content; max-width: 100%; display: flex; gap: 5px; padding: 5px; border: 1px solid var(--jt-border); border-radius: 14px; background: rgba(255,255,255,.82); }
.workspace-nav a { min-width: 150px; min-height: 42px; padding: 0 16px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 10px; color: var(--jt-text-muted); text-decoration: none; font-size: 14px; font-weight: 650; transition: background 160ms ease,color 160ms ease; }
.workspace-nav a.active { color: #fff; background: var(--jt-text); }
.workspace-nav a:focus-visible { outline: 3px solid rgba(79,70,229,.28); outline-offset: 2px; }
.workspace-nav mat-icon { width: 18px; height: 18px; font-size: 18px; }
.route-content { padding-top: 26px; }
@media (max-width: 720px) {
  .topbar-inner,.workspace { width: min(100% - 28px,1440px); }
  .topbar-inner { min-height: 64px; }
  .workspace { padding-top: 28px; }
  .brand-copy span,.product-status span:last-child { display: none; }
  .product-status { width: 34px; padding: 0; justify-content: center; }
  .workspace-nav { width: 100%; }
  .workspace-nav a { min-width: 0; flex: 1; }
  .route-content { padding-top: 20px; }
}
''',
"src/main.ts": r'''
import {provideZoneChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {provideCharts, withDefaultRegisterables} from 'ng2-charts';
import {App} from './app/app.component';
import {APP_ROUTES} from './app/app.routes';

bootstrapApplication(App, {
    providers: [
        provideCharts(withDefaultRegisterables()),
        provideZoneChangeDetection(),
        provideRouter(APP_ROUTES)
    ]
}).catch(err => console.error(err));
''',
"src/app/components/job-form/job-form.component.ts": r'''
import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatNativeDateModule} from '@angular/material/core';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {Interview, JobApplication} from '../../models/job-application.model';
import {NotificationService} from '../../services/notification.service';
import {ApplicationWorkflowService} from '../../domain/application-workflow.service';

@Component({
    selector: 'app-job-form',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatCheckboxModule, MatDatepickerModule, MatDividerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatNativeDateModule, MatSelectModule],
    templateUrl: './job-form.component.html',
    styleUrl: './job-form.component.css'
})
export class JobFormComponent implements OnInit {
    @Input() editMode = false;
    @Input() application: JobApplication | null = null;
    @Output() formSubmit = new EventEmitter<JobApplication>();
    @Output() cancel = new EventEmitter<void>();
    jobForm!: FormGroup;

    constructor(
        private readonly fb: FormBuilder,
        private readonly notificationService: NotificationService,
        private readonly workflow: ApplicationWorkflowService
    ) {}

    ngOnInit(): void { this.initForm(); }

    private initForm(): void {
        this.jobForm = this.fb.group({
            company: ['', Validators.required], position: ['', Validators.required],
            offerUrl: ['', Validators.pattern(/^https?:\/\/.+/i)], contractType: ['CDI', Validators.required],
            salaryTarget: [null, Validators.min(0)], salaryPeriod: ['Annuel', Validators.required],
            applicationDate: [new Date(), Validators.required], stage: ['Candidature', Validators.required],
            priority: ['Moyenne', Validators.required], followUpDate: [null], recruiterName: [''],
            recruiterEmail: ['', Validators.email], recruiterPhone: [''], notes: [''], interviews: this.fb.array([])
        });
        if (!this.application) return;
        this.jobForm.patchValue({
            company: this.application.company, position: this.application.position, offerUrl: this.application.offerUrl ?? '',
            contractType: this.application.contractType, salaryTarget: this.application.salaryTarget ?? null,
            salaryPeriod: this.application.salaryPeriod, applicationDate: this.application.applicationDate,
            stage: this.application.stage, priority: this.application.priority, followUpDate: this.application.followUpDate ?? null,
            recruiterName: this.application.recruiterName ?? this.application.contactPerson ?? '',
            recruiterEmail: this.application.recruiterEmail ?? this.application.contactEmail ?? '',
            recruiterPhone: this.application.recruiterPhone ?? this.application.contactPhone ?? '', notes: this.application.notes
        });
        (this.application.interviews ?? []).forEach(interview => this.interviews.push(this.createInterviewFormGroup(interview)));
    }

    get interviews(): FormArray { return this.jobForm.get('interviews') as FormArray; }

    private createInterviewFormGroup(interview?: Interview): FormGroup {
        return this.fb.group({
            id: [interview?.id ?? this.generateId()], date: [interview?.date ?? new Date(), Validators.required],
            type: [interview?.type ?? 'Téléphone', Validators.required], notes: [interview?.notes ?? ''], reminderSet: [interview?.reminderSet ?? false]
        });
    }

    addInterview(): void { this.interviews.push(this.createInterviewFormGroup()); }
    removeInterview(index: number): void { this.interviews.removeAt(index); }

    async onSubmit(): Promise<void> {
        if (this.jobForm.invalid) { this.jobForm.markAllAsTouched(); return; }
        const formValue = this.jobForm.getRawValue();
        const status = this.workflow.statusForStage(formValue.stage);
        if (formValue.interviews.some((interview: Interview) => interview.reminderSet)) {
            await this.notificationService.ensurePermission();
        }
        const jobApplication: JobApplication = {
            id: this.application?.id ?? this.generateId(), company: formValue.company.trim(), position: formValue.position.trim(),
            offerUrl: formValue.offerUrl?.trim() || undefined, contractType: formValue.contractType,
            salaryTarget: formValue.salaryTarget === null || formValue.salaryTarget === '' ? undefined : Number(formValue.salaryTarget),
            salaryPeriod: formValue.salaryPeriod, applicationDate: formValue.applicationDate, status, stage: formValue.stage,
            priority: formValue.priority, followUpDate: formValue.followUpDate || undefined,
            recruiterName: formValue.recruiterName?.trim() || undefined, recruiterEmail: formValue.recruiterEmail?.trim() || undefined,
            recruiterPhone: formValue.recruiterPhone?.trim() || undefined, notes: formValue.notes?.trim() ?? '',
            interviews: formValue.interviews, lastUpdated: new Date(), responseDate: this.getResponseDate(status)
        };
        this.formSubmit.emit(jobApplication);
    }

    onCancel(): void { this.cancel.emit(); }

    private getResponseDate(status: JobApplication['status']): Date | undefined {
        if (status === 'Envoyé') return undefined;
        return this.application?.responseDate ?? new Date();
    }

    private generateId(): string {
        return globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
}
''',
"src/app/components/job-list/job-list.component.ts": r'''
import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatSelectModule} from '@angular/material/select';
import {MatSortModule, Sort} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {JobApplication} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';
import {JobFormComponent} from '../job-form/job-form.component';

@Component({
    selector: 'app-job-list', standalone: true,
    imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatSelectModule, MatSortModule, MatTableModule, MatTooltipModule, JobFormComponent],
    templateUrl: './job-list.component.html', styleUrl: './job-list.component.css'
})
export class JobListComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
    applications: JobApplication[] = []; filteredApplications: JobApplication[] = []; paginatedApplications: JobApplication[] = [];
    displayedColumns = ['company', 'position', 'contractType', 'priority', 'followUpDate', 'status', 'actions'];
    searchTerm = ''; statusFilter = ''; contractFilter = ''; priorityFilter = ''; sortField = 'followUpDate'; sortDirection: 'asc'|'desc' = 'asc';
    pageSize = 10; currentPage = 0; showForm = false; editMode = false; selectedApplication: JobApplication | null = null; showDetails = false;

    constructor(private readonly storageService: StorageService) {}

    ngOnInit(): void {
        this.storageService.getApplications().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(applications => {
            this.applications = applications; this.applyFilters(false);
        });
    }

    applyFilters(resetPage = true): void {
        let filtered = [...this.applications]; const search = this.searchTerm.trim().toLowerCase();
        if (search) filtered = filtered.filter(app => app.company.toLowerCase().includes(search) || app.position.toLowerCase().includes(search) || app.notes.toLowerCase().includes(search) || app.stage.toLowerCase().includes(search) || (app.recruiterName ?? '').toLowerCase().includes(search));
        if (this.statusFilter) filtered = filtered.filter(app => app.status === this.statusFilter);
        if (this.contractFilter) filtered = filtered.filter(app => app.contractType === this.contractFilter);
        if (this.priorityFilter) filtered = filtered.filter(app => app.priority === this.priorityFilter);
        if (resetPage) this.currentPage = 0;
        this.filteredApplications = filtered; this.applySort();
    }

    clearFilters(): void { this.searchTerm = ''; this.statusFilter = ''; this.contractFilter = ''; this.priorityFilter = ''; this.applyFilters(); }

    applySort(): void {
        const priorityOrder: Record<JobApplication['priority'], number> = {Haute: 3, Moyenne: 2, Basse: 1};
        this.filteredApplications = [...this.filteredApplications].sort((a,b) => {
            let comparison = 0;
            switch (this.sortField) {
                case 'company': comparison = a.company.localeCompare(b.company); break;
                case 'position': comparison = a.position.localeCompare(b.position); break;
                case 'contractType': comparison = a.contractType.localeCompare(b.contractType); break;
                case 'priority': comparison = priorityOrder[a.priority] - priorityOrder[b.priority]; break;
                case 'followUpDate': comparison = (a.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER); break;
                case 'status': comparison = a.status.localeCompare(b.status); break;
                default: comparison = a.applicationDate.getTime() - b.applicationDate.getTime();
            }
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
        this.updatePaginatedApplications();
    }

    sortData(sort: Sort): void { this.sortField = sort.active; this.sortDirection = (sort.direction || 'asc') as 'asc'|'desc'; this.applySort(); }
    updatePaginatedApplications(): void { const start = this.currentPage * this.pageSize; this.paginatedApplications = this.filteredApplications.slice(start, start + this.pageSize); }
    onPageChange(event: PageEvent): void { this.currentPage = event.pageIndex; this.pageSize = event.pageSize; this.updatePaginatedApplications(); }
    showAddForm(): void { this.editMode = false; this.selectedApplication = null; this.showForm = true; this.showDetails = false; }
    editApplication(application: JobApplication): void { this.editMode = true; this.selectedApplication = {...application}; this.showForm = true; this.showDetails = false; }
    viewApplicationDetails(application: JobApplication): void { this.selectedApplication = {...application}; this.showDetails = true; this.showForm = false; }
    closeDetails(): void { this.showDetails = false; this.selectedApplication = null; }

    deleteApplication(application: JobApplication): void {
        if (!confirm(`Supprimer la candidature ${application.position} chez ${application.company} ?`)) return;
        this.storageService.deleteApplication(application.id);
        if (this.selectedApplication?.id === application.id) this.closeDetails();
    }

    onFormSubmit(application: JobApplication): void {
        this.editMode ? this.storageService.updateApplication(application) : this.storageService.addApplication(application); this.cancelForm();
    }
    cancelForm(): void { this.showForm = false; this.editMode = false; this.selectedApplication = null; }

    exportApplications(): void {
        const blob = new Blob([this.storageService.exportData()], {type: 'application/json'});
        const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
        anchor.href = url; anchor.download = `jobtrackr-backup-${new Date().toISOString().slice(0,10)}.json`; anchor.click(); URL.revokeObjectURL(url);
    }

    importApplications(event: Event): void {
        const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                if (!confirm('Importer ce fichier remplacera les candidatures actuellement stockées. Continuer ?')) return;
                this.storageService.importData(String(reader.result ?? ''));
            } catch (error) {
                console.error(error); alert('Le fichier sélectionné n’est pas un export JobTrackr valide.');
            } finally { input.value = ''; }
        };
        reader.readAsText(file);
    }

    isFollowUpDue(application: JobApplication): boolean {
        if (!application.followUpDate || application.status === 'Accepté' || application.status === 'Refusé') return false;
        const tomorrow = new Date(); tomorrow.setHours(24,0,0,0); return application.followUpDate < tomorrow;
    }

    formatTargetSalary(application: JobApplication): string {
        if (!application.salaryTarget) return '—';
        const formatted = new Intl.NumberFormat('fr-FR').format(application.salaryTarget);
        return application.salaryPeriod === 'Journalier' ? `${formatted} €/j` : `${formatted} € brut/an`;
    }
}
''',
"src/app/components/job-list/job-list.component.css": r'''
.filters { display:grid; grid-template-columns:minmax(260px,2fr) repeat(3,minmax(145px,1fr)); gap:12px; margin:20px 0 8px; }
.data-actions { display:flex; justify-content:flex-end; gap:10px; margin:16px 0 4px; flex-wrap:wrap; }
.table-container { overflow-x:auto; }
table { width:100%; min-width:980px; }
.application-row { cursor:pointer; }
.application-row:hover { background-color:rgba(0,0,0,.04); }
.application-row:focus-visible { outline:3px solid rgba(79,70,229,.28); outline-offset:-3px; }
.company-cell { display:flex; flex-direction:column; gap:2px; }
.company-cell span { font-size:12px; color:#757575; }
.no-data { display:flex; flex-direction:column; align-items:center; text-align:center; padding:40px 20px; color:#757575; }
.no-data > mat-icon { width:48px; height:48px; font-size:48px; }
.no-data h3 { margin:8px 0 0; color:#424242; }
.no-data p { margin:8px 0 18px; }
.status-badge,.priority-badge { display:inline-flex; padding:4px 8px; border-radius:999px; font-size:12px; font-weight:600; }
.priority-haute { background:#ffebee; color:#c62828; }.priority-moyenne { background:#fff8e1; color:#ef6c00; }.priority-basse { background:#f1f8e9; color:#558b2f; }
.follow-up-due { color:#d84315; font-weight:700; }.secondary-panel,.details-card { margin-top:20px; }.close-button { position:absolute; top:8px; right:8px; }
.details-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:16px; margin:20px 0; }.detail-item { display:flex; flex-direction:column; gap:4px; }
.notes-section,.interviews-section { margin-top:24px; }.notes-section p { white-space:pre-wrap; }.interview-item { padding:12px; border-left:3px solid #3f51b5; background:rgba(0,0,0,.02); margin-bottom:12px; }
.interview-header { display:flex; justify-content:space-between; gap:12px; margin-bottom:8px; font-weight:500; }.interview-type { color:#3f51b5; }
@media (max-width:950px) { .filters { grid-template-columns:1fr 1fr; }.search-field { grid-column:1/-1; } }
@media (max-width:600px) { .filters { grid-template-columns:1fr; }.search-field { grid-column:auto; }.data-actions { justify-content:stretch; }.data-actions button { flex:1; } }
''',
"src/app/domain/application-workflow.service.spec.ts": r'''
import {describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from './application-workflow.service';

describe('ApplicationWorkflowService', () => {
    const service = new ApplicationWorkflowService();
    it('derives interview status from interview stages', () => {
        expect(service.statusForStage('Entretien technique')).toBe('Entretien');
        expect(service.statusForStage('Hiring Manager')).toBe('Entretien');
    });
    it('normalizes inconsistent legacy status from the stage', () => {
        expect(service.normalize('Envoyé', 'Offre')).toEqual({status: 'Accepté', stage: 'Offre'});
    });
});
''',
"src/app/data/local-storage-job-application.repository.spec.ts": r'''
import {beforeEach, describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {LocalStorageJobApplicationRepository} from './local-storage-job-application.repository';

describe('LocalStorageJobApplicationRepository', () => {
    let repository: LocalStorageJobApplicationRepository;
    beforeEach(() => { localStorage.clear(); repository = new LocalStorageJobApplicationRepository(new ApplicationWorkflowService()); });

    it('migrates legacy array storage and legacy recruiter fields', () => {
        localStorage.setItem('job-applications', JSON.stringify([{id:'1',company:'Acme',position:'Engineer',applicationDate:'2026-08-01',status:'Entretien',contactPerson:'Jane'}]));
        const [application] = repository.load();
        expect(application.recruiterName).toBe('Jane');
        expect(application.stage).toBe('Screening RH');
        expect(application.applicationDate).toBeInstanceOf(Date);
    });

    it('persists a versioned envelope', () => {
        repository.save([]);
        expect(JSON.parse(localStorage.getItem('job-applications') ?? '{}')).toMatchObject({version: 2, applications: []});
    });
});
''',
"src/app/services/follow-up.service.spec.ts": r'''
import {describe, expect, it} from 'vitest';
import {FollowUpService} from './follow-up.service';
import {JobApplication} from '../models/job-application.model';

const application = (overrides: Partial<JobApplication> = {}): JobApplication => ({
    id:'1', company:'Acme', position:'Backend Engineer', applicationDate:new Date('2026-08-01T10:00:00'), status:'Envoyé', notes:'', lastUpdated:new Date('2026-08-01T10:00:00'),
    contractType:'CDI', salaryPeriod:'Annuel', stage:'Candidature', priority:'Moyenne', ...overrides
});

describe('FollowUpService', () => {
    const service = new FollowUpService();
    it('returns active follow-ups due today or overdue', () => {
        const now = new Date('2026-08-17T12:00:00');
        expect(service.getDue([application({followUpDate:new Date('2026-08-17T18:00:00')})], now)).toHaveLength(1);
    });
    it('does not return closed applications', () => {
        const now = new Date('2026-08-17T12:00:00');
        expect(service.getDue([application({status:'Refusé', stage:'Clôturé', followUpDate:new Date('2026-08-16')})], now)).toHaveLength(0);
    });
});
''',
"src/app/services/application-analytics.service.spec.ts": r'''
import {describe, expect, it} from 'vitest';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {JobApplication} from '../models/job-application.model';

const app = (id: string, status: JobApplication['status'], responseDate?: Date): JobApplication => ({
    id, company:'Acme', position:'Engineer', applicationDate:new Date('2026-08-01'), status, notes:'', lastUpdated:new Date('2026-08-01'), responseDate,
    contractType:'CDI', salaryPeriod:'Annuel', stage:status === 'Envoyé' ? 'Candidature' : status === 'Entretien' ? 'Screening RH' : status === 'Accepté' ? 'Offre' : 'Clôturé', priority:'Moyenne'
});

describe('ApplicationAnalyticsService', () => {
    it('calculates response rate and response time', () => {
        const stats = new ApplicationAnalyticsService().calculate([app('1','Envoyé'), app('2','Entretien',new Date('2026-08-05'))]);
        expect(stats.responseRate).toBe(50);
        expect(stats.averageResponseTime).toBe(4);
        expect(stats.statusCounts.interview).toBe(1);
    });
});
''',
"src/app/services/storage.service.spec.ts": r'''
import {beforeEach, describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {LocalStorageJobApplicationRepository} from '../data/local-storage-job-application.repository';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';
import {StorageService} from './storage.service';
import {JobApplication} from '../models/job-application.model';

const application: JobApplication = {id:'1',company:'Acme',position:'Engineer',applicationDate:new Date('2026-08-17'),status:'Envoyé',notes:'',lastUpdated:new Date('2026-08-17'),contractType:'CDI',salaryPeriod:'Annuel',stage:'Candidature',priority:'Moyenne'};

describe('StorageService', () => {
    let service: StorageService;
    beforeEach(() => {
        localStorage.clear();
        const repository = new LocalStorageJobApplicationRepository(new ApplicationWorkflowService());
        service = new StorageService(repository, new ApplicationAnalyticsService(), new FollowUpService());
    });
    it('persists add, update and delete operations', () => {
        service.addApplication(application);
        expect(service.getApplicationById('1')?.company).toBe('Acme');
        service.updateApplication({...application, company:'Updated'});
        expect(service.getApplicationById('1')?.company).toBe('Updated');
        service.deleteApplication('1');
        expect(service.getApplicationById('1')).toBeUndefined();
    });
    it('exports and imports data', () => {
        service.addApplication(application);
        const backup = service.exportData();
        service.deleteApplication('1');
        expect(service.importData(backup)).toBe(1);
        expect(service.getApplicationById('1')).toBeDefined();
    });
});
''',
"tsconfig.spec.json": r'''
{
  "extends": "./tsconfig.json",
  "compilerOptions": {"outDir": "./out-tsc/spec", "types": ["vitest/globals"]},
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
'''
}

# Modify the existing form template without duplicating the entire file.
form_path = Path('src/app/components/job-form/job-form.component.html')
form = form_path.read_text(encoding='utf-8')
status_block = '''        <mat-form-field>\n          <mat-label>Statut</mat-label>\n          <mat-select formControlName="status" required>\n            <mat-option value="Envoyé">Envoyé</mat-option>\n            <mat-option value="Entretien">Entretien</mat-option>\n            <mat-option value="Accepté">Accepté</mat-option>\n            <mat-option value="Refusé">Refusé</mat-option>\n          </mat-select>\n        </mat-form-field>\n\n'''
form = form.replace(status_block, '')
form = form.replace('<div class="form-grid three-columns">\n        <mat-form-field>\n          <mat-label>Date de candidature</mat-label>', '<div class="form-grid two-columns">\n        <mat-form-field>\n          <mat-label>Date de candidature</mat-label>', 1)
form = form.replace('          </mat-select>\n        </mat-form-field>\n\n        <mat-form-field>\n          <mat-label>Prochaine relance</mat-label>', '          </mat-select>\n          <mat-hint>Le statut est calculé automatiquement depuis cette étape.</mat-hint>\n        </mat-form-field>\n\n        <mat-form-field>\n          <mat-label>Prochaine relance</mat-label>', 1)
FILES['src/app/components/job-form/job-form.component.html'] = form

# Improve list accessibility and add backup actions.
list_path = Path('src/app/components/job-list/job-list.component.html')
job_list = list_path.read_text(encoding='utf-8')
job_list = job_list.replace('  <mat-card-content>\n', '''  <mat-card-content>\n    <div class="data-actions">\n      <button mat-stroked-button type="button" (click)="exportApplications()"><mat-icon>download</mat-icon> Exporter</button>\n      <button mat-stroked-button type="button" (click)="importFile.click()"><mat-icon>upload</mat-icon> Importer</button>\n      <input #importFile hidden type="file" accept="application/json,.json" (change)="importApplications($event)">\n    </div>\n''', 1)
job_list = job_list.replace('''          <tr mat-row *matRowDef="let row; columns: displayedColumns;"\n            (click)="viewApplicationDetails(row)"\n          class="application-row"></tr>''', '''          <tr mat-row *matRowDef="let row; columns: displayedColumns;"\n            class="application-row"\n            tabindex="0"\n            role="button"\n            [attr.aria-label]="'Ouvrir la candidature ' + row.position + ' chez ' + row.company"\n            (click)="viewApplicationDetails(row)"\n            (keydown.enter)="viewApplicationDetails(row)"\n            (keydown.space)="$event.preventDefault(); viewApplicationDetails(row)"></tr>''')
FILES['src/app/components/job-list/job-list.component.html'] = job_list

for path, content in FILES.items():
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).lstrip('\n'), encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
package['scripts']['test'] = 'ng test'
package['scripts']['test:ci'] = 'ng test --watch=false --coverage'
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

angular_path = Path('angular.json')
angular = json.loads(angular_path.read_text(encoding='utf-8'))
angular['projects']['demo']['architect']['test'] = {
    'builder': '@angular/build:unit-test',
    'options': {'tsConfig': 'tsconfig.spec.json'}
}
angular_path.write_text(json.dumps(angular, indent=2) + '\n', encoding='utf-8')

ci = Path('.github/workflows/ci.yml').read_text(encoding='utf-8')
ci = ci.replace('      - name: Build application\n', '      - name: Run unit tests\n        run: npm run test:ci\n\n      - name: Build application\n')
Path('.github/workflows/ci.yml').write_text(ci, encoding='utf-8')

# Remove obsolete deep overrides for the old Material tab navigation.
styles_path = Path('src/global_styles.css')
styles = styles_path.read_text(encoding='utf-8')
start = styles.find('/* Workspace navigation */')
end = styles.find('/* Dashboard */')
if start >= 0 and end > start:
    styles = styles[:start] + styles[end:]
styles_path.write_text(styles, encoding='utf-8')
