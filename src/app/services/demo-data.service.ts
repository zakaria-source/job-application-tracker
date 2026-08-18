import {Injectable} from '@angular/core';
import {JobApplication} from '../models/job-application.model';
import {StorageService} from './storage.service';

@Injectable({providedIn: 'root'})
export class DemoDataService {
  constructor(private readonly storageService: StorageService) {}

  load(): number {
    return this.storageService.mergeApplications(this.buildDemoApplications());
  }

  private buildDemoApplications(now = new Date()): JobApplication[] {
    const atOffset = (days: number, hour = 12): Date => {
      const value = new Date(now);
      value.setHours(hour, 0, 0, 0);
      value.setDate(value.getDate() + days);
      return value;
    };

    return [
      {
        id: 'demo-acme-cloud-backend',
        company: 'Acme Cloud',
        position: 'Backend Engineer',
        applicationDate: atOffset(-10),
        status: 'Entretien',
        stage: 'Screening RH',
        priority: 'Haute',
        contractType: 'CDI',
        salaryTarget: 65000,
        salaryPeriod: 'Annuel',
        responseDate: atOffset(-7),
        followUpDate: atOffset(1),
        recruiterName: 'Camille Martin',
        notes: 'Donnée de démonstration : premier échange RH positif, préparer les exemples de projets et les attentes salariales.',
        lastUpdated: atOffset(-1),
        interviews: [
          {
            id: 'demo-acme-interview',
            date: atOffset(3, 10),
            type: 'Visioconférence',
            notes: 'Entretien de démonstration.',
            reminderSet: false
          }
        ]
      },
      {
        id: 'demo-nova-payments-software',
        company: 'Nova Payments',
        position: 'Software Engineer',
        applicationDate: atOffset(-5),
        status: 'Envoyé',
        stage: 'Candidature',
        priority: 'Moyenne',
        contractType: 'CDI',
        salaryTarget: 60000,
        salaryPeriod: 'Annuel',
        followUpDate: atOffset(2),
        notes: 'Donnée de démonstration : candidature envoyée, relance planifiée.',
        lastUpdated: atOffset(-5),
        interviews: []
      },
      {
        id: 'demo-greentech-platform',
        company: 'GreenTech Labs',
        position: 'Platform Engineer',
        applicationDate: atOffset(-20),
        status: 'Refusé',
        stage: 'Clôturé',
        priority: 'Basse',
        contractType: 'CDI',
        salaryPeriod: 'Annuel',
        responseDate: atOffset(-14),
        notes: 'Donnée de démonstration : candidature clôturée pour illustrer les statistiques de réponse.',
        lastUpdated: atOffset(-14),
        interviews: []
      }
    ];
  }
}
