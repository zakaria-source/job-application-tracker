import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, map} from 'rxjs';
import {Interview, JobApplication, RecruitmentStage} from '../models/job-application.model';
import {UserProfile} from '../models/user-profile.model';

interface ApplicationDto extends Omit<JobApplication, 'applicationDate' | 'lastUpdated' | 'responseDate' | 'followUpDate' | 'interviews'> {
  applicationDate: string;
  lastUpdated: string;
  responseDate?: string | null;
  followUpDate?: string | null;
  interviews?: InterviewDto[];
  version?: number;
}

interface InterviewDto extends Omit<Interview, 'date'> {
  date: string;
}

export interface CloudImportSummary {
  imported: number;
  skipped: number;
}

@Injectable({providedIn: 'root'})
export class CloudApiService {
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
    return this.http.put<ApplicationDto>(
      `${this.applicationsUrl}/${encodeURIComponent(application.id)}`,
      this.toApplicationRequest(application)
    ).pipe(map(item => this.hydrateApplication(item)));
  }

  moveApplication(id: string, stage: RecruitmentStage): Observable<JobApplication> {
    return this.http.patch<ApplicationDto>(
      `${this.applicationsUrl}/${encodeURIComponent(id)}/stage`,
      {stage}
    ).pipe(map(item => this.hydrateApplication(item)));
  }

  deleteApplication(id: string): Observable<void> {
    return this.http.delete<void>(`${this.applicationsUrl}/${encodeURIComponent(id)}`);
  }

  importApplications(applications: readonly JobApplication[]): Observable<CloudImportSummary> {
    return this.http.post<CloudImportSummary>(
      `${this.applicationsUrl}/import`,
      applications.map(application => this.toApplicationRequest(application))
    );
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
      interviews: (raw.interviews ?? []).map(interview => ({
        ...interview,
        date: new Date(interview.date)
      }))
    };
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
