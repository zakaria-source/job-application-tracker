import {
  ApplicationPriority,
  ContractType,
  Interview,
  RecruitmentStage,
  SalaryPeriod
} from './application.model';

export interface InterviewDraft {
  id: string;
  date: string;
  type: Interview['type'];
  notes: string;
  reminderSet: boolean;
}

export interface ApplicationFormDraft {
  company: string;
  position: string;
  offerUrl: string;
  contractType: ContractType;
  salaryTarget: number | null;
  salaryPeriod: SalaryPeriod;
  applicationDate: string;
  stage: RecruitmentStage;
  priority: ApplicationPriority;
  followUpDate: string | null;
  recruiterName: string;
  recruiterEmail: string;
  recruiterPhone: string;
  notes: string;
  interviews: InterviewDraft[];
}

export interface ApplicationStudioDraft {
  version: 1;
  updatedAt: string;
  jobUrl: string;
  form: ApplicationFormDraft;
}
