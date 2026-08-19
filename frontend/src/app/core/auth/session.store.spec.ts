import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {SessionStore} from '@app/core/auth/session.store';

describe('SessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('persists only non-sensitive session metadata in localStorage', () => {
    const store = new SessionStore();
    store.save({
      accessToken: 'legacy-rollout-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });

    const stored = JSON.parse(localStorage.getItem('jobtrackr-cloud-session-v1') ?? '{}');
    expect(stored.accessToken).toBeUndefined();
    expect(store.accessToken).toBe('legacy-rollout-token');
    expect(sessionStorage.getItem('jobtrackr-legacy-access-token-v1')).toBe('legacy-rollout-token');
    expect(store.isAuthenticated()).toBe(true);
    expect(new SessionStore().current?.user.email).toBe('alex@example.com');
  });

  it('does not retain a fallback bearer token for cookie-based sessions', () => {
    sessionStorage.setItem('jobtrackr-legacy-access-token-v1', 'stale-token');
    const store = new SessionStore();
    store.save({
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });

    expect(store.accessToken).toBeNull();
    expect(sessionStorage.getItem('jobtrackr-legacy-access-token-v1')).toBeNull();
  });

  it('migrates legacy storage by stripping a persisted access token', () => {
    localStorage.setItem('jobtrackr-cloud-session-v1', JSON.stringify({
      accessToken: 'legacy-sensitive-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    }));

    const store = new SessionStore();
    const stored = JSON.parse(localStorage.getItem('jobtrackr-cloud-session-v1') ?? '{}');

    expect(store.isAuthenticated()).toBe(true);
    expect(stored.accessToken).toBeUndefined();
    expect(store.accessToken).toBeNull();
  });

  it('invalidates a session that expires while the app remains open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T00:00:00Z'));

    const store = new SessionStore();
    store.save({
      accessToken: 'temporary-token',
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });

    expect(store.isAuthenticated()).toBe(true);
    vi.advanceTimersByTime(31_000);
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('jobtrackr-cloud-session-v1')).toBeNull();
    expect(sessionStorage.getItem('jobtrackr-legacy-access-token-v1')).toBeNull();
  });

  it('drops expired sessions during restore', () => {
    localStorage.setItem('jobtrackr-cloud-session-v1', JSON.stringify({
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    }));
    sessionStorage.setItem('jobtrackr-legacy-access-token-v1', 'stale-token');

    const store = new SessionStore();
    expect(store.current).toBeNull();
    expect(localStorage.getItem('jobtrackr-cloud-session-v1')).toBeNull();
    expect(sessionStorage.getItem('jobtrackr-legacy-access-token-v1')).toBeNull();
  });
});
