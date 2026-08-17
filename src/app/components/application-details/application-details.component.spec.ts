import {describe, expect, it} from 'vitest';
import {JobApplication} from '../../models/job-application.model';
import {ApplicationDetailsComponent} from './application-details.component';

const baseApplication: JobApplication = {
    id: '1',
    company: 'Acme',
    position: 'Backend Engineer',
    applicationDate: new Date('2026-08-17'),
    status: 'Envoyé',
    notes: '',
    lastUpdated: new Date('2026-08-17'),
    contractType: 'CDI',
    salaryPeriod: 'Annuel',
    stage: 'Candidature',
    priority: 'Moyenne'
};

describe('ApplicationDetailsComponent', () => {
    it('formats annual salary and freelance daily rate', () => {
        const component = new ApplicationDetailsComponent();
        component.application = {...baseApplication, salaryTarget: 65000};
        expect(component.formatTargetSalary()).toContain('65');
        expect(component.formatTargetSalary()).toContain('brut/an');

        component.application = {
            ...baseApplication,
            contractType: 'Freelance',
            salaryPeriod: 'Journalier',
            salaryTarget: 550
        };
        expect(component.formatTargetSalary()).toContain('550');
        expect(component.formatTargetSalary()).toContain('€/j');
    });
});
