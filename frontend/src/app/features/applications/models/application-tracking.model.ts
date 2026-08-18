export type FollowUpStatus = 'PLANNED' | 'DUE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';
export type ApplicationHealthLevel = 'HEALTHY' | 'WATCH' | 'AT_RISK';

export interface ApplicationEvent {
  id: string;
  type: string;
  title: string;
  details: string;
  createdAt: Date;
}

export interface FollowUp {
  id: string;
  scheduledFor: Date;
  status: FollowUpStatus;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewDebrief {
  id: string;
  interviewId: string;
  sentiment: string;
  questions: string;
  strengths: string;
  improvements: string;
  nextAction: string;
  updatedAt: Date;
}

export interface InterviewDebriefInput {
  sentiment: string;
  questions: string;
  strengths: string;
  improvements: string;
  nextAction: string;
}

export interface ApplicationHealth {
  score: number;
  level: ApplicationHealthLevel;
  strengths: string[];
  risks: string[];
}
