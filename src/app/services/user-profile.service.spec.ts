import {beforeEach, describe, expect, it} from 'vitest';
import {UserProfileService} from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    localStorage.clear();
    service = new UserProfileService();
  });

  it('persists and normalizes a user profile', () => {
    service.saveProfile({
      name: '  Alex Martin  ',
      headline: ' Backend Engineer ',
      experienceLabel: ' 4 ans ',
      location: ' Paris ',
      summary: ' Recherche backend ',
      coreSkills: [' Java ', 'Kafka', 'Java'],
      certifications: [' CKA ', ''],
      education: ' Master Informatique ',
      targetCompensation: ' 65 k€ / an '
    });

    expect(service.hasProfile()).toBe(true);
    expect(service.getProfile()).toEqual({
      name: 'Alex Martin',
      headline: 'Backend Engineer',
      experienceLabel: '4 ans',
      location: 'Paris',
      summary: 'Recherche backend',
      coreSkills: ['Java', 'Kafka'],
      certifications: ['CKA'],
      education: 'Master Informatique',
      targetCompensation: '65 k€ / an'
    });
  });

  it('ignores corrupted or incomplete persisted profiles', () => {
    localStorage.setItem('jobtrackr-user-profile-v1', '{invalid-json');
    expect(service.getProfile()).toBeNull();

    localStorage.setItem('jobtrackr-user-profile-v1', JSON.stringify({name: 'Alex'}));
    expect(service.getProfile()).toBeNull();
  });

  it('can clear the local profile without touching application data', () => {
    localStorage.setItem('jobtrackr-applications', 'keep-me');
    service.saveProfile({
      name: 'Alex',
      headline: 'Engineer',
      experienceLabel: '',
      location: '',
      summary: '',
      coreSkills: [],
      certifications: [],
      education: '',
      targetCompensation: ''
    });

    service.clearProfile();

    expect(service.getProfile()).toBeNull();
    expect(localStorage.getItem('jobtrackr-applications')).toBe('keep-me');
  });
});
