import {beforeEach, describe, expect, it} from 'vitest';
import {of} from 'rxjs';
import {CloudApiService} from '../cloud/cloud-api.service';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {JobApplication, RecruitmentStage} from '../models/job-application.model';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';
import {StorageService} from './storage.service';

const application: JobApplication = {
  id: '1',
  company: 'Example Company',
  position: 'Backend Engineer',
  applicationDate: new Date('2026-08-17T12:00:00'),
  status: 'Envoyé',
  notes: '',
  lastUpdated: new Date('2026-08-17T12:00:00'),
  contractType: 'CDI',
  salaryPeriod: 'Annuel',
  stage: 'Candidature',
  priority: 'Moyenne',
  offerUrl: 'https://jobs.example.com/backend?source=linkedin',
  interviews: []
};

describe('StorageService', () => {
  let service: StorageService;
  let workflow: ApplicationWorkflowService;
  let serverApplications: JobApplication[];

  beforeEach(() => {
    workflow = new ApplicationWorkflowService();
    serverApplications = [];

    const api = {
      listApplications: () => of(serverApplications.map(item => clone(item))),
      createApplication: (item: JobApplication) => {
        const saved = clone(item);
        serverApplications = [...serverApplications, saved];
        return of(clone(saved));
      },
      updateApplication: (item: JobApplication) => {
        serverApplications = serverApplications.map(existing => existing.id === item.id ? clone(item) : existing);
        return of(clone(item));
      },
      moveApplication: (id: string, stage: RecruitmentStage) => {
        const existing = serverApplications.find(item => item.id === id)!;
        const saved = {...existing, stage, status: workflow.statusForStage(stage)} as JobApplication;
        serverApplications = serverApplications.map(item => item.id === id ? saved : item);
        return of(clone(saved));
      },
      deleteApplication: (id: string) => {
        serverApplications = serverApplications.filter(item => item.id !== id);
        return of(undefined);
      },
      importApplications: (items: readonly JobApplication[]) => {
        serverApplications = [...serverApplications, ...items.map(item => clone(item))];
        return of({imported: items.length, skipped: 0});
      }
    } as unknown as CloudApiService;

    service = new StorageService(
      api,
      new ApplicationAnalyticsService(),
      new FollowUpService(),
      workflow
    );
    service.connect([]);
  });

  it('uses the backend for add, update and delete operations', () => {
    service.addApplication(application);
    expect(service.getApplicationById('1')?.company).toBe('Example Company');

    service.updateApplication({...application, company: 'Updated Company'});
    expect(service.getApplicationById('1')?.company).toBe('Updated Company');

    service.deleteApplication('1');
    expect(service.getApplicationById('1')).toBeUndefined();
    expect(serverApplications).toHaveLength(0);
  });

  it('merges only missing applications and ignores tracking query parameters', () => {
    service.addApplication(application);

    const duplicateWithDifferentId: JobApplication = {
      ...application,
      id: 'other-id',
      offerUrl: 'https://jobs.example.com/backend?utm_source=portfolio'
    };
    const second: JobApplication = {
      ...application,
      id: '2',
      company: 'Second Company',
      position: 'Java Engineer',
      offerUrl: 'https://jobs.example.com/java'
    };

    expect(service.mergeApplications([duplicateWithDifferentId, second])).toBe(1);
    expect(service.getApplicationById('other-id')).toBeUndefined();
    expect(service.getApplicationById('2')).toBeDefined();
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

  it('exports and imports backups through the backend', () => {
    service.addApplication(application);
    const backup = service.exportData();
    service.deleteApplication('1');

    expect(service.importData(backup)).toBe(1);
    expect(service.getApplicationById('1')).toBeDefined();
  });
});

function clone(item: JobApplication): JobApplication {
  return {
    ...item,
    applicationDate: new Date(item.applicationDate),
    lastUpdated: new Date(item.lastUpdated),
    responseDate: item.responseDate ? new Date(item.responseDate) : undefined,
    followUpDate: item.followUpDate ? new Date(item.followUpDate) : undefined,
    interviews: (item.interviews ?? []).map(interview => ({...interview, date: new Date(interview.date)}))
  };
}
