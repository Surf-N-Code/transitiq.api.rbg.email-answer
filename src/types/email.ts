export interface Email {
  id: string;
  sender: string;
  subject: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface EmailResponse {
  emails: Email[];
}

export interface GeneratedResponse {
  response: string;
  status: 'loading' | 'complete' | 'error';
  isComplaintAboutBeingLeftBehind: boolean;
}
