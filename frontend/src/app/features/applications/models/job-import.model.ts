import {ContractType} from './application.model';

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
  extractionSource: 'JSON_LD' | 'HTML';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}
