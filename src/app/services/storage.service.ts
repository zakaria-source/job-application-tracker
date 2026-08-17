import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {
    ApplicationStatus,
    ContractType,
    JobApplication,
    JobStatistics,
    RecruitmentStage,
    Suggestion
} from '../models/job-application.model';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private readonly STORAGE_KEY = 'job-applications';
    private applications: JobApplication[] = [];
    private readonly applicationsSubject = new BehaviorSubject<JobApplication[]>([]);

    constructor() {
        this.loadFromLocalStorage();
    }

    private loadFromLocalStorage(): void {
        const storedData = localStorage.getItem(this.STORAGE_KEY);
        if (!storedData) {
            return;
        }

        try {
            const parsedData: unknown = JSON.parse(storedData);
            if (!Array.isArray(parsedData)) {
                throw new Error('Stored applications must be an array');
            }

            this.applications = parsedData.map(app => this.hydrateApplication(app));
            this.publishApplications();
        } catch (error) {
            console.error('Unable to restore stored applications', error);
            this.applications = [];
            this.publishApplications();
        }
    }

    private hydrateApplication(rawApplication: unknown): JobApplication {
        const app = rawApplication as Partial<JobApplication>;
        const applicationDate = app.applicationDate ? this.toDate(app.applicationDate) : new Date();
        const status: ApplicationStatus = app.status ?? 'Envoyé';
        const contractType: ContractType = app.contractType ?? 'CDI';

        return {
            ...app,
            id: app.id ?? this.generateId(),
            company: app.company ?? '',
            position: app.position ?? '',
            applicationDate,
            status,
            notes: app.notes ?? '',
            lastUpdated: app.lastUpdated ? this.toDate(app.lastUpdated) : new Date(applicationDate.getTime()),
            responseDate: app.responseDate ? this.toDate(app.responseDate) : undefined,
            offerUrl: app.offerUrl || undefined,
            contractType,
            salaryTarget: typeof app.salaryTarget === 'number' ? app.salaryTarget : undefined,
            salaryPeriod: app.salaryPeriod ?? (contractType === 'Freelance' ? 'Journalier' : 'Annuel'),
            followUpDate: app.followUpDate ? this.toDate(app.followUpDate) : undefined,
            recruiterName: app.recruiterName || app.contactPerson || undefined,
            recruiterEmail: app.recruiterEmail || app.contactEmail || undefined,
            recruiterPhone: app.recruiterPhone || app.contactPhone || undefined,
            stage: app.stage ?? this.inferStage(status),
            priority: app.priority ?? 'Moyenne',
            interviews: (app.interviews ?? []).map(interview => ({
                ...interview,
                date: this.toDate(interview.date)
            }))
        };
    }

    private inferStage(status: ApplicationStatus): RecruitmentStage {
        switch (status) {
            case 'Entretien':
                return 'Screening RH';
            case 'Accepté':
                return 'Offre';
            case 'Refusé':
                return 'Clôturé';
            default:
                return 'Candidature';
        }
    }

    private toDate(value: Date | string | number): Date {
        if (value instanceof Date) {
            return new Date(value.getTime());
        }
        return new Date(value);
    }

    private saveToLocalStorage(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.applications));
        } catch (error) {
            console.error('Unable to persist applications', error);
        }
    }

    private publishApplications(): void {
        this.applicationsSubject.next([...this.applications]);
    }

    private persistAndPublish(): void {
        this.saveToLocalStorage();
        this.publishApplications();
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
        const applicationExists = this.applications.some(app => app.id === updatedApplication.id);
        if (!applicationExists) {
            return;
        }

        this.applications = this.applications.map(app =>
            app.id === updatedApplication.id ? {...updatedApplication} : app
        );
        this.persistAndPublish();
    }

    deleteApplication(id: string): void {
        const nextApplications = this.applications.filter(app => app.id !== id);
        if (nextApplications.length === this.applications.length) {
            return;
        }

        this.applications = nextApplications;
        this.persistAndPublish();
    }

    getDueFollowUps(now = new Date()): JobApplication[] {
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        return this.applications
            .filter(app =>
                app.status !== 'Accepté'
                && app.status !== 'Refusé'
                && !!app.followUpDate
                && app.followUpDate < tomorrow
            )
            .sort((a, b) => (a.followUpDate?.getTime() ?? 0) - (b.followUpDate?.getTime() ?? 0));
    }

    calculateStatistics(): JobStatistics {
        const statusCounts = {
            sent: 0,
            interview: 0,
            accepted: 0,
            rejected: 0
        };

        let responsesCount = 0;
        const responseTimes: number[] = [];

        this.applications.forEach(app => {
            switch (app.status) {
                case 'Envoyé':
                    statusCounts.sent++;
                    break;
                case 'Entretien':
                    statusCounts.interview++;
                    responsesCount++;
                    break;
                case 'Accepté':
                    statusCounts.accepted++;
                    responsesCount++;
                    break;
                case 'Refusé':
                    statusCounts.rejected++;
                    responsesCount++;
                    break;
            }

            if (app.status !== 'Envoyé' && app.responseDate) {
                responseTimes.push(this.daysBetween(app.applicationDate, app.responseDate));
            }
        });

        const responseRate = this.applications.length > 0
            ? (responsesCount / this.applications.length) * 100
            : 0;

        const averageResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((sum, responseTime) => sum + responseTime, 0) / responseTimes.length
            : 0;

        return {
            totalApplications: this.applications.length,
            responseRate,
            averageResponseTime,
            statusCounts,
            applicationsByWeek: this.getApplicationsByWeek(),
            mostResponsiveCompanies: this.getMostResponsiveCompanies()
        };
    }

    private getApplicationsByWeek(): { week: string; count: number }[] {
        const weeks = new Map<string, number>();

        this.applications.forEach(app => {
            const weekNumber = this.getWeekNumber(app.applicationDate).toString().padStart(2, '0');
            const weekKey = `${app.applicationDate.getFullYear()}-W${weekNumber}`;
            weeks.set(weekKey, (weeks.get(weekKey) ?? 0) + 1);
        });

        return Array.from(weeks.entries())
            .map(([week, count]) => ({week, count}))
            .sort((a, b) => a.week.localeCompare(b.week));
    }

    private getWeekNumber(date: Date): number {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    private getMostResponsiveCompanies(): { company: string; responseTime: number }[] {
        const companies = new Map<string, { count: number; totalTime: number }>();

        this.applications.forEach(app => {
            if (!app.responseDate || app.status === 'Envoyé') {
                return;
            }

            const responseTime = this.daysBetween(app.applicationDate, app.responseDate);
            const current = companies.get(app.company) ?? {count: 0, totalTime: 0};
            companies.set(app.company, {
                count: current.count + 1,
                totalTime: current.totalTime + responseTime
            });
        });

        return Array.from(companies.entries())
            .map(([company, stats]) => ({
                company,
                responseTime: stats.totalTime / stats.count
            }))
            .sort((a, b) => a.responseTime - b.responseTime)
            .slice(0, 5);
    }

    generateSuggestions(): Suggestion[] {
        const suggestions: Suggestion[] = [];
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        this.getDueFollowUps(now).forEach(app => {
            const daysLate = app.followUpDate
                ? Math.floor(this.daysBetween(app.followUpDate, now))
                : 0;
            const timing = daysLate > 0
                ? `en retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}`
                : 'prévue aujourd\'hui';

            suggestions.push({
                id: `follow-up-${app.id}`,
                type: 'warning',
                message: `Relance ${timing} : ${app.company} — ${app.position}.`,
                relatedApplicationId: app.id
            });
        });

        this.applications
            .filter(app => app.status === 'Envoyé' && !app.followUpDate && app.applicationDate < oneWeekAgo)
            .forEach(app => {
                suggestions.push({
                    id: `pending-${app.id}`,
                    type: 'warning',
                    message: `Aucune relance planifiée pour ${app.company}. Candidature envoyée il y a ${this.getDaysSince(app.applicationDate)} jours.`,
                    relatedApplicationId: app.id
                });
            });

        const latestApplication = this.applications.reduce<JobApplication | undefined>((latest, application) => {
            if (!latest) {
                return application;
            }

            return application.applicationDate.getTime() > latest.applicationDate.getTime()
                ? application
                : latest;
        }, undefined);

        if (latestApplication && latestApplication.applicationDate < twoWeeksAgo) {
            suggestions.push({
                id: 'no-recent-applications',
                type: 'info',
                message: 'Vous n\'avez pas postulé depuis 2 semaines. Pensez à relancer votre pipeline.'
            });
        }

        const rejectedApplications = this.applications.filter(app => app.status === 'Refusé');
        if (rejectedApplications.length >= 3) {
            suggestions.push({
                id: 'multiple-rejections',
                type: 'info',
                message: 'Plusieurs candidatures ont été refusées. Comparez les postes ciblés et adaptez votre CV ou votre approche.'
            });
        }

        return suggestions;
    }

    private daysBetween(start: Date, end: Date): number {
        return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    private getDaysSince(date: Date): number {
        return Math.floor(this.daysBetween(date, new Date()));
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}
