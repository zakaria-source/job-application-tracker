export interface UserProfile {
  name: string;
  headline: string;
  experienceLabel: string;
  location: string;
  summary: string;
  coreSkills: string[];
  certifications: string[];
  education: string;
  targetCompensation: string;
}

export const EMPTY_USER_PROFILE: UserProfile = {
  name: '',
  headline: '',
  experienceLabel: '',
  location: '',
  summary: '',
  coreSkills: [],
  certifications: [],
  education: '',
  targetCompensation: ''
};
