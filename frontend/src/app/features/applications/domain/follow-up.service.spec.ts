import {describe, expect, it} from 'vitest';
import {FollowUpService} from '@app/features/applications/domain/follow-up.service';
import {JobApplication} from '@app/features/applications/models/application.model';

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
