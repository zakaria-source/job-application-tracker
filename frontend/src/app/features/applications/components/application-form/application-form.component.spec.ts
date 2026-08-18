import {FormBuilder} from '@angular/forms';
import {describe, expect, it} from 'vitest';
import {NotificationService} from '@app/core/notifications/notification.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {ApplicationFormDraft} from '@app/features/applications/models/application-draft.model';
import {JobApplication} from '@app/features/applications/models/application.model';
import {ApplicationFormComponent} from './application-form.component';

describe('ApplicationFormComponent composer behavior', () => {
  function createComponent(): ApplicationFormComponent {
    const component = new ApplicationFormComponent(
      new FormBuilder(),
      new NotificationService(),
      new ApplicationWorkflowService()
    );
    component.ngOnInit();
    return component;
  }

  function importedDraft(): JobApplication {
    return {
      id: 'imported',
      company: 'Acme',
      position: 'Backend Engineer',
      applicationDate: new Date('2026-08-19T00:00:00Z'),
      status: 'Envoyé',
      notes: 'Description importée',
      lastUpdated: new Date('2026-08-19T00:00:00Z'),
      offerUrl: 'https://jobs.example.com/42',
      contractType: 'CDI',
      salaryPeriod: 'Annuel',
      stage: 'Candidature',
      priority: 'Moyenne',
      interviews: []
    };
  }

  it('fills empty fields from an imported offer and marks the composer dirty', () => {
    const component = createComponent();

    component.applyImportedDraft(importedDraft());

    expect(component.companyValue).toBe('Acme');
    expect(component.positionValue).toBe('Backend Engineer');
    expect(component.jobForm.get('offerUrl')?.value).toBe('https://jobs.example.com/42');
    expect(component.jobForm.get('notes')?.value).toContain('Description importée');
    expect(component.isDirty).toBe(true);
  });

  it('preserves values already entered manually when import enriches the draft', () => {
    const component = createComponent();
    component.jobForm.patchValue({company: 'Manual Co', position: 'Platform Engineer', notes: 'Mes notes'});

    component.applyImportedDraft(importedDraft());

    expect(component.companyValue).toBe('Manual Co');
    expect(component.positionValue).toBe('Platform Engineer');
    expect(component.jobForm.get('notes')?.value).toBe('Mes notes');
    expect(component.jobForm.get('offerUrl')?.value).toBe('https://jobs.example.com/42');
  });

  it('keeps a manually typed source URL even without running automatic analysis', () => {
    const component = createComponent();

    component.setOfferUrl('https://careers.example.com/jobs/java');

    expect(component.jobForm.get('offerUrl')?.value).toBe('https://careers.example.com/jobs/java');
    expect(component.isDirty).toBe(true);
  });

  it('exports and restores dates, contact data and interviews without losing types', () => {
    const source = createComponent();
    source.jobForm.patchValue({
      company: 'Mirakl',
      position: 'Software Engineer',
      applicationDate: new Date('2026-08-19T08:00:00Z'),
      followUpDate: new Date('2026-08-26T08:00:00Z'),
      recruiterName: 'Recruiter',
      notes: 'Préparer Kafka'
    });
    source.addInterview();
    source.interviews.at(0).patchValue({date: new Date('2026-08-25T12:00:00Z'), type: 'Visioconférence'});

    const draft: ApplicationFormDraft = source.exportDraft();
    const restored = createComponent();
    restored.restoreDraft(draft);

    expect(restored.companyValue).toBe('Mirakl');
    expect(restored.jobForm.get('applicationDate')?.value).toBeInstanceOf(Date);
    expect(restored.followUpDateValue).toBeInstanceOf(Date);
    expect(restored.jobForm.get('recruiterName')?.value).toBe('Recruiter');
    expect(restored.interviews.at(0).get('date')?.value).toBeInstanceOf(Date);
    expect(restored.interviews.at(0).get('type')?.value).toBe('Visioconférence');
    expect(restored.isDirty).toBe(true);
  });
});
