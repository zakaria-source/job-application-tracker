import {RecruitmentStage} from './application.model';

export interface EmailAnalysisInput {
  subject: string;
  sender: string;
  body: string;
}

export interface EmailApplicationMatch {
  applicationId: string;
  company: string;
  position: string;
  currentStage: RecruitmentStage;
  score: number;
  reasons: string[];
}

export interface EmailAnalysis {
  signalType: string;
  suggestedStage?: RecruitmentStage | null;
  signalConfidence: number;
  summary: string;
  evidence: string[];
  matches: EmailApplicationMatch[];
}

export interface EmailApplyInput {
  applicationId: string;
  stage: RecruitmentStage | null;
  signalType: string;
  subject: string;
}

export interface EmailApplyResponse {
  applicationId: string;
  stage: RecruitmentStage;
  message: string;
}
