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
