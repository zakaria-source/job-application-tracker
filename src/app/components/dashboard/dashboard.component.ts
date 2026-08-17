import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {NgChartsModule} from 'ng2-charts';
import {ChartConfiguration, ChartData} from 'chart.js';
import {combineLatest, timer} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
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
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, NgChartsModule],
    template: `
    <div class="dashboard-container">
      <section class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-icon>work</mat-icon>
          <div>
            <strong>{{ statistics.totalApplications }}</strong>
            <span>Candidatures suivies</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <mat-icon>reply_all</mat-icon>
          <div>
            <strong>{{ statistics.responseRate | number:'1.0-0' }}%</strong>
            <span>Taux de réponse</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card" [class.attention]="followUpActions.length > 0">
          <mat-icon>notification_important</mat-icon>
          <div>
            <strong>{{ followUpActions.length }}</strong>
            <span>Relances à traiter</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card" [class.highlight]="upcomingInterviews.length > 0">
          <mat-icon>event</mat-icon>
          <div>
            <strong>{{ upcomingInterviews.length }}</strong>
            <span>Entretiens / 14 jours</span>
          </div>
        </mat-card>
      </section>

      <section class="dashboard-grid">
        <mat-card class="panel action-panel">
          <mat-card-header>
            <mat-card-title>À faire maintenant</mat-card-title>
            <mat-card-subtitle>Relances en retard, à faire aujourd'hui ou candidatures sans suivi.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="followUpActions.length === 0" class="empty-state small">
              <mat-icon>task_alt</mat-icon>
              <p>Aucune relance urgente.</p>
            </div>

            <div *ngFor="let action of followUpActions" class="action-item">
              <mat-icon>schedule</mat-icon>
              <div>
                <strong>{{ getApplicationLabel(action.relatedApplicationId) }}</strong>
                <p>{{ action.message }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="panel priority-panel">
          <mat-card-header>
            <mat-card-title>Pipeline haute priorité</mat-card-title>
            <mat-card-subtitle>Les opportunités actives à ne pas laisser refroidir.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="highPriorityApplications.length === 0" class="empty-state small">
              <mat-icon>flag</mat-icon>
              <p>Aucune candidature active en priorité haute.</p>
            </div>

            <div *ngFor="let application of highPriorityApplications" class="priority-item">
              <div class="priority-main">
                <strong>{{ application.company }}</strong>
                <span>{{ application.position }}</span>
              </div>
              <div class="priority-meta">
                <span>{{ application.stage }}</span>
                <span *ngIf="application.followUpDate">Relance {{ application.followUpDate | date:'dd/MM' }}</span>
                <span *ngIf="application.salaryTarget">{{ formatTargetSalary(application) }}</span>
              </div>
              <a *ngIf="application.offerUrl"
                 mat-icon-button
                 [href]="application.offerUrl"
                 target="_blank"
                 rel="noopener noreferrer"
                 aria-label="Ouvrir l'offre">
                <mat-icon>open_in_new</mat-icon>
              </a>
            </div>
          </mat-card-content>
        </mat-card>
      </section>

      <mat-card class="panel interviews-card">
        <mat-card-header>
          <mat-card-title>Agenda des entretiens</mat-card-title>
          <mat-card-subtitle>Les rendez-vous prévus dans les 14 prochains jours.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="upcomingInterviews.length === 0" class="empty-state interview-empty">
            <mat-icon>event_available</mat-icon>
            <p>Aucun entretien prévu.</p>
          </div>

          <div *ngIf="upcomingInterviews.length > 0" class="interviews-list">
            <div *ngFor="let interview of upcomingInterviews" class="interview-item">
              <div class="interview-date">
                <div class="date-day">{{ interview.date | date:'dd' }}</div>
                <div class="date-month">{{ interview.date | date:'MMM' }}</div>
              </div>
              <div class="interview-details">
                <strong>{{ interview.company }}</strong>
                <span>{{ interview.position }}</span>
                <small><mat-icon>schedule</mat-icon>{{ interview.date | date:'HH:mm' }} · {{ interview.type }}</small>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <section class="dashboard-grid analytics-grid">
        <mat-card class="panel">
          <mat-card-header>
            <mat-card-title>Répartition du pipeline</mat-card-title>
            <mat-card-subtitle>{{ statistics.averageResponseTime | number:'1.0-1' }} jours en moyenne avant une première réponse.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container">
              <canvas baseChart [data]="statusChartData" [type]="'doughnut'" [options]="statusChartOptions"></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="panel">
          <mat-card-header>
            <mat-card-title>Rythme de candidatures</mat-card-title>
            <mat-card-subtitle>Volume de candidatures envoyées par semaine.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container">
              <canvas baseChart [data]="weeklyChartData" [options]="weeklyChartOptions" [type]="'line'"></canvas>
            </div>
          </mat-card-content>
        </mat-card>
      </section>
    </div>
  `,
    styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
    .kpi-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 14px;
      padding: 18px;
    }
    .kpi-card > mat-icon {
      width: 36px;
      height: 36px;
      font-size: 36px;
      color: #3f51b5;
    }
    .kpi-card strong,
    .kpi-card span {
      display: block;
    }
    .kpi-card strong {
      font-size: 27px;
      line-height: 1.1;
    }
    .kpi-card span {
      margin-top: 4px;
      font-size: 12px;
      color: #757575;
    }
    .kpi-card.attention {
      background: #fff8e1;
    }
    .kpi-card.attention > mat-icon,
    .kpi-card.attention strong {
      color: #ef6c00;
    }
    .kpi-card.highlight {
      background: #e8f5e9;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }
    .panel {
      min-width: 0;
    }
    .action-item,
    .priority-item {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .action-item:last-child,
    .priority-item:last-child {
      border-bottom: 0;
    }
    .action-item > mat-icon {
      color: #ef6c00;
      flex: 0 0 auto;
    }
    .action-item strong {
      font-size: 14px;
    }
    .action-item p {
      margin: 3px 0 0;
      color: #616161;
      line-height: 1.4;
    }
    .priority-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .priority-main span {
      color: #616161;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .priority-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      color: #757575;
      font-size: 12px;
      text-align: right;
    }
    .empty-state {
      min-height: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #757575;
    }
    .empty-state.small {
      min-height: 130px;
    }
    .empty-state.interview-empty {
      min-height: 100px;
    }
    .empty-state mat-icon {
      width: 42px;
      height: 42px;
      font-size: 42px;
      margin-bottom: 8px;
      color: #4caf50;
    }
    .interviews-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin-top: 8px;
    }
    .interview-item {
      display: flex;
      align-items: center;
      padding: 14px;
      background: #f6f7fb;
      border-radius: 12px;
    }
    .interview-date {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 58px;
      height: 58px;
      flex: 0 0 58px;
      margin-right: 14px;
      background: #3f51b5;
      color: white;
      border-radius: 10px;
    }
    .date-day {
      font-size: 20px;
      font-weight: 600;
    }
    .date-month {
      font-size: 12px;
      text-transform: uppercase;
    }
    .interview-details {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .interview-details span {
      margin: 2px 0 5px;
      color: #616161;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .interview-details small {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #757575;
    }
    .interview-details small mat-icon {
      width: 15px;
      height: 15px;
      font-size: 15px;
    }
    .chart-container {
      height: 270px;
      position: relative;
      margin-top: 12px;
    }
    @media (max-width: 1000px) {
      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 540px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      .priority-item {
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .priority-meta {
        align-items: flex-start;
        text-align: left;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);

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

    constructor(private readonly storageService: StorageService) {
    }

    ngOnInit(): void {
        combineLatest([
            this.storageService.getApplications(),
            timer(0, 60_000)
        ])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([applications]) => this.refreshDashboard(applications));
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
}
