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
