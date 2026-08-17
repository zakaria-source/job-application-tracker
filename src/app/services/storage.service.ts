import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {JobApplication, JobStatistics, Suggestion} from '../models/job-application.model';

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
        const app = rawApplication as JobApplication;

        return {
            ...app,
            applicationDate: this.toDate(app.applicationDate),
            lastUpdated: this.toDate(app.lastUpdated),
            responseDate: app.responseDate ? this.toDate(app.responseDate) : undefined,
            interviews: (app.interviews ?? []).map(interview => ({
                ...interview,
                date: this.toDate(interview.date)
            }))
        };
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

        this.applications
            .filter(app => app.status === 'Envoyé' && app.applicationDate < oneWeekAgo)
            .forEach(app => {
                suggestions.push({
                    id: `pending-${app.id}`,
                    type: 'warning',
                    message: `Pensez à relancer ${app.company} pour votre candidature au poste de ${app.position}. Aucune réponse depuis ${this.getDaysSince(app.applicationDate)} jours.`,
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
                message: 'Vous n\'avez pas postulé depuis 2 semaines. Envoyez de nouvelles candidatures pour maximiser vos chances.'
            });
        }

        const rejectedApplications = this.applications.filter(app => app.status === 'Refusé');
        if (rejectedApplications.length >= 3) {
            suggestions.push({
                id: 'multiple-rejections',
                type: 'info',
                message: 'Plusieurs de vos candidatures ont été refusées. Essayez d\'adapter votre CV pour améliorer vos chances.'
            });
        }

        this.applications
            .flatMap(app =>
                (app.interviews ?? [])
                    .filter(interview => {
                        const interviewTime = interview.date.getTime();
                        return interviewTime > now.getTime()
                            && interviewTime < now.getTime() + 48 * 60 * 60 * 1000;
                    })
                    .map(interview => ({application: app, interview}))
            )
            .forEach(({application, interview}) => {
                suggestions.push({
                    id: `interview-${interview.id}`,
                    type: 'success',
                    message: `Vous avez un entretien ${interview.type} prévu avec ${application.company} le ${this.formatDate(interview.date)}.`,
                    relatedApplicationId: application.id
                });
            });

        return suggestions;
    }

    private daysBetween(start: Date, end: Date): number {
        return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    private getDaysSince(date: Date): number {
        return Math.floor(this.daysBetween(date, new Date()));
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
