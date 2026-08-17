export interface CurrentCareerProfile {
  name: string;
  title: string;
  experienceLabel: string;
  mobility: string;
  summary: string;
  coreSkills: readonly string[];
  certifications: readonly string[];
  education: string;
  targetCompensation: string;
}

export const CURRENT_CAREER_PROFILE: CurrentCareerProfile = {
  name: 'Zakaria Dbaba',
  title: 'Ingénieur Backend Java / Cloud-Native',
  experienceLabel: '4 ans d’expérience',
  mobility: 'France · mobilité Paris / Luxembourg',
  summary:
    'Spécialisé dans les microservices et architectures événementielles avec Java 17/21, Spring Boot 3, Kafka et Kubernetes, avec une forte culture qualité, TDD, Clean Architecture et DevOps.',
  coreSkills: [
    'Java 17/21',
    'Spring Boot 3',
    'Kafka',
    'PostgreSQL',
    'Kubernetes',
    'Terraform',
    'AWS',
    'Testcontainers'
  ],
  certifications: [
    'CKA',
    'AWS Developer – Associate',
    'Terraform Associate'
  ],
  education: 'ENSEEIHT · Diplôme d’ingénieur Informatique & Télécommunications',
  targetCompensation: 'Cible CDI : 65 k€ · Freelance : 550 €/j'
};
