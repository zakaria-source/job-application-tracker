import {afterEach, describe, expect, it} from 'vitest';
import {SessionStore} from '@app/core/auth/session.store';
import {ApplicationDraftService} from './application-draft.service';
import {ApplicationFormDraft} from '@app/features/applications/models/application-draft.model';

const formDraft: ApplicationFormDraft = {
  company: 'Mirakl',
  position: 'Software Engineer Java',
  offerUrl: 'https://jobs.example.com/42',
  contractType: 'CDI',
  salaryTarget: 65000,
  salaryPeriod: 'Annuel',
  applicationDate: '2026-08-19T00:00:00.000Z',
  stage: 'Candidature',
  priority: 'Moyenne',
  followUpDate: null,
  recruiterName: '',
  recruiterEmail: '',
  recruiterPhone: '',
  notes: 'Préparer Kafka',
  interviews: []
};

function serviceFor(userId = 'user-1'): ApplicationDraftService {
  const sessionStore = {
    current: {
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: {id: userId, email: 'user@example.com', displayName: 'User'}
    }
  } as SessionStore;
  return new ApplicationDraftService(sessionStore);
}

afterEach(() => localStorage.clear());

describe('ApplicationDraftService', () => {
  it('persists and restores a draft for the current user', () => {
    const service = serviceFor();
    const now = new Date('2026-08-19T00:30:00.000Z');

    service.save(formDraft, formDraft.offerUrl, now);
    const restored = service.load(new Date('2026-08-19T00:31:00.000Z'));

    expect(restored?.form.company).toBe('Mirakl');
    expect(restored?.jobUrl).toBe(formDraft.offerUrl);
    expect(restored?.updatedAt).toBe(now.toISOString());
  });

  it('keeps drafts isolated between authenticated users', () => {
    serviceFor('user-1').save(formDraft, formDraft.offerUrl, new Date('2026-08-19T00:30:00.000Z'));

    expect(serviceFor('user-2').load(new Date('2026-08-19T00:31:00.000Z'))).toBeNull();
    expect(serviceFor('user-1').load(new Date('2026-08-19T00:31:00.000Z'))?.form.position).toBe('Software Engineer Java');
  });

  it('expires drafts older than fourteen days', () => {
    const service = serviceFor();
    service.save(formDraft, formDraft.offerUrl, new Date('2026-08-01T00:00:00.000Z'));

    expect(service.load(new Date('2026-08-19T00:30:00.000Z'))).toBeNull();
  });

  it('clears a saved draft', () => {
    const service = serviceFor();
    service.save(formDraft, formDraft.offerUrl, new Date('2026-08-19T00:30:00.000Z'));

    service.clear();

    expect(service.load(new Date('2026-08-19T00:31:00.000Z'))).toBeNull();
  });
});
