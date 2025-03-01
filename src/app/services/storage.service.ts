import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {JobApplication, JobStatistics, Suggestion} from '../models/job-application.model';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private readonly STORAGE_KEY = 'job-applications';
    private applications: JobApplication[] = [];
    private applicationsSubject = new BehaviorSubject<JobApplication[]>([]);

    constructor() {
        this.loadFromLocalStorage();
    }

    private loadFromLocalStorage(): void {
        const storedData = localStorage.getItem(this.STORAGE_KEY);
        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData);
                // Convert string dates back to Date objects
                this.applications = parsedData.map((app: any) => ({
                    ...app,
                    applicationDate: new Date(app.applicationDate),
                    lastUpdated: new Date(app.lastUpdated),
                    responseDate: app.responseDate ? new Date(app.responseDate) : undefined,
                    interviews: app.interviews ? app.interviews.map((interview: any) => ({
                        ...interview,
                        date: new Date(interview.date)
                    })) : []
                }));
                this.applicationsSubject.next([...this.applications]);
            } catch (error) {
                console.error('Error parsing stored applications', error);
                this.applications = [];
            }
        }
    }

    private saveToLocalStorage(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.applications));
    }

    getApplications(): Observable<JobApplication[]> {
        return this.applicationsSubject.asObservable();
    }

    getApplicationById(id: string): JobApplication | undefined {
        return this.applications.find(app => app.id === id);
    }

    addApplication(application: JobApplication): void {
        this.applications.push(application);
        this.saveToLocalStorage();
        this.applicationsSubject.next([...this.applications]);
    }

    updateApplication(updatedApplication: JobApplication): void {
        const index = this.applications.findIndex(app => app.id === updatedApplication.id);
        if (index !== -1) {
            this.applications[index] = {...updatedApplication};
            this.saveToLocalStorage();
            this.applicationsSubject.next([...this.applications]);
        }
    }

    deleteApplication(id: string): void {
        this.applications = this.applications.filter(app => app.id !== id);
        this.saveToLocalStorage();
        this.applicationsSubject.next([...this.applications]);
    }

    calculateStatistics(): JobStatistics {
        const now = new Date();
        const statusCounts = {
            sent: 0,
            interview: 0,
            accepted: 0,
            rejected: 0
        };

        let responsesCount = 0;
        let totalResponseTime = 0;

        // Count applications by status
        this.applications.forEach(app => {
            switch (app.status) {
                case 'Envoyé':
                    statusCounts.sent++;
                    break;
                case 'Entretien':
                    statusCounts.interview++;
                    responsesCount++;
                    if (app.responseDate) {
                        totalResponseTime += (app.responseDate.getTime() - app.applicationDate.getTime()) / (1000 * 60 * 60 * 24);
                    }
                    break;
                case 'Accepté':
                    statusCounts.accepted++;
                    responsesCount++;
                    if (app.responseDate) {
                        totalResponseTime += (app.responseDate.getTime() - app.applicationDate.getTime()) / (1000 * 60 * 60 * 24);
                    }
                    break;
                case 'Refusé':
                    statusCounts.rejected++;
                    responsesCount++;
                    if (app.responseDate) {
                        totalResponseTime += (app.responseDate.getTime() - app.applicationDate.getTime()) / (1000 * 60 * 60 * 24);
                    }
                    break;
            }
        });

        // Calculate response rate
        const responseRate = this.applications.length > 0
            ? (responsesCount / this.applications.length) * 100
            : 0;

        // Calculate average response time in days
        const averageResponseTime = responsesCount > 0
            ? totalResponseTime / responsesCount
            : 0;

        // Group applications by week
        const applicationsByWeek = this.getApplicationsByWeek();

        // Find most responsive companies
        const mostResponsiveCompanies = this.getMostResponsiveCompanies();

        return {
            totalApplications: this.applications.length,
            responseRate,
            averageResponseTime,
            statusCounts,
            applicationsByWeek,
            mostResponsiveCompanies
        };
    }

    private getApplicationsByWeek(): { week: string; count: number }[] {
        const weeks: { [key: string]: number } = {};

        this.applications.forEach(app => {
            const date = new Date(app.applicationDate);
            const year = date.getFullYear();
            const weekNumber = this.getWeekNumber(date);
            const weekKey = `${year}-W${weekNumber}`;

            if (!weeks[weekKey]) {
                weeks[weekKey] = 0;
            }
            weeks[weekKey]++;
        });

        return Object.keys(weeks).map(week => ({
            week,
            count: weeks[week]
        })).sort((a, b) => a.week.localeCompare(b.week));
    }

    private getWeekNumber(date: Date): number {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    private getMostResponsiveCompanies(): { company: string; responseTime: number }[] {
        const companies: { [key: string]: { count: number; totalTime: number } } = {};

        this.applications.forEach(app => {
            if (app.responseDate && app.status !== 'Envoyé') {
                const responseTime = (app.responseDate.getTime() - app.applicationDate.getTime()) / (1000 * 60 * 60 * 24);

                if (!companies[app.company]) {
                    companies[app.company] = {count: 0, totalTime: 0};
                }

                companies[app.company].count++;
                companies[app.company].totalTime += responseTime;
            }
        });

        return Object.keys(companies)
            .filter(company => companies[company].count > 0)
            .map(company => ({
                company,
                responseTime: companies[company].totalTime / companies[company].count
            }))
            .sort((a, b) => a.responseTime - b.responseTime)
            .slice(0, 5);
    }

    generateSuggestions(): Suggestion[] {
        const suggestions: Suggestion[] = [];
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Check for applications without response for more than 7 days
        const pendingApplications = this.applications.filter(
            app => app.status === 'Envoyé' && new Date(app.applicationDate) < oneWeekAgo
        );

        pendingApplications.forEach(app => {
            suggestions.push({
                id: `pending-${app.id}`,
                type: 'warning',
                message: `Pensez à relancer ${app.company} pour votre candidature au poste de ${app.position}. Aucune réponse depuis ${this.getDaysSince(app.applicationDate)} jours.`,
                relatedApplicationId: app.id
            });
        });

        // Check if user hasn't applied in the last 2 weeks
        const latestApplication = this.applications
            .sort((a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0];

        if (latestApplication && new Date(latestApplication.applicationDate) < twoWeeksAgo) {
            suggestions.push({
                id: 'no-recent-applications',
                type: 'info',
                message: 'Vous n\'avez pas postulé depuis 2 semaines. Envoyez de nouvelles candidatures pour maximiser vos chances.'
            });
        }

        // Check for multiple rejections
        const rejectedApplications = this.applications.filter(app => app.status === 'Refusé');
        if (rejectedApplications.length >= 3) {
            suggestions.push({
                id: 'multiple-rejections',
                type: 'info',
                message: 'Plusieurs de vos candidatures ont été refusées. Essayez d\'adapter votre CV pour améliorer vos chances.'
            });
        }

        // Check for upcoming interviews
        const upcomingInterviews = this.applications.flatMap(app =>
            (app.interviews || [])
                .filter(interview => new Date(interview.date) > now && new Date(interview.date) < new Date(now.getTime() + 48 * 60 * 60 * 1000))
                .map(interview => ({application: app, interview}))
        );

        upcomingInterviews.forEach(({application, interview}) => {
            suggestions.push({
                id: `interview-${interview.id}`,
                type: 'success',
                message: `Vous avez un entretien ${interview.type} prévu avec ${application.company} le ${this.formatDate(interview.date)}.`,
                relatedApplicationId: application.id
            });
        });

        return suggestions;
    }

    private getDaysSince(date: Date): number {
        const now = new Date();
        return Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    }

    private formatDate(date: Date): string {
        return new Date(date).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}