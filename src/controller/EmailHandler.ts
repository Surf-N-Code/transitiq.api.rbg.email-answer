import { CrawledEmail } from '@/types/email';
import { logError, logInfo } from '../lib/logger';
const msal = require('@azure/msal-node');
const axios = require('axios');
const fs = require('fs');

function cleanEmailContent(content: string): string {
  return content
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\/g, '')
    .replace(/"{2,}/g, '"')
    .trim();
}

export class EmailHandler {
  private msalClient: any;
  private config: any;
  public GRAPH_API_ENDPOINT: string;
  private headers: any;
  public accessToken: string;
  private inboxToProcess: string;
  private emailFromAddressToProcess: string;
  constructor() {
    this.GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0';
    this.msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: process.env.MSAL_CLIENT_ID,
        clientSecret: process.env.MSAL_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.MSAL_TENANT_ID}`,
      },
    });
    this.accessToken = '';
    this.headers = {
      'Content-Type': 'application/json',
    };
    this.inboxToProcess = '';
    this.emailFromAddressToProcess = '';
    this.initializeToken();
  }

  public async initializeToken() {
    this.accessToken = await this.getAccessToken();
    this.headers.Authorization = `Bearer ${this.accessToken}`;
  }

  public setInboxToProcess(inboxToProcess: string) {
    this.inboxToProcess = inboxToProcess;
  }

  public setEmailFromAddressToProcess(emailFromAddressToProcess: string) {
    this.emailFromAddressToProcess = emailFromAddressToProcess;
  }

  async getAccessToken() {
    const scopes = ['https://graph.microsoft.com/.default'];
    try {
      const response = await this.msalClient.acquireTokenByClientCredential({
        scopes: scopes,
      });
      this.accessToken = response.accessToken;
      return response.accessToken;
    } catch (error: any) {
      logError('Error getting access token:', { error: error?.message });
      throw error;
    }
  }

  async markEmailAsRead(emailId: string) {
    this.accessToken = await this.getAccessToken();
    this.headers.Authorization = `Bearer ${this.accessToken}`;
    try {
      const markAsReadEndpoint = `${this.GRAPH_API_ENDPOINT}/users/${this.inboxToProcess}/messages/${emailId}`;
      await axios.patch(
        markAsReadEndpoint,
        { isRead: true },
        { headers: this.headers }
      );
    } catch (error: any) {
      throw error;
    }
  }

  async crawlUnreadEmails(unreadOnly: boolean): Promise<CrawledEmail[]> {
    try {
      let endpoint =
        `${this.GRAPH_API_ENDPOINT}/users/${this.inboxToProcess}/mailFolders/inbox/messages?` +
        `$filter=isRead eq ${unreadOnly ? 'false' : 'true'}&` +
        '$orderby=receivedDateTime desc&' +
        '$top=200&' +
        '$select=id,subject,body,from,receivedDateTime,isRead';

      let totalEmails = 0;
      let processedEmailsCount = 0;
      let emails: CrawledEmail[] = [];

      while (endpoint) {
        try {
          const response = await axios.get(endpoint, { headers: this.headers });
          const responseEmails = response.data.value;
          totalEmails += responseEmails.length;
          logInfo('Processing emails', { count: responseEmails.length });

          for (const email of responseEmails) {
            //write email body to file: unedited_text.txt
            fs.writeFileSync('unedited_text.txt', email.body.content);
            if (email.from.emailAddress.address === this.inboxToProcess) {
              logInfo('Skipping self-sent email', {
                totalProcessed: totalEmails,
              });
              continue;
            }

            if (
              email.from.emailAddress.address !== this.emailFromAddressToProcess
            ) {
              logInfo(
                `Skipping email as not sent from ${this.emailFromAddressToProcess}`
              );
              continue;
            }

            emails.push(email);
            processedEmailsCount++;
            logInfo(
              `Processed email ${processedEmailsCount} of ${totalEmails}`
            );
          }

          // Check for more pages
          endpoint = response.data['@odata.nextLink'] || null;
        } catch (error: any) {
          logError('Error processing email batch:', { error });
          throw error;
        }
      }

      return emails;
    } catch (error: any) {
      logError('Error crawling unread emails:', { error: error?.message });
      throw error;
    }
  }

  async sendEmail(
    senderEmail: string,
    subject: string,
    content: string,
    toRecipients: string[],
    ccRecipients?: string[],
    replyToEmail?: string
  ) {
    try {
      const emailData = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: cleanEmailContent(content).replace(/\n/g, '<br>'),
          },
          toRecipients: toRecipients.map((email) => ({
            emailAddress: { address: email },
          })),
          ccRecipients:
            ccRecipients?.map((email) => ({
              emailAddress: { address: email },
            })) || [],
          ...(replyToEmail && {
            replyTo: [
              {
                emailAddress: {
                  address: replyToEmail,
                },
              },
            ],
          }),
        },
      };

      const endpoint =
        'https://graph.microsoft.com/v1.0/users/' + senderEmail + '/sendMail';
      await axios.post(endpoint, emailData, { headers: this.headers });
    } catch (error: any) {
      throw error;
    }
  }
}
