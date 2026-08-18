import {describe, expect, it} from 'vitest';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {JobApplication} from '../models/job-application.model';

const app = (
  id: string,
  status: JobApplication['status'],
  applicationDate = new Date('2026-08-01T12:00:00'),
  responseDate?: Date
): JobApplication => ({
  id,
  company: 'Example Company',
  position: 'Engineer',
  applicationDate,
  status,
  notes: '',
  lastUpdated: applicationDate,
  responseDate,
  contractType: 'CDI',
  salaryPeriod: 'Annuel',
  stage: status === 'Envoyé'
    ? 'Candidature'
    : status === 'Entretien'
      ? 'Screening RH'
      : status === 'Accepté'
        ? 'Offre'
        : 'Clôturé',
  priority: 'Moyenne'
});

describe('ApplicationAnalyticsService', () => {
  it('calculates response rate and calendar response time', () => {
    const stats = new ApplicationAnalyticsService().calculate([
      app('1', 'Envoyé'),
      app('2', 'Entretien', new Date('2026-08-01T23:30:00'), new Date('2026-08-05T00:15:00'))
    ]);

    expect(stats.responseRate).toBe(50);
    expect(stats.averageResponseTime).toBe(4);
    expect(stats.statusCounts.interview).toBe(1);
  });

  it('uses ISO week-year around New Year boundaries', () => {
    const stats = new ApplicationAnalyticsService().calculate([
      app('1', 'Envoyé', new Date(2021, 0, 1, 12, 0, 0)),
      app('2', 'Envoyé', new Date(2021, 0, 4, 12, 0, 0))
    ]);

    expect(stats.applicationsByWeek).toEqual([
      {week: '2020-W53', count: 1},
      {week: '2021-W01', count: 1}
    ]);
  });
});
