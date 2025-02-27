import { EmailsRequest, EmailsResponse, Email } from '../types/email';
import { GraphClient } from './graph-client';

const graphClient = new GraphClient();

export async function fetchEmails(
  params: EmailsRequest
): Promise<EmailsResponse> {
  try {
    const { client, unreadOnly, page, pageSize } = params;

    // Fetch emails from Microsoft Graph API
    const emails = await graphClient.getEmails({
      client,
      unreadOnly,
      skip: (page - 1) * pageSize,
      top: pageSize,
    });

    return {
      emails,
      totalCount: emails.length, // This should be updated with actual total count from API
      page,
      pageSize,
    };
  } catch (error) {
    console.error('Error in fetchEmails:', error);
    throw error;
  }
}

export async function markEmailAsRead(emailId: string): Promise<void> {
  try {
    await graphClient.markAsRead(emailId);
  } catch (error) {
    console.error('Error marking email as read:', error);
    throw error;
  }
}

export async function classifyEmail(
  emailId: string,
  classification: string
): Promise<Email> {
  try {
    const email = await graphClient.updateEmail(emailId, { classification });
    return email;
  } catch (error) {
    console.error('Error classifying email:', error);
    throw error;
  }
}
