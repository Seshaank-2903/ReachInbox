export type JobStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface User {
  id: string;
  googleId?: string | null;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Sender {
  id: string;
  name: string;
  etherealEmail: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  createdAt: string;
}

export interface EmailJob {
  id: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  scheduledTime: string;
  status: JobStatus;
  bullJobId?: string | null;
  idempotencyKey: string;
  sentAt?: string | null;
  error?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  campaign?: {
    subject: string;
    body: string;
  };
  sender?: {
    name: string;
    etherealEmail: string;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ScheduledEmailsResponse {
  data: EmailJob[];
  pagination: Pagination;
}

export interface SentEmailsResponse {
  data: EmailJob[];
  pagination: Pagination;
}
