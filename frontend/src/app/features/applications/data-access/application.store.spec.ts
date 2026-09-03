import {beforeEach, describe, expect, it} from 'vitest';
import {of, throwError} from 'rxjs';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {ApplicationAnalyticsService} from '@app/features/applications/domain/application-analytics.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {FollowUpService} from '@app/features/applications/domain/follow-up.service';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';
import {ApplicationImportService} from './application-import.service';
import {ApplicationStore} from './application.store';

const application: JobApplication = {
  id: '1',
  version: 0,
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

describe('ApplicationStore', () => {
  let service: ApplicationStore;
  let workflow: ApplicationWorkflowService;
  let serverApplications: JobApplication[];
  let failUpdate = false;

  beforeEach(() => {
    workflow = new ApplicationWorkflowService();
    serverApplications = [];
    failUpdate = false;

    const api = {
      listApplications: () => of(serverApplications.map(item => clone(item))),
      getApplication: (id: string) => of(clone(serverApplications.find(item => item.id === id)!)),
      exportApplications: () => of(serverApplications.map(item => clone(item))),
      createApplication: (item: JobApplication) => {
        const saved = clone(item);
        serverApplications = [...serverApplications, saved];
        return of(clone(saved));
      },
      updateApplication: (item: JobApplication) => {
        if (failUpdate) return throwError(() => new Error('update failed'));
        const saved = {...clone(item), version: (item.version ?? 0) + 1};
        serverApplications = serverApplications.map(existing => existing.id === item.id ? clone(saved) : existing);
        return of(clone(saved));
      },
      moveApplication: (id: string, stage: RecruitmentStage) => {
        const existing = serverApplications.find(item => item.id === id)!;
        const status = workflow.statusForStage(stage);
        const serverNow = new Date('2026-08-18T09:00:00');
        const saved: JobApplication = {
          ...existing,
          version: (existing.version ?? 0) + 1,
          stage,
          status,
          responseDate: existing.responseDate ?? (status === 'Envoyé' ? undefined : serverNow),
          lastUpdated: serverNow
        };
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
      },
      completeCurrentFollowUp: (id: string) => {
        const completedAt = new Date('2026-08-18T12:00:00');
        serverApplications = serverApplications.map(item => item.id === id
          ? {...item, version: (item.version ?? 0) + 1, followUpDate: undefined, lastUpdated: completedAt}
          : item);
        return of({
          id: 'follow-up-1',
          scheduledFor: new Date('2026-08-18T00:00:00'),
          status: 'COMPLETED',
          completedAt,
          createdAt: new Date('2026-08-17T12:00:00'),
          updatedAt: completedAt
        });
      }
    } as unknown as JobTrackrApiService;

    service = new ApplicationStore(
      api,
      new ApplicationAnalyticsService(),
      new FollowUpService(),
      workflow,
      new ApplicationImportService(workflow)
    );
    service.connect([]);
  });

  it('uses the backend for add, update and delete operations', () => {
    service.addApplication(application).subscribe();
    expect(service.getApplicationById('1')?.company).toBe('Example Company');

    service.updateApplication({...application, company: 'Updated Company'}).subscribe();
    expect(service.getApplicationById('1')?.company).toBe('Updated Company');
    expect(service.getApplicationById('1')?.version).toBe(1);

    service.deleteApplication('1').subscribe();
    expect(service.getApplicationById('1')).toBeUndefined();
    expect(serverApplications).toHaveLength(0);
  });

  it('merges only missing applications and ignores tracking query parameters', () => {
    service.addApplication(application).subscribe();
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

    let imported = -1;
    service.mergeApplications([duplicateWithDifferentId, second]).subscribe(count => imported = count);
    expect(imported).toBe(1);
    expect(service.getApplicationById('other-id')).toBeUndefined();
    expect(service.getApplicationById('2')).toBeDefined();
  });

  it('updates stage and derived workflow status atomically', () => {
    const transitionDate = new Date('2026-08-18T09:00:00');
    service.addApplication(application).subscribe();
    service.updateApplicationStage('1', 'Entretien technique', transitionDate).subscribe();
    const updated = service.getApplicationById('1');
    expect(updated?.stage).toBe('Entretien technique');
    expect(updated?.status).toBe('Entretien');
    expect(updated?.responseDate).toEqual(transitionDate);
    expect(updated?.lastUpdated).toEqual(transitionDate);
  });

  it('keeps the first response date when moving between later stages', () => {
    const firstResponse = new Date('2026-08-18T09:00:00');
    service.addApplication({...application, stage: 'Screening RH', status: 'Entretien', responseDate: firstResponse}).subscribe();
    service.updateApplicationStage('1', 'Hiring Manager', new Date('2026-08-19T09:00:00')).subscribe();
    expect(service.getApplicationById('1')?.responseDate).toEqual(firstResponse);
  });

  it('completes a follow-up, refreshes only the server version and clears its due date', () => {
    const completedAt = new Date('2026-08-18T12:00:00');
    service.addApplication({...application, followUpDate: new Date('2026-08-18T08:00:00')}).subscribe();
    service.completeFollowUp('1', completedAt).subscribe();
    expect(service.getApplicationById('1')?.followUpDate).toBeUndefined();
    expect(service.getApplicationById('1')?.lastUpdated).toEqual(completedAt);
    expect(service.getApplicationById('1')?.version).toBe(1);
  });

  it('rolls back an optimistic edit when the backend rejects it', () => {
    service.addApplication(application).subscribe();
    failUpdate = true;
    service.updateApplication({...application, company: 'Rejected change'}).subscribe({error: () => undefined});
    expect(service.getApplicationById('1')?.company).toBe('Example Company');
    expect(service.getApplicationById('1')?.version).toBe(0);
  });
});

function clone(item: JobApplication): JobApplication {
  return {
    ...item,
    applicationDate: new Date(item.applicationDate.getTime()),
    lastUpdated: new Date(item.lastUpdated.getTime()),
    responseDate: item.responseDate ? new Date(item.responseDate.getTime()) : undefined,
    followUpDate: item.followUpDate ? new Date(item.followUpDate.getTime()) : undefined,
    interviews: (item.interviews ?? []).map(interview => ({...interview, date: new Date(interview.date.getTime())}))
  };
}
