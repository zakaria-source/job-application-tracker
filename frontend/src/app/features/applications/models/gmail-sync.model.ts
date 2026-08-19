export interface GmailStatus {
  available: boolean;
  connected: boolean;
  emailAddress?: string | null;
  lastSyncAt?: Date | null;
  lastError?: string | null;
  syncDelayMs: number;
}

export interface GmailAuthorizationResponse {
  authorizationUrl: string;
}

export interface GmailSyncResult {
  scanned: number;
  matched: number;
  applied: number;
  ignored: number;
  fullSync: boolean;
  syncedAt: Date;
}
