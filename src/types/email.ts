export interface Email {
  id: string;
  sender: string;
  subject: string;
  text: string;
  timestamp: string;
  isRead: boolean;
  client: string;
  fields: { [key: string]: string };
}

export type Client = 'rheinbahn' | 'wsw';

export interface EmailResponse {
  emails: Email[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GeneratedResponse {
  response: string;
  status: 'loading' | 'complete' | 'error';
  isComplaintAboutBeingLeftBehind: boolean;
}

export interface EmailFilters {
  client: Client | 'all';
  unreadOnly: boolean;
  page: number;
  pageSize: number;
}
