import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartData} from 'chart.js';
import {combineLatest, timer} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {EMPTY_USER_PROFILE, UserProfile} from '../../models/user-profile.model';
import {JobApplication, JobStatistics, Suggestion} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';
import {UserProfileService} from '../../services/user-profile.service';

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
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  profile: UserProfile = EMPTY_USER_PROFILE;
  applications: JobApplication[] = [];
  statistics: JobStatistics = {
    totalApplications: 0,
    responseRate: 0,
    averageResponseTime: 0,
    statusCounts: {sent: 0, interview: 0, accepted: 0, rejected: 0},
    applicationsByWeek: [],
    mostResponsiveCompanies: []
  };
  followUpActions: Suggestion[] = [];
  highPriorityApplications: JobApplication[] = [];
  upcomingInterviews: UpcomingInterview[] = [];

  statusChartData: ChartData<'doughnut'> = {
    labels: ['Envoyé', 'Entretien', 'Accepté', 'Refusé'],
    datasets: [{data: [0, 0, 0, 0], backgroundColor: ['#e0e0e0', '#bbdefb', '#c8e6c9', '#ffcdd2']}]
  };
  statusChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {legend: {position: 'right'}}
  };
  weeklyChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'Candidatures',
      data: [],
      borderColor: '#3f51b5',
      backgroundColor: 'rgba(63, 81, 181, 0.1)',
      tension: 0.35,
      fill: true
    }]
  };
  weeklyChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {y: {beginAtZero: true, ticks: {precision: 0}}},
    plugins: {legend: {display: false}}
  };

  constructor(
    private readonly storageService: StorageService,
    private readonly profileService: UserProfileService
  ) {}

  ngOnInit(): void {
    this.profileService.profileChanges()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(profile => this.profile = profile ?? EMPTY_USER_PROFILE);

    combineLatest([
      this.storageService.getApplications(),
      timer(0, 60_000)
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([applications]) => this.refreshDashboard(applications));
  }

  getApplicationLabel(applicationId?: string): string {
    const app = this.applications.find(application => application.id === applicationId);
    return app ? `${app.company} — ${app.position}` : 'Candidature';
  }

  formatTargetSalary(application: JobApplication): string {
    if (!application.salaryTarget) {
      return '';
    }
    const formatted = new Intl.NumberFormat('fr-FR').format(application.salaryTarget);
    return application.salaryPeriod === 'Journalier' ? `${formatted} €/j` : `${formatted} €/an`;
  }

  private refreshDashboard(applications: JobApplication[]): void {
    this.applications = applications;
    this.statistics = this.storageService.calculateStatistics();
    this.followUpActions = this.storageService.generateSuggestions()
      .filter(suggestion => suggestion.type === 'warning');
    this.highPriorityApplications = applications
      .filter(app => app.priority === 'Haute' && app.status !== 'Accepté' && app.status !== 'Refusé')
      .sort((a, b) => {
        const aDate = a.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = b.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate || b.applicationDate.getTime() - a.applicationDate.getTime();
      })
      .slice(0, 6);
    this.upcomingInterviews = this.getUpcomingInterviews(applications);
    this.updateCharts();
  }

  private updateCharts(): void {
    this.statusChartData = {
      ...this.statusChartData,
      datasets: [{
        ...this.statusChartData.datasets[0],
        data: [
          this.statistics.statusCounts.sent,
          this.statistics.statusCounts.interview,
          this.statistics.statusCounts.accepted,
          this.statistics.statusCounts.rejected
        ]
      }]
    };

    this.weeklyChartData = {
      labels: this.statistics.applicationsByWeek.map(item => item.week),
      datasets: [{
        ...this.weeklyChartData.datasets[0],
        data: this.statistics.applicationsByWeek.map(item => item.count)
      }]
    };
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
