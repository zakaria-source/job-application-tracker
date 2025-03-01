export interface JobApplication {
    id: string;
    company: string;
    position: string;
    applicationDate: Date;
    status: 'Envoyé' | 'Entretien' | 'Accepté' | 'Refusé';
    notes: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    interviews?: Interview[];
    lastUpdated: Date;
    responseDate?: Date;
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