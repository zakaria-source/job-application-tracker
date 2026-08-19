import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, map} from 'rxjs';
import {Interview, JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';
import {ApplicationEvent, ApplicationHealth, FollowUp, InterviewDebrief, InterviewDebriefInput} from '@app/features/applications/models/application-tracking.model';
import {JobImportPreview} from '@app/features/applications/models/job-import.model';
import {EmailAnalysis, EmailAnalysisInput, EmailApplyInput, EmailApplyResponse} from '@app/features/applications/models/application-email.model';
import {UserProfile} from '@app/features/profile/user-profile.model';

interface ApplicationDto extends Omit<JobApplication, 'applicationDate' | 'lastUpdated' | 'responseDate' | 'followUpDate' | 'interviews'> {
  applicationDate: string;
  lastUpdated: string;
  responseDate?: string | null;
  followUpDate?: string | null;
  interviews?: InterviewDto[];
  version?: number;
}
interface InterviewDto extends Omit<Interview, 'date'> { date: string; }
interface ApplicationEventDto extends Omit<ApplicationEvent, 'createdAt'> { createdAt: string; }
interface FollowUpDto extends Omit<FollowUp, 'scheduledFor' | 'completedAt' | 'createdAt' | 'updatedAt'> {
  scheduledFor: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
interface InterviewDebriefDto extends Omit<InterviewDebrief, 'updatedAt'> { updatedAt: string; }
interface TrackingOverviewDto {
  activity: ApplicationEventDto[];
  followUps: FollowUpDto[];
  health: ApplicationHealth;
  debriefs: InterviewDebriefDto[];
}

export interface ApplicationImportSummary { imported: number; skipped: number; }
export interface ApplicationTrackingOverview {
  activity: ApplicationEvent[];
  followUps: FollowUp[];
  health: ApplicationHealth;
  debriefs: InterviewDebrief[];
}

@Injectable({providedIn: 'root'})
export class JobTrackrApiService {
  private readonly applicationsUrl = '/api/v1/applications';
  private readonly profileUrl = '/api/v1/profile';

  constructor(private readonly http: HttpClient) {}

  listApplications(): Observable<JobApplication[]> {
    return this.http.get<ApplicationDto[]>(this.applicationsUrl)
      .pipe(map(items => items.map(item => this.hydrateApplication(item))));
  }

  createApplication(application: JobApplication): Observable<JobApplication> {
    return this.http.post<ApplicationDto>(this.applicationsUrl, this.toApplicationRequest(application))
      .pipe(map(item => this.hydrateApplication(item)));
  }

  updateApplication(application: JobApplication): Observable<JobApplication> {
    const headers = application.version === undefined
      ? undefined
      : new HttpHeaders({'If-Match': `"${application.version}"`});
    return this.http.put<ApplicationDto>(
      `${this.applicationsUrl}/${encodeURIComponent(application.id)}`,
      this.toApplicationRequest(application),
      {headers}
    ).pipe(map(item => this.hydrateApplication(item)));
  }

  moveApplication(id: string, stage: RecruitmentStage): Observable<JobApplication> {
    return this.http.patch<ApplicationDto>(`${this.applicationsUrl}/${encodeURIComponent(id)}/stage`, {stage})
      .pipe(map(item => this.hydrateApplication(item)));
  }

  deleteApplication(id: string): Observable<void> {
    return this.http.delete<void>(`${this.applicationsUrl}/${encodeURIComponent(id)}`);
  }

  importApplications(applications: readonly JobApplication[]): Observable<ApplicationImportSummary> {
    return this.http.post<ApplicationImportSummary>(
      `${this.applicationsUrl}/import`,
      applications.map(application => this.toApplicationRequest(application))
    );
  }

  previewJobUrl(url: string): Observable<JobImportPreview> {
    return this.http.post<JobImportPreview>('/api/v1/job-import/preview', {url});
  }

  analyzeRecruitmentEmail(input: EmailAnalysisInput): Observable<EmailAnalysis> {
    return this.http.post<EmailAnalysis>('/api/v1/mail-tracking/analyze', input);
  }

  applyRecruitmentEmail(input: EmailApplyInput): Observable<EmailApplyResponse> {
    return this.http.post<EmailApplyResponse>('/api/v1/mail-tracking/apply', input);
  }

  getTrackingOverview(id: string): Observable<ApplicationTrackingOverview> {
    return this.http.get<TrackingOverviewDto>(`${this.applicationsUrl}/${encodeURIComponent(id)}/tracking-overview`)
      .pipe(map(overview => ({
        activity: overview.activity.map(item => ({...item, createdAt: new Date(item.createdAt)})),
        followUps: overview.followUps.map(item => this.hydrateFollowUp(item)),
        health: overview.health,
        debriefs: overview.debriefs.map(item => this.hydrateDebrief(item))
      })));
  }

  getApplicationActivity(id: string): Observable<ApplicationEvent[]> {
    return this.http.get<ApplicationEventDto[]>(`${this.applicationsUrl}/${encodeURIComponent(id)}/activity`)
      .pipe(map(items => items.map(item => ({...item, createdAt: new Date(item.createdAt)}))));
  }

  getFollowUps(id: string): Observable<FollowUp[]> {
    return this.http.get<FollowUpDto[]>(`${this.applicationsUrl}/${encodeURIComponent(id)}/follow-ups`)
      .pipe(map(items => items.map(item => this.hydrateFollowUp(item))));
  }

  scheduleFollowUp(id: string, date: Date): Observable<FollowUp> {
    return this.http.post<FollowUpDto>(
      `${this.applicationsUrl}/${encodeURIComponent(id)}/follow-ups`,
      {scheduledFor: this.toLocalDate(date)}
    ).pipe(map(item => this.hydrateFollowUp(item)));
  }

  completeCurrentFollowUp(id: string): Observable<FollowUp> {
    return this.http.patch<FollowUpDto>(
      `${this.applicationsUrl}/${encodeURIComponent(id)}/follow-ups/current/complete`,
      {}
    ).pipe(map(item => this.hydrateFollowUp(item)));
  }

  snoozeFollowUp(applicationId: string, followUpId: string, date: Date): Observable<FollowUp> {
    return this.http.patch<FollowUpDto>(
      `${this.applicationsUrl}/${encodeURIComponent(applicationId)}/follow-ups/${encodeURIComponent(followUpId)}/snooze`,
      {scheduledFor: this.toLocalDate(date)}
    ).pipe(map(item => this.hydrateFollowUp(item)));
  }

  getInterviewDebriefs(id: string): Observable<InterviewDebrief[]> {
    return this.http.get<InterviewDebriefDto[]>(`${this.applicationsUrl}/${encodeURIComponent(id)}/debriefs`)
      .pipe(map(items => items.map(item => this.hydrateDebrief(item))));
  }

  saveInterviewDebrief(
    applicationId: string,
    interviewId: string,
    input: InterviewDebriefInput
  ): Observable<InterviewDebrief> {
    return this.http.put<InterviewDebriefDto>(
      `${this.applicationsUrl}/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}/debrief`,
      input
    ).pipe(map(item => this.hydrateDebrief(item)));
  }

  getApplicationHealth(id: string): Observable<ApplicationHealth> {
    return this.http.get<ApplicationHealth>(`${this.applicationsUrl}/${encodeURIComponent(id)}/health`);
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.profileUrl);
  }

  updateProfile(profile: UserProfile): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.profileUrl, profile);
  }

  private hydrateApplication(raw: ApplicationDto): JobApplication {
    return {
      ...raw,
      applicationDate: this.localDate(raw.applicationDate),
      lastUpdated: new Date(raw.lastUpdated),
      responseDate: raw.responseDate ? this.localDate(raw.responseDate) : undefined,
      followUpDate: raw.followUpDate ? this.localDate(raw.followUpDate) : undefined,
      interviews: (raw.interviews ?? []).map(interview => ({...interview, date: new Date(interview.date)}))
    };
  }

  private hydrateFollowUp(raw: FollowUpDto): FollowUp {
    return {
      ...raw,
      scheduledFor: this.localDate(raw.scheduledFor),
      completedAt: raw.completedAt ? new Date(raw.completedAt) : undefined,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt)
    };
  }

  private hydrateDebrief(raw: InterviewDebriefDto): InterviewDebrief {
    return {...raw, updatedAt: new Date(raw.updatedAt)};
  }

  private toApplicationRequest(application: JobApplication): Record<string, unknown> {
    return {
      company: application.company,
      position: application.position,
      applicationDate: this.toLocalDate(application.applicationDate),
      status: application.status,
      notes: application.notes,
      responseDate: application.responseDate ? this.toLocalDate(application.responseDate) : null,
      offerUrl: application.offerUrl ?? null,
      contractType: application.contractType,
      salaryTarget: application.salaryTarget ?? null,
      salaryPeriod: application.salaryPeriod,
      followUpDate: application.followUpDate ? this.toLocalDate(application.followUpDate) : null,
      recruiterName: application.recruiterName ?? null,
      recruiterEmail: application.recruiterEmail ?? null,
      recruiterPhone: application.recruiterPhone ?? null,
      stage: application.stage,
      priority: application.priority,
      interviews: (application.interviews ?? []).map(interview => ({
        id: interview.id,
        date: interview.date.toISOString(),
        type: interview.type,
        notes: interview.notes,
        reminderSet: interview.reminderSet
      }))
    };
  }

  private localDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
