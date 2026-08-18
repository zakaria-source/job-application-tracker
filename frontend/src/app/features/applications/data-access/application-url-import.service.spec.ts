import {describe, expect, it} from 'vitest';
import {ApplicationUrlImportService} from './application-url-import.service';
import {JobImportPreview} from '@app/features/applications/models/job-import.model';

describe('ApplicationUrlImportService', () => {
  it('builds a reviewable application draft without overwriting the candidate salary target', () => {
    const service = new ApplicationUrlImportService();
    const preview: JobImportPreview = {
      sourceUrl: 'https://jobs.example.com/42?source=linkedin',
      canonicalUrl: 'https://jobs.example.com/42',
      company: 'Acme',
      position: 'Backend Engineer',
      location: 'Paris, FR',
      description: 'Build Java services.',
      contractType: 'CDI',
      employmentType: 'FULL_TIME',
      salary: '60000 - 70000 EUR / YEAR',
      datePosted: '2026-08-17',
      extractionSource: 'JSON_LD',
      confidence: 'HIGH',
      warnings: []
    };
    const now = new Date('2026-08-18T12:00:00Z');

    const draft = service.buildDraft(preview, now);

    expect(draft.company).toBe('Acme');
    expect(draft.position).toBe('Backend Engineer');
    expect(draft.offerUrl).toBe('https://jobs.example.com/42');
    expect(draft.contractType).toBe('CDI');
    expect(draft.salaryTarget).toBeUndefined();
    expect(draft.notes).toContain('Localisation : Paris, FR');
    expect(draft.notes).toContain('Rémunération annoncée : 60000 - 70000 EUR / YEAR');
    expect(draft.notes).toContain('Build Java services.');
    expect(draft.applicationDate).toEqual(now);
  });
});
