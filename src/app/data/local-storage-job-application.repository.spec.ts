import {beforeEach, describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {LocalStorageJobApplicationRepository} from './local-storage-job-application.repository';

describe('LocalStorageJobApplicationRepository', () => {
    let repository: LocalStorageJobApplicationRepository;
    beforeEach(() => { localStorage.clear(); repository = new LocalStorageJobApplicationRepository(new ApplicationWorkflowService()); });

    it('migrates legacy array storage and legacy recruiter fields', () => {
        localStorage.setItem('job-applications', JSON.stringify([{id:'1',company:'Acme',position:'Engineer',applicationDate:'2026-08-01',status:'Entretien',contactPerson:'Jane'}]));
        const [application] = repository.load();
        expect(application.recruiterName).toBe('Jane');
        expect(application.stage).toBe('Screening RH');
        expect(application.applicationDate).toBeInstanceOf(Date);
    });

    it('persists a versioned envelope', () => {
        repository.save([]);
        expect(JSON.parse(localStorage.getItem('job-applications') ?? '{}')).toMatchObject({version: 2, applications: []});
    });
});
