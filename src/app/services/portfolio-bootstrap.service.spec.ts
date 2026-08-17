import {beforeEach, describe, expect, it} from 'vitest';
import {CURRENT_APPLICATIONS} from '../data/current-applications.data';
import {ApplicationWorkflowService} from '../domain/application-workflow.service';
import {LocalStorageJobApplicationRepository} from '../data/local-storage-job-application.repository';
import {ApplicationAnalyticsService} from './application-analytics.service';
import {FollowUpService} from './follow-up.service';
import {PortfolioBootstrapService} from './portfolio-bootstrap.service';
import {StorageService} from './storage.service';

describe('PortfolioBootstrapService', () => {
  let storage: StorageService;
  let bootstrap: PortfolioBootstrapService;

  beforeEach(() => {
    localStorage.clear();
    const workflow = new ApplicationWorkflowService();
    storage = new StorageService(
      new LocalStorageJobApplicationRepository(workflow),
      new ApplicationAnalyticsService(),
      new FollowUpService(),
      workflow
    );
    bootstrap = new PortfolioBootstrapService(storage);
  });

  it('loads the current application dataset once', () => {
    expect(bootstrap.bootstrap()).toBe(CURRENT_APPLICATIONS.length);
    expect(storage.getApplicationById('current-mirakl-2026-08-13')).toBeDefined();
    expect(bootstrap.bootstrap()).toBe(0);
  });

  it('does not overwrite an existing equivalent application', () => {
    const mirakl = CURRENT_APPLICATIONS[0];
    storage.addApplication({
      ...mirakl,
      id: 'custom-user-id',
      notes: 'Notes modifiées manuellement',
      offerUrl: `${mirakl.offerUrl}?utm_source=manual`
    });

    const added = bootstrap.bootstrap();

    expect(added).toBe(CURRENT_APPLICATIONS.length - 1);
    expect(storage.getApplicationById('custom-user-id')?.notes).toBe('Notes modifiées manuellement');
    expect(storage.getApplicationById(mirakl.id)).toBeUndefined();
  });
});
