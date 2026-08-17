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
