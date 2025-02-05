import { CrawledEmail, EmailFields } from '@/types/email';
import { logError, logInfo } from './logger';
const msal = require('@azure/msal-node');
const axios = require('axios');
const cheerio = require('cheerio');

export class EmailHandler {
  private msalClient: any;
  private config: any;
  public GRAPH_API_ENDPOINT: string;
  private headers: any;
  public accessToken: string;
  private inboxToProcess: string;

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
    this.initializeToken();
  }

  public async initializeToken() {
    this.accessToken = await this.getAccessToken();
    this.headers.Authorization = `Bearer ${this.accessToken}`;
  }

  public setInboxToProcess(inboxToProcess: string) {
    this.inboxToProcess = inboxToProcess;
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
    try {
      const markAsReadEndpoint = `${this.GRAPH_API_ENDPOINT}/users/${this.inboxToProcess}/messages/${emailId}`;
      await axios.patch(
        markAsReadEndpoint,
        { isRead: true },
        { header: this.headers }
      );
    } catch (error: any) {
      throw error;
    }
  }

  async crawlUnreadEmails(): Promise<CrawledEmail[]> {
    try {
      let endpoint =
        `${this.GRAPH_API_ENDPOINT}/users/${this.inboxToProcess}/messages?` +
        `$filter=isRead eq false&` +
        '$orderby=receivedDateTime desc&' +
        '$top=100&' +
        '$select=id,subject,body,from,receivedDateTime,isRead';

      let totalEmails = 0;
      let emails: CrawledEmail[] = [];

      while (endpoint) {
        try {
          const response = await axios.get(endpoint, { headers: this.headers });
          const responseEmails = response.data.value;
          totalEmails += responseEmails.length;
          logInfo('Processing email batch', { count: responseEmails.length });

          for (const email of responseEmails) {
            if (email.from.emailAddress.address === this.inboxToProcess) {
              logInfo('Skipping self-sent email', {
                totalProcessed: totalEmails,
              });
              continue;
            }

            emails.push(email);
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
    ccRecipients?: string[]
  ) {
    try {
      const emailData = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: content.replace(/\n/g, '<br>'),
          },
          toRecipients: toRecipients.map((email) => ({
            emailAddress: { address: email },
          })),
          ccRecipients:
            ccRecipients?.map((email) => ({
              emailAddress: { address: email },
            })) || [],
        },
      };

      const endpoint =
        'https://graph.microsoft.com/v1.0/users/' + senderEmail + '/sendMail';
      await axios.post(endpoint, emailData, { headers: this.headers });
    } catch (error: any) {
      throw error;
    }
  }

  extractCustomerFieldsFromComplaintEmail(textToAnalyze: string): EmailFields {
    try {
      const $ = cheerio.load(textToAnalyze);

      // Remove script and style tags
      $('script').remove();
      $('style').remove();
      $('head').remove();

      // Get text and preserve some formatting
      let text = $('body').text();

      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();

      // Remove any remaining HTML entities
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

      // Extract main message content
      const comaplaintFormStartMarker = 'Eure Nachricht an uns';
      const comaplaintFormEndMarker = 'Dokumenten-Upload';
      const fields: EmailFields = {
        anrede: '',
        email: '',
        vorname: '',
        nachname: '',
        message: '',
      };

      const startIndex = text.indexOf(comaplaintFormStartMarker);
      if (startIndex !== -1) {
        // Extract fields using regex patterns
        const patterns = {
          anrede: /Anrede(Frau|Herr|Divers|Keine Angabe)\s/,
          email: /E-Mail([^\s]+@[^\s]+)\s/,
          vorname: /Vorname([^\s]+)\s/,
          nachname: /Nachname([^\s]+)/,
        };

        for (const [field, pattern] of Object.entries(patterns)) {
          const match = text.match(pattern);
          if (match && match[1]) {
            fields[field] = match[1].trim();
          }
        }
        // Get text after start marker
        let messageText = text
          .substring(startIndex + comaplaintFormStartMarker.length)
          .trim();

        // Find end marker and cut there
        const endIndex = messageText.indexOf(comaplaintFormEndMarker);
        if (endIndex !== -1) {
          messageText = messageText.substring(0, endIndex).trim();
        }
        fields.message = messageText;
      } else if (text.includes('Betreff:')) {
        const directMailComplaintMarker = 'Betreff:';
        const startIndex = text.lastIndexOf(directMailComplaintMarker);
        const endIndex = text.indexOf('Rheinbahn AG | ');

        let messageText = text
          .substring(startIndex + directMailComplaintMarker.length, endIndex)
          .trim();

        messageText = messageText.replace(/\[Externe E-Mail\]/g, '');
        fields.message = messageText;
      } else {
        fields.message = text;
      }

      logInfo('Extracted fields from email:', {
        ...fields,
        message: '[REDACTED]', // Don't log the full message content
      });
      return fields;
    } catch (error: any) {
      logError('Error parsing HTML:', { error: error?.message });
      throw new Error('Could not extract text and fields from email', {
        cause: error,
      });
    }
  }
}
