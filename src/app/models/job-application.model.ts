export type ApplicationStatus = 'Envoyé' | 'Entretien' | 'Accepté' | 'Refusé';
export type ContractType = 'CDI' | 'CDD' | 'Freelance' | 'Stage' | 'Alternance' | 'Autre';
export type ApplicationPriority = 'Haute' | 'Moyenne' | 'Basse';
export type SalaryPeriod = 'Annuel' | 'Journalier';
export type RecruitmentStage =
    | 'Candidature'
    | 'Screening RH'
    | 'Entretien technique'
    | 'Hiring Manager'
    | 'Entretien final'
    | 'Offre'
    | 'Clôturé';

export interface JobApplication {
    id: string;
    company: string;
    position: string;
    applicationDate: Date;
    status: ApplicationStatus;
    notes: string;
    lastUpdated: Date;
    responseDate?: Date;

    offerUrl?: string;
    contractType: ContractType;
    salaryTarget?: number;
    salaryPeriod: SalaryPeriod;
    followUpDate?: Date;
    recruiterName?: string;
    recruiterEmail?: string;
    recruiterPhone?: string;
    stage: RecruitmentStage;
    priority: ApplicationPriority;

    interviews?: Interview[];

    /** @deprecated Legacy fields kept for LocalStorage migration. */
    contactPerson?: string;
    /** @deprecated Legacy fields kept for LocalStorage migration. */
    contactEmail?: string;
    /** @deprecated Legacy fields kept for LocalStorage migration. */
    contactPhone?: string;
}

export interface Interview {
    id: string;
    date: Date;
    type: 'Téléphone' | 'Visioconférence' | 'En personne';
    notes: string;
    reminderSet: boolean;
}

export interface JobStatistics {
    totalApplications: number;
    responseRate: number;
    averageResponseTime: number;
    statusCounts: {
        sent: number;
        interview: number;
        accepted: number;
        rejected: number;
    };
    applicationsByWeek: {
        week: string;
        count: number;
    }[];
    mostResponsiveCompanies: {
        company: string;
        responseTime: number;
    }[];
}

export interface Suggestion {
    id: string;
    type: 'info' | 'warning' | 'success' | 'error';
    message: string;
    relatedApplicationId?: string;
}
