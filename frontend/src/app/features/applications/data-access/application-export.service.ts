import {Injectable} from '@angular/core';
import {JobApplication} from '@app/features/applications/models/application.model';

interface ExportEnvelope {
  version: number;
  exportedAt: string;
  applications: readonly JobApplication[];
}

@Injectable({providedIn: 'root'})
export class ApplicationExportService {
  serialize(applications: readonly JobApplication[]): string {
    const envelope: ExportEnvelope = {
      version: 2,
      exportedAt: new Date().toISOString(),
      applications
    };

    return JSON.stringify(envelope, null, 2);
  }
}
