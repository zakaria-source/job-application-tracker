import {describe, expect, it} from 'vitest';
import {JobApplication} from '@app/features/applications/models/application.model';
import {ApplicationExportService} from './application-export.service';

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
  interviews: []
};

describe('ApplicationExportService', () => {
  it('serializes a versioned JobTrackr backup', () => {
    const serialized = new ApplicationExportService().serialize([application]);
    const parsed = JSON.parse(serialized) as {version: number; exportedAt: string; applications: unknown[]};

    expect(parsed.version).toBe(2);
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.applications).toHaveLength(1);
  });
});
