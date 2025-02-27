export type Client = 'rbg' | 'wsw';

export interface Email {
  id: string;
  subject: string;
  body: string;
  sender: string;
  receivedAt: string;
  client: Client;
  isRead: boolean;
  classification?: string;
}

export interface EmailsResponse {
  emails: Email[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface EmailsRequest {
  client: Client | 'all';
  unreadOnly: boolean;
  page: number;
  pageSize: number;
}

export interface CrawledEmail {
  id: string;
  timestamp: string;
  subject: string;
  isRead: boolean;
  sender: string;
  body: {
    contentType: string;
    content: string;
  };
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
}

export interface CrawledEmailWithExtractedCustomerFields extends CrawledEmail {
  fields: EmailFields;
}

export interface EmailFields {
  [key: string]: string;
  anrede: string;
  email: string;
  vorname: string;
  nachname: string;
  message: string;
  linie: string;
  haltestelle: string;
  richtung: string;
  stadt: string;
  datum: string;
}

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
