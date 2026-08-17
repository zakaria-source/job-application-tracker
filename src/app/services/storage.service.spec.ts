import {beforeEach, describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {LocalStorageJobApplicationRepository} from '../data/local-storage-job-application.repository';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';
import {StorageService} from './storage.service';
import {JobApplication} from '../models/job-application.model';

const application: JobApplication = {
    id: '1',
    company: 'Acme',
    position: 'Engineer',
    applicationDate: new Date('2026-08-17'),
    status: 'Envoyé',
    notes: '',
    lastUpdated: new Date('2026-08-17'),
    contractType: 'CDI',
    salaryPeriod: 'Annuel',
    stage: 'Candidature',
    priority: 'Moyenne'
};

describe('StorageService', () => {
    let service: StorageService;
    let workflow: ApplicationWorkflowService;

    beforeEach(() => {
        localStorage.clear();
        workflow = new ApplicationWorkflowService();
        const repository = new LocalStorageJobApplicationRepository(workflow);
        service = new StorageService(
            repository,
            new ApplicationAnalyticsService(),
            new FollowUpService(),
            workflow
        );
    });

    it('persists add, update and delete operations', () => {
        service.addApplication(application);
        expect(service.getApplicationById('1')?.company).toBe('Acme');
        service.updateApplication({...application, company: 'Updated'});
        expect(service.getApplicationById('1')?.company).toBe('Updated');
        service.deleteApplication('1');
        expect(service.getApplicationById('1')).toBeUndefined();
    });

    it('updates stage and derived workflow status atomically', () => {
        const transitionDate = new Date('2026-08-18T09:00:00');
        service.addApplication(application);

        service.updateApplicationStage('1', 'Entretien technique', transitionDate);

        const updated = service.getApplicationById('1');
        expect(updated?.stage).toBe('Entretien technique');
        expect(updated?.status).toBe('Entretien');
        expect(updated?.responseDate).toEqual(transitionDate);
        expect(updated?.lastUpdated).toEqual(transitionDate);
    });

    it('keeps the first response date when moving between later stages', () => {
        const firstResponse = new Date('2026-08-18T09:00:00');
        service.addApplication({...application, stage: 'Screening RH', status: 'Entretien', responseDate: firstResponse});

        service.updateApplicationStage('1', 'Hiring Manager', new Date('2026-08-19T09:00:00'));

        expect(service.getApplicationById('1')?.responseDate).toEqual(firstResponse);
    });

    it('exports and imports data', () => {
        service.addApplication(application);
        const backup = service.exportData();
        service.deleteApplication('1');
        expect(service.importData(backup)).toBe(1);
        expect(service.getApplicationById('1')).toBeDefined();
    });
});
