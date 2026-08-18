import {describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {JobApplication} from '@app/features/applications/models/application.model';
import {ApplicationImportService} from './application-import.service';

const existing: JobApplication = {
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

describe('ApplicationImportService', () => {
  const service = new ApplicationImportService(new ApplicationWorkflowService());

  it('previews duplicates before importing a backup', () => {
    const duplicate = {...existing, id: 'duplicate', offerUrl: 'https://jobs.example.com/backend?utm_source=backup'};
    const fresh = {...existing, id: '2', company: 'Fresh Company', offerUrl: 'https://jobs.example.com/fresh'};

    const preview = service.preview(JSON.stringify({applications: [duplicate, fresh]}), [existing]);

    expect(preview.detected).toBe(2);
    expect(preview.ready).toBe(1);
    expect(preview.duplicates).toBe(1);
    expect(preview.applications[0].company).toBe('Fresh Company');
  });

  it('hydrates legacy contact fields while normalizing workflow defaults', () => {
    const preview = service.preview(JSON.stringify([{company: 'Legacy', position: 'Engineer', contactPerson: 'Sam'}]), []);

    expect(preview.ready).toBe(1);
    expect(preview.applications[0].recruiterName).toBe('Sam');
    expect(preview.applications[0].stage).toBe('Candidature');
    expect(preview.applications[0].status).toBe('Envoyé');
  });
});
