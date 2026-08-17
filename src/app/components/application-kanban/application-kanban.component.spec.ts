import {CdkDragDrop} from '@angular/cdk/drag-drop';
import {describe, expect, it, vi} from 'vitest';
import {JobApplication} from '../../models/job-application.model';
import {ApplicationKanbanComponent} from './application-kanban.component';

const application: JobApplication = {
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
    priority: 'Haute'
};

describe('ApplicationKanbanComponent', () => {
    it('groups applications by recruitment stage', () => {
        const component = new ApplicationKanbanComponent();
        component.applications = [application];

        const candidature = component.columns.find(column => column.stage === 'Candidature');
        const screening = component.columns.find(column => column.stage === 'Screening RH');

        expect(candidature?.applications).toEqual([application]);
        expect(screening?.applications).toEqual([]);
    });

    it('emits a stage change when a card moves to another column', () => {
        const component = new ApplicationKanbanComponent();
        const emit = vi.spyOn(component.stageChange, 'emit');
        const event = {
            item: {data: application},
            container: {data: {stage: 'Screening RH', applications: []}}
        } as unknown as CdkDragDrop<{stage: JobApplication['stage']; applications: JobApplication[]}>;

        component.drop(event);

        expect(emit).toHaveBeenCalledWith({applicationId: '1', stage: 'Screening RH'});
    });

    it('does not emit when a card stays in the same stage', () => {
        const component = new ApplicationKanbanComponent();
        const emit = vi.spyOn(component.stageChange, 'emit');
        const event = {
            item: {data: application},
            container: {data: {stage: 'Candidature', applications: [application]}}
        } as unknown as CdkDragDrop<{stage: JobApplication['stage']; applications: JobApplication[]}>;

        component.drop(event);

        expect(emit).not.toHaveBeenCalled();
    });
});
