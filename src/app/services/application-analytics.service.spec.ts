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
