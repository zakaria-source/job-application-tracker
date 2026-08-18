import {ContractType} from './application.model';

export type JobImportExtractionSource =
  | 'GREENHOUSE_API'
  | 'LEVER_API'
  | 'WORKDAY'
  | 'WELCOME_TO_THE_JUNGLE'
  | 'JSON_LD'
  | 'HTML';

export interface JobImportPreview {
  sourceUrl: string;
  canonicalUrl: string;
  company: string;
  position: string;
  location: string;
  description: string;
  contractType: ContractType;
  employmentType: string;
  salary: string;
  datePosted?: string | null;
  extractionSource: JobImportExtractionSource;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}
