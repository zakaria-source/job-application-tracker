import {describe, expect, it} from 'vitest';
import {JobApplication} from '../../models/job-application.model';
import {ApplicationListComponent} from './application-list.component';

const application = (id: string, company: string, followUpDate?: Date): JobApplication => ({
    id,
    company,
    position: 'Backend Engineer',
    applicationDate: new Date('2026-08-17'),
    status: 'Envoyé',
    notes: '',
    lastUpdated: new Date('2026-08-17'),
    contractType: 'CDI',
    salaryPeriod: 'Annuel',
    stage: 'Candidature',
    priority: 'Moyenne',
    followUpDate
});

describe('ApplicationListComponent', () => {
    it('owns sorting and pagination for the displayed applications', () => {
        const component = new ApplicationListComponent();
        component.applications = [
            application('2', 'Beta', new Date('2026-08-22')),
            application('1', 'Acme', new Date('2026-08-20'))
        ];

        component.ngOnChanges();
        expect(component.paginatedApplications.map(item => item.id)).toEqual(['1', '2']);

        component.sortData({active: 'company', direction: 'desc'});
        expect(component.paginatedApplications.map(item => item.company)).toEqual(['Beta', 'Acme']);
    });

    it('emits the selected application instead of mutating it', () => {
        const component = new ApplicationListComponent();
        const selected = application('1', 'Acme');
        let emitted: JobApplication | undefined;
        component.viewApplication.subscribe(value => emitted = value);

        component.openDetails(selected);

        expect(emitted).toBe(selected);
    });
});
