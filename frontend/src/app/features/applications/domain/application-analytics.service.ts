import {Injectable} from '@angular/core';
import {JobStatistics} from '@app/features/applications/models/application-analytics.model';
import {JobApplication} from '@app/features/applications/models/application.model';

@Injectable({providedIn: 'root'})
export class ApplicationAnalyticsService {
  calculate(applications: JobApplication[]): JobStatistics {
    const statusCounts = {sent: 0, interview: 0, accepted: 0, rejected: 0};
    let responsesCount = 0;
    const responseTimes: number[] = [];

    applications.forEach(app => {
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
      const {year, week} = this.getIsoWeek(app.applicationDate);
      const key = `${year}-W${week.toString().padStart(2, '0')}`;
      weeks.set(key, (weeks.get(key) ?? 0) + 1);
    });

    return [...weeks.entries()]
      .map(([week, count]) => ({week, count}))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  private getIsoWeek(date: Date): {year: number; week: number} {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const weekday = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday);

    const isoYear = utcDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return {year: isoYear, week};
  }

  private getMostResponsiveCompanies(applications: JobApplication[]): {company: string; responseTime: number}[] {
    const companies = new Map<string, {count: number; totalTime: number}>();

    applications.forEach(app => {
      if (!app.responseDate || app.status === 'Envoyé') {
        return;
      }

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
    const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.max(0, (endDay - startDay) / 86400000);
  }
}
