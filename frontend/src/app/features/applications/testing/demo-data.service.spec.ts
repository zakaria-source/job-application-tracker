import {beforeEach, describe, expect, it} from 'vitest';
import {of} from 'rxjs';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {ApplicationImportService} from '@app/features/applications/data-access/application-import.service';
import {ApplicationStore} from '@app/features/applications/data-access/application.store';
import {ApplicationAnalyticsService} from '@app/features/applications/domain/application-analytics.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {FollowUpService} from '@app/features/applications/domain/follow-up.service';
import {JobApplication} from '@app/features/applications/models/application.model';
import {DemoDataService} from '@app/features/applications/testing/demo-data.service';

describe('DemoDataService', () => {
  let storage: ApplicationStore;
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
    } as unknown as JobTrackrApiService;

    storage = new ApplicationStore(
      api,
      new ApplicationAnalyticsService(),
      new FollowUpService(),
      workflow,
      new ApplicationImportService(workflow)
    );
    storage.connect([]);
    demoData = new DemoDataService(storage);
  });

  it('loads three fictional applications only when explicitly requested', () => {
    expect(storage.getApplicationById('demo-acme-cloud-backend')).toBeUndefined();

    let imported = -1;
    demoData.load().subscribe(count => imported = count);
    expect(imported).toBe(3);

    expect(storage.getApplicationById('demo-acme-cloud-backend')?.company).toBe('Acme Cloud');
    expect(storage.getApplicationById('demo-nova-payments-software')?.company).toBe('Nova Payments');
    expect(storage.getApplicationById('demo-greentech-platform')?.company).toBe('GreenTech Labs');
  });

  it('uses the existing merge semantics and does not duplicate demo applications', () => {
    const results: number[] = [];
    demoData.load().subscribe(count => results.push(count));
    demoData.load().subscribe(count => results.push(count));
    expect(results).toEqual([3, 0]);
  });
});
