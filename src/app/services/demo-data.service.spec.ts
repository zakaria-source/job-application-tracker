import {beforeEach, describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {LocalStorageJobApplicationRepository} from '../data/local-storage-job-application.repository';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';
import {DemoDataService} from './demo-data.service';
import {StorageService} from './storage.service';

describe('DemoDataService', () => {
  let storage: StorageService;
  let demoData: DemoDataService;

  beforeEach(() => {
    localStorage.clear();
    const workflow = new ApplicationWorkflowService();
    storage = new StorageService(
      new LocalStorageJobApplicationRepository(workflow),
      new ApplicationAnalyticsService(),
      new FollowUpService(),
      workflow
    );
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
