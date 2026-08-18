import {beforeEach, describe, expect, it} from 'vitest';
import {of} from 'rxjs';
import {CloudApiService} from '../cloud/cloud-api.service';
import {UserProfile} from '../models/user-profile.model';
import {UserProfileService} from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let savedProfile: UserProfile | null;

  beforeEach(() => {
    savedProfile = null;
    const api = {
      updateProfile: (profile: UserProfile) => {
        savedProfile = profile;
        return of(profile);
      }
    } as unknown as CloudApiService;

    service = new UserProfileService(api);
  });

  it('normalizes and persists a profile through the backend', () => {
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
    expect(savedProfile).toEqual(service.getProfile());
  });

  it('hydrates the profile received from the backend', () => {
    service.connect({
      name: ' Alex ',
      headline: ' Engineer ',
      experienceLabel: '',
      location: '',
      summary: '',
      coreSkills: [' Java '],
      certifications: [],
      education: '',
      targetCompensation: ''
    });

    expect(service.getProfile()?.name).toBe('Alex');
    expect(service.getProfile()?.coreSkills).toEqual(['Java']);
  });

  it('clears only in-memory profile state on logout', () => {
    service.connect({
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

    service.clear();

    expect(service.getProfile()).toBeNull();
  });
});
