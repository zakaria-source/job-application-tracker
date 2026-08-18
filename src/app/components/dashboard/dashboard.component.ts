import {CommonModule} from '@angular/common';
import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {combineLatest, timer} from 'rxjs';
import {CloudWorkspaceService, CloudWorkspaceState} from '../../cloud/cloud-workspace.service';
import {JobApplication, JobStatistics, Suggestion} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';

interface UpcomingInterview {
  id: string;
  date: Date;
  type: string;
  company: string;
  position: string;
  applicationId: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  applications: JobApplication[] = [];
  activeApplications = 0;
  workspaceState: CloudWorkspaceState;
  statistics: JobStatistics = {
    totalApplications: 0,
    responseRate: 0,
    averageResponseTime: 0,
    statusCounts: {sent: 0, interview: 0, accepted: 0, rejected: 0},
    applicationsByWeek: [],
    mostResponsiveCompanies: []
  };
  followUpActions: Suggestion[] = [];
  upcomingInterviews: UpcomingInterview[] = [];

  constructor(
    private readonly storageService: StorageService,
    private readonly workspace: CloudWorkspaceService
  ) {
    this.workspaceState = workspace.state;
    workspace.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => this.workspaceState = state);
  }

  ngOnInit(): void {
    combineLatest([
      this.storageService.getApplications(),
      timer(0, 60_000)
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([applications]) => this.refreshDashboard(applications));
  }

  retryWorkspace(): void {
    this.workspace.connect().subscribe({error: () => undefined});
  }

  getApplicationLabel(applicationId?: string): string {
    const app = this.applications.find(application => application.id === applicationId);
    return app ? `${app.company} — ${app.position}` : 'Candidature';
  }

  statusPercentage(count: number): number {
    return this.statistics.totalApplications > 0
      ? Math.round((count / this.statistics.totalApplications) * 100)
      : 0;
  }

  private refreshDashboard(applications: JobApplication[]): void {
    this.applications = applications;
    this.activeApplications = applications.filter(app => app.status !== 'Accepté' && app.status !== 'Refusé').length;
    this.statistics = this.storageService.calculateStatistics();
    this.followUpActions = this.storageService.generateSuggestions()
      .filter(suggestion => suggestion.type === 'warning')
      .slice(0, 5);
    this.upcomingInterviews = this.getUpcomingInterviews(applications).slice(0, 5);
  }

  private getUpcomingInterviews(applications: JobApplication[]): UpcomingInterview[] {
    const now = new Date();
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
}
