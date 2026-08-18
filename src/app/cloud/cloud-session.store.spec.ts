import {beforeEach, describe, expect, it} from 'vitest';
import {CloudSessionStore} from './cloud-session.store';

describe('CloudSessionStore', () => {
  beforeEach(() => localStorage.clear());

  it('persists a valid authenticated session', () => {
    const store = new CloudSessionStore();
    store.save({
      accessToken: 'token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    });

    expect(store.isAuthenticated()).toBe(true);
    expect(new CloudSessionStore().current?.user.email).toBe('alex@example.com');
  });

  it('drops expired sessions during restore', () => {
    localStorage.setItem('jobtrackr-cloud-session-v1', JSON.stringify({
      accessToken: 'expired',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: {id: 'user-1', email: 'alex@example.com', displayName: 'Alex'}
    }));

    const store = new CloudSessionStore();
    expect(store.current).toBeNull();
    expect(localStorage.getItem('jobtrackr-cloud-session-v1')).toBeNull();
  });
});
