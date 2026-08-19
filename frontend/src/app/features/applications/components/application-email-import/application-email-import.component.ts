import {A11yModule} from '@angular/cdk/a11y';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {
  EmailAnalysis,
  EmailAnalysisInput,
  EmailApplyResponse
} from '@app/features/applications/models/application-email.model';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';

@Component({
  selector: 'app-application-email-import',
  standalone: true,
  imports: [A11yModule, FormsModule, MatButtonModule, MatIconModule],
  templateUrl: './application-email-import.component.html',
  styleUrl: './application-email-import.component.css'
})
export class ApplicationEmailImportComponent {
  @Input({required: true}) applications: readonly JobApplication[] = [];
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly applied = new EventEmitter<EmailApplyResponse>();

  readonly stageOptions: readonly RecruitmentStage[] = [
    'Candidature',
    'Screening RH',
    'Entretien technique',
    'Hiring Manager',
    'Entretien final',
    'Offre',
    'Clôturé'
  ];

  input: EmailAnalysisInput = {subject: '', sender: '', body: ''};
  analysis: EmailAnalysis | null = null;
  selectedApplicationId = '';
  selectedStage: RecruitmentStage | '' = '';
  analyzing = false;
  applying = false;
  error = '';

  constructor(private readonly api: JobTrackrApiService) {}

  get canAnalyze(): boolean {
    return this.input.subject.trim().length > 0 && this.input.body.trim().length > 0 && !this.analyzing;
  }

  get canApply(): boolean {
    return Boolean(this.analysis && this.selectedApplicationId && !this.applying);
  }

  analyze(): void {
    if (!this.canAnalyze) return;
    this.error = '';
    this.analyzing = true;
    this.api.analyzeRecruitmentEmail({
      subject: this.input.subject.trim(),
      sender: this.input.sender.trim(),
      body: this.input.body.trim()
    }).subscribe({
      next: analysis => {
        this.analysis = analysis;
        this.selectedApplicationId = analysis.matches[0]?.applicationId ?? this.applications[0]?.id ?? '';
        this.selectedStage = analysis.suggestedStage ?? '';
        this.analyzing = false;
      },
      error: () => {
        this.error = 'Analyse impossible pour le moment. Vérifiez le contenu du mail et réessayez.';
        this.analyzing = false;
      }
    });
  }

  apply(): void {
    if (!this.analysis || !this.selectedApplicationId || this.applying) return;
    this.error = '';
    this.applying = true;
    this.api.applyRecruitmentEmail({
      applicationId: this.selectedApplicationId,
      stage: this.selectedStage || null,
      signalType: this.analysis.signalType,
      subject: this.input.subject.trim()
    }).subscribe({
      next: response => {
        this.applying = false;
        this.applied.emit(response);
      },
      error: () => {
        this.error = 'Impossible d’appliquer ce suivi. Aucune modification n’a été confirmée.';
        this.applying = false;
      }
    });
  }

  resetAnalysis(): void {
    this.analysis = null;
    this.selectedApplicationId = '';
    this.selectedStage = '';
    this.error = '';
  }

  applicationOptionLabel(application: JobApplication): string {
    const score = this.matchScore(application.id);
    return `${application.company} — ${application.position}${score === null ? '' : ` · ${score}% match`}`;
  }

  matchScore(applicationId: string): number | null {
    return this.analysis?.matches.find(match => match.applicationId === applicationId)?.score ?? null;
  }

  matchReasons(applicationId: string): readonly string[] {
    return this.analysis?.matches.find(match => match.applicationId === applicationId)?.reasons ?? [];
  }
}
