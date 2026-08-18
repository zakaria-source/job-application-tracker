import {Injectable} from '@angular/core';
import {SessionStore} from '@app/core/auth/session.store';
import {ApplicationFormDraft, ApplicationStudioDraft} from '@app/features/applications/models/application-draft.model';

@Injectable({providedIn: 'root'})
export class ApplicationDraftService {
  private readonly storagePrefix = 'jobtrackr-application-draft-v1';
  private readonly ttlMs = 14 * 24 * 60 * 60 * 1000;

  constructor(private readonly sessionStore: SessionStore) {}

  save(form: ApplicationFormDraft, jobUrl: string, now = new Date()): ApplicationStudioDraft | null {
    const key = this.storageKey();
    if (!key) return null;

    const draft: ApplicationStudioDraft = {
      version: 1,
      updatedAt: now.toISOString(),
      jobUrl: jobUrl.trim(),
      form
    };

    try {
      localStorage.setItem(key, JSON.stringify(draft));
      return draft;
    } catch {
      return null;
    }
  }

  load(now = new Date()): ApplicationStudioDraft | null {
    const key = this.storageKey();
    if (!key) return null;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const draft = JSON.parse(raw) as ApplicationStudioDraft;
      if (!this.isValid(draft)) {
        localStorage.removeItem(key);
        return null;
      }

      const updatedAt = new Date(draft.updatedAt).getTime();
      if (!Number.isFinite(updatedAt) || now.getTime() - updatedAt > this.ttlMs) {
        localStorage.removeItem(key);
        return null;
      }

      return draft;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  clear(): void {
    const key = this.storageKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Browser storage may be unavailable in hardened/private contexts.
    }
  }

  private storageKey(): string | null {
    const userId = this.sessionStore.current?.user.id;
    return userId ? `${this.storagePrefix}:${userId}` : null;
  }

  private isValid(draft: ApplicationStudioDraft): boolean {
    const form = draft?.form;
    return draft?.version === 1
      && typeof draft.updatedAt === 'string'
      && typeof draft.jobUrl === 'string'
      && !!form
      && typeof form.company === 'string'
      && typeof form.position === 'string'
      && typeof form.offerUrl === 'string'
      && typeof form.applicationDate === 'string'
      && typeof form.notes === 'string'
      && Array.isArray(form.interviews);
  }
}
