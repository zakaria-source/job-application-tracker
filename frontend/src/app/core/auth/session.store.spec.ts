import {beforeEach, describe, expect, it} from 'vitest';
import {SessionStore} from '@app/core/auth/session.store';

describe('SessionStore', () => {
  beforeEach(() => localStorage.clear());

  it('persists a valid authenticated session', () => {
    const store = new SessionStore();
    store.save({
      accessToken: 'token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });

    expect(store.isAuthenticated()).toBe(true);
    expect(new SessionStore().current?.user.email).toBe('alex@example.com');
  });

  it('drops expired sessions during restore', () => {
    localStorage.setItem('jobtrackr-cloud-session-v1', JSON.stringify({
      accessToken: 'expired',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    }));

    const store = new SessionStore();
    expect(store.current).toBeNull();
    expect(localStorage.getItem('jobtrackr-cloud-session-v1')).toBeNull();
  });
});
