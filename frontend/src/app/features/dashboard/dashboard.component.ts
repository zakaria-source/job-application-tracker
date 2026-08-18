import {CommonModule} from '@angular/common';
import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {combineLatest, timer} from 'rxjs';
import {WorkspaceService, WorkspaceState} from '@app/core/workspace/workspace.service';
import {ApplicationStore} from '@app/features/applications/data-access/application.store';
import {JobStatistics} from '@app/features/applications/models/application-analytics.model';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';

interface UpcomingInterview {
  id: string;
  date: Date;
  type: string;
  company: string;
  position: string;
  applicationId: string;
}

type FollowUpState = 'overdue' | 'today' | 'upcoming';

interface FollowUpItem {
  application: JobApplication;
  date: Date;
  state: FollowUpState;
}

interface NextAction {
  id: string;
  applicationId: string;
  company: string;
  position: string;
  label: string;
  detail: string;
  kind: 'follow-up' | 'interview' | 'stale';
  due?: Date;
}

interface StageSummary {
  stage: RecruitmentStage;
  shortLabel: string;
  count: number;
}

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', {day: '2-digit', month: 'short'});
const INTERVIEW_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeStages: readonly {stage: RecruitmentStage; label: string}[] = [
    {stage: 'Candidature', label: 'Candidature'},
    {stage: 'Screening RH', label: 'Screening'},
    {stage: 'Entretien technique', label: 'Technique'},
    {stage: 'Hiring Manager', label: 'Manager'},
    {stage: 'Entretien final', label: 'Final'},
    {stage: 'Offre', label: 'Offre'}
  ];

  applications: JobApplication[] = [];
  activeApplications = 0;
  workspaceState: WorkspaceState;
  statistics: JobStatistics = {
    totalApplications: 0,
    responseRate: 0,
    averageResponseTime: 0,
    statusCounts: {sent: 0, interview: 0, accepted: 0, rejected: 0},
    applicationsByWeek: [],
    mostResponsiveCompanies: []
  };
  followUps: FollowUpItem[] = [];
  overdueFollowUps: FollowUpItem[] = [];
  todayFollowUps: FollowUpItem[] = [];
  upcomingFollowUps: FollowUpItem[] = [];
  upcomingInterviews: UpcomingInterview[] = [];
  staleApplications: JobApplication[] = [];
  nextActions: NextAction[] = [];
  stageSummary: StageSummary[] = [];
  interviewRate = 0;

  constructor(
    private readonly applicationStore: ApplicationStore,
    private readonly workspace: WorkspaceService
  ) {
    this.workspaceState = workspace.state;
    workspace.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => this.workspaceState = state);
  }

  ngOnInit(): void {
    combineLatest([
      this.applicationStore.getApplications(),
      timer(0, 60_000)
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([applications]) => this.refreshDashboard(applications));
  }

  retryWorkspace(): void {
    this.workspace.connect().subscribe({error: () => undefined});
  }

  completeFollowUp(applicationId: string): void {
    this.applicationStore.completeFollowUp(applicationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({error: () => undefined});
  }

  stageShare(count: number): number {
    return this.activeApplications > 0 ? Math.round((count / this.activeApplications) * 100) : 0;
  }

  private refreshDashboard(applications: JobApplication[]): void {
    const now = new Date();
    this.applications = [...applications].sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

    const stageCounts = new Map<RecruitmentStage, number>();
    let activeApplications = 0;
    for (const application of applications) {
      if (application.status !== 'Accepté' && application.status !== 'Refusé') {
        activeApplications++;
      }
      stageCounts.set(application.stage, (stageCounts.get(application.stage) ?? 0) + 1);
    }
    this.activeApplications = activeApplications;

    this.statistics = this.applicationStore.calculateStatistics();
    this.interviewRate = this.statistics.totalApplications > 0
      ? Math.round((this.statistics.statusCounts.interview / this.statistics.totalApplications) * 100)
      : 0;

    this.followUps = this.getFollowUps(applications, now);
    this.overdueFollowUps = this.followUps.filter(item => item.state === 'overdue');
    this.todayFollowUps = this.followUps.filter(item => item.state === 'today');
    this.upcomingFollowUps = this.followUps.filter(item => item.state === 'upcoming').slice(0, 5);
    this.upcomingInterviews = this.getUpcomingInterviews(applications, now).slice(0, 5);
    this.staleApplications = this.getStaleApplications(applications, now).slice(0, 5);
    this.nextActions = this.buildNextActions().slice(0, 6);
    this.stageSummary = this.activeStages.map(({stage, label}) => ({
      stage,
      shortLabel: label,
      count: stageCounts.get(stage) ?? 0
    }));
  }

  private getFollowUps(applications: JobApplication[], now: Date): FollowUpItem[] {
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    const horizon = new Date(startToday);
    horizon.setDate(horizon.getDate() + 14);

    return applications
      .filter(application => application.followUpDate && application.status !== 'Accepté' && application.status !== 'Refusé')
      .map(application => {
        const date = new Date(application.followUpDate!);
        const state: FollowUpState = date < startToday
          ? 'overdue'
          : date < startTomorrow
            ? 'today'
            : 'upcoming';
        return {application, date, state};
      })
      .filter(item => item.state !== 'upcoming' || item.date <= horizon)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private getUpcomingInterviews(applications: JobApplication[], now: Date): UpcomingInterview[] {
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    return applications
      .flatMap(app =>
        (app.interviews ?? [])
          .filter(interview => interview.date >= now && interview.date <= twoWeeksLater)
          .map(interview => ({
            id: interview.id,
            date: new Date(interview.date.getTime()),
            type: interview.type,
            company: app.company,
            position: app.position,
            applicationId: app.id
          }))
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private getStaleApplications(applications: JobApplication[], now: Date): JobApplication[] {
    const staleBefore = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    return applications
      .filter(application =>
        application.status !== 'Accepté'
        && application.status !== 'Refusé'
        && !application.followUpDate
        && application.lastUpdated < staleBefore
      )
      .sort((a, b) => a.lastUpdated.getTime() - b.lastUpdated.getTime());
  }

  private buildNextActions(): NextAction[] {
    const actions: NextAction[] = [];

    for (const item of [...this.overdueFollowUps, ...this.todayFollowUps]) {
      actions.push({
        id: `follow-up-${item.application.id}`,
        applicationId: item.application.id,
        company: item.application.company,
        position: item.application.position,
        label: item.state === 'overdue' ? 'Relance en retard' : 'Relancer aujourd’hui',
        detail: item.state === 'overdue'
          ? `Prévue le ${SHORT_DATE.format(item.date)}`
          : 'Action prévue pour aujourd’hui',
        kind: 'follow-up',
        due: item.date
      });
    }

    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const interview of this.upcomingInterviews.filter(item => item.date.getTime() - now <= threeDays)) {
      actions.push({
        id: `interview-${interview.id}`,
        applicationId: interview.applicationId,
        company: interview.company,
        position: interview.position,
        label: 'Préparer l’entretien',
        detail: `${INTERVIEW_DATE.format(interview.date)} · ${interview.type}`,
        kind: 'interview',
        due: interview.date
      });
    }

    for (const application of this.staleApplications) {
      actions.push({
        id: `stale-${application.id}`,
        applicationId: application.id,
        company: application.company,
        position: application.position,
        label: 'Mettre à jour la candidature',
        detail: 'Aucune activité récente ni relance planifiée',
        kind: 'stale'
      });
    }

    const priority = {'follow-up': 0, interview: 1, stale: 2} as const;
    return actions.sort((a, b) =>
      priority[a.kind] - priority[b.kind]
      || (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity)
    );
  }
}
