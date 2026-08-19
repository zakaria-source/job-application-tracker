import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {SessionStore} from '@app/core/auth/session.store';

describe('SessionStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('persists only session metadata', () => {
    const store = new SessionStore();
    store.save({
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      sessionExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });

    const stored = JSON.parse(localStorage.getItem('jobtrackr-cloud-session-v1') ?? '{}');
    expect(stored).toEqual({
      expiresAt: expect.any(String),
      sessionExpiresAt: expect.any(String),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });
    expect(store.isAuthenticated()).toBe(true);
  });

  it('uses refresh-session expiry instead of access-cookie expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T00:00:00Z'));

    const store = new SessionStore();
    store.save({
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });

    vi.advanceTimersByTime(31_000);
    expect(store.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(3_570_000);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('rewrites stored data to the canonical metadata shape', () => {
    localStorage.setItem('jobtrackr-cloud-session-v1', JSON.stringify({
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      sessionExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'},
      obsoleteField: 'remove-me'
    }));

    const store = new SessionStore();
    const stored = JSON.parse(localStorage.getItem('jobtrackr-cloud-session-v1') ?? '{}');

    expect(store.isAuthenticated()).toBe(true);
    expect(stored.obsoleteField).toBeUndefined();
  });

  it('drops expired sessions during restore', () => {
    localStorage.setItem('jobtrackr-cloud-session-v1', JSON.stringify({
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    }));

    const store = new SessionStore();
    expect(store.current).toBeNull();
    expect(localStorage.getItem('jobtrackr-cloud-session-v1')).toBeNull();
  });
});
