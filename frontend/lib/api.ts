import { User, Sender, ScheduledEmailsResponse, SentEmailsResponse } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Include HTTP-only cookies
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth API
  getMe: () => fetcher<{ user: User }>('/auth/me'),
  logout: () => fetcher<{ message: string }>('/auth/logout', { method: 'POST' }),
  devLogin: (email?: string, name?: string) =>
    fetcher<{ message: string; user: User; token: string }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    }),

  // Senders API
  getSenders: () => fetcher<{ senders: Sender[] }>('/api/senders'),
  createSender: (name?: string) =>
    fetcher<{ sender: Sender }>('/api/senders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // Schedule API
  scheduleCampaign: (payload: {
    subject: string;
    body: string;
    recipients: string[] | string;
    senderId?: string;
    startTime?: string;
    delayBetweenEmailsMs?: number;
    maxEmailsPerHour?: number;
  }) =>
    fetcher<{ message: string; totalScheduled: number }>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Emails Listing API
  getScheduledEmails: (page = 1, limit = 20) =>
    fetcher<ScheduledEmailsResponse>(`/api/emails/scheduled?page=${page}&limit=${limit}`),

  getSentEmails: (page = 1, limit = 20, status?: string) => {
    const statusQuery = status ? `&status=${status}` : '';
    return fetcher<SentEmailsResponse>(`/api/emails/sent?page=${page}&limit=${limit}${statusQuery}`);
  },
};
