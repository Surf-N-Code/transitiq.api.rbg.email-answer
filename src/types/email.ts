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

export interface CrawledEmail {
  id: string;
  receivedDateTime: string;
  subject: string;
  isRead: boolean;
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
  extractedFields: EmailFields;
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
