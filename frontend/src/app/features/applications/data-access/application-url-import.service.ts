import {Injectable} from '@angular/core';
import {JobApplication} from '@app/features/applications/models/application.model';
import {JobImportPreview} from '@app/features/applications/models/job-import.model';

@Injectable({providedIn: 'root'})
export class ApplicationUrlImportService {

  buildDraft(preview: JobImportPreview, now = new Date()): JobApplication {
    const context = [
      preview.location ? `Localisation : ${preview.location}` : '',
      preview.salary ? `Rémunération annoncée : ${preview.salary}` : '',
      preview.datePosted ? `Offre publiée le : ${preview.datePosted}` : '',
      preview.description
    ].filter(Boolean).join('\n\n');

    return {
      id: globalThis.crypto?.randomUUID?.() ?? `${now.getTime().toString(36)}${Math.random().toString(36).slice(2)}`,
      company: preview.company,
      position: preview.position,
      applicationDate: now,
      status: 'Envoyé',
      notes: context,
      lastUpdated: now,
      offerUrl: preview.canonicalUrl || preview.sourceUrl,
      contractType: preview.contractType,
      salaryPeriod: 'Annuel',
      stage: 'Candidature',
      priority: 'Moyenne',
      interviews: []
    };
  }
}
