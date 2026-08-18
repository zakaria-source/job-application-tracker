import {beforeEach, describe, expect, it} from 'vitest';
import {of} from 'rxjs';
import {CloudApiService} from '../cloud/cloud-api.service';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {JobApplication} from '../models/job-application.model';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';
import {DemoDataService} from './demo-data.service';
import {StorageService} from './storage.service';

describe('DemoDataService', () => {
  let storage: StorageService;
  let demoData: DemoDataService;
  let serverApplications: JobApplication[];

  beforeEach(() => {
    serverApplications = [];
    const workflow = new ApplicationWorkflowService();
    const api = {
      listApplications: () => of(serverApplications),
      importApplications: (applications: readonly JobApplication[]) => {
        serverApplications = [...serverApplications, ...applications];
        return of({imported: applications.length, skipped: 0});
      }
    } as unknown as CloudApiService;

    storage = new StorageService(
      api,
      new ApplicationAnalyticsService(),
      new FollowUpService(),
      workflow
    );
    storage.connect([]);
    demoData = new DemoDataService(storage);
  });

  it('loads three fictional applications only when explicitly requested', () => {
    expect(storage.getApplicationById('demo-acme-cloud-backend')).toBeUndefined();

    expect(demoData.load()).toBe(3);

    expect(storage.getApplicationById('demo-acme-cloud-backend')?.company).toBe('Acme Cloud');
    expect(storage.getApplicationById('demo-nova-payments-software')?.company).toBe('Nova Payments');
    expect(storage.getApplicationById('demo-greentech-platform')?.company).toBe('GreenTech Labs');
  });

  it('uses the existing merge semantics and does not duplicate demo applications', () => {
    expect(demoData.load()).toBe(3);
    expect(demoData.load()).toBe(0);
  });
});
