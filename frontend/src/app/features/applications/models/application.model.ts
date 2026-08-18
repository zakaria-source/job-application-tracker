export type ApplicationStatus = 'Envoyé' | 'Entretien' | 'Accepté' | 'Refusé';
export type ContractType = 'CDI' | 'CDD' | 'Freelance' | 'Stage' | 'Alternance' | 'Autre';
export type ApplicationPriority = 'Haute' | 'Moyenne' | 'Basse';
export type SalaryPeriod = 'Annuel' | 'Journalier';
export type RecruitmentStage =
  | 'Candidature'
  | 'Screening RH'
  | 'Entretien technique'
  | 'Hiring Manager'
  | 'Entretien final'
  | 'Offre'
  | 'Clôturé';

export interface JobApplication {
  id: string;
  version?: number;
  company: string;
  position: string;
  applicationDate: Date;
  status: ApplicationStatus;
  notes: string;
  lastUpdated: Date;
  responseDate?: Date;

  offerUrl?: string;
  contractType: ContractType;
  salaryTarget?: number;
  salaryPeriod: SalaryPeriod;
  followUpDate?: Date;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterPhone?: string;
  stage: RecruitmentStage;
  priority: ApplicationPriority;

  interviews?: Interview[];

  /** @deprecated Legacy fields kept for importing older JobTrackr backups. */
  contactPerson?: string;
  /** @deprecated Legacy fields kept for importing older JobTrackr backups. */
  contactEmail?: string;
  /** @deprecated Legacy fields kept for importing older JobTrackr backups. */
  contactPhone?: string;
}

export interface Interview {
  id: string;
  date: Date;
  type: 'Téléphone' | 'Visioconférence' | 'En personne';
  notes: string;
  reminderSet: boolean;
}
