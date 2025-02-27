import { Client, AuthProvider } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Email, Client as EmailClient } from '../types/email';

interface EmailsQueryParams {
  client: EmailClient | 'all';
  unreadOnly: boolean;
  skip: number;
  top: number;
}

export class GraphClient {
  private client: Client;
  private msalClient: ConfidentialClientApplication;

  constructor() {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      },
    });

    const authProvider: AuthProvider = async (done) => {
      try {
        const result = await this.msalClient.acquireTokenByClientCredential({
          scopes: ['https://graph.microsoft.com/.default'],
        });
        done(null, result?.accessToken || null);
      } catch (error) {
        done(error as Error, null);
      }
    };

    this.client = Client.init({
      authProvider,
    });
  }

  async getEmails(params: EmailsQueryParams): Promise<Email[]> {
    const { client, unreadOnly, skip, top } = params;
    let filter = '';

    if (unreadOnly) {
      filter = 'isRead eq false';
    }

    if (client !== 'all') {
      filter = filter ? `${filter} and ` : '';
      filter += `contains(subject,'[${client}]')`;
    }

    const response = await this.client
      .api('/me/messages')
      .filter(filter)
      .skip(skip)
      .top(top)
      .get();

    return response.value.map((email: any) => ({
      id: email.id,
      subject: email.subject,
      body: email.body.content,
      sender: email.from.emailAddress.address,
      receivedAt: email.receivedDateTime,
      isRead: email.isRead,
      client: this.extractClientFromSubject(email.subject) as EmailClient,
      classification: email.categories?.[0],
    }));
  }

  async markAsRead(emailId: string): Promise<void> {
    await this.client.api(`/me/messages/${emailId}`).patch({ isRead: true });
  }

  async updateEmail(emailId: string, update: Partial<Email>): Promise<Email> {
    const response = await this.client.api(`/me/messages/${emailId}`).patch({
      categories: update.classification ? [update.classification] : [],
    });

    return {
      id: response.id,
      subject: response.subject,
      body: response.body.content,
      sender: response.from.emailAddress.address,
      receivedAt: response.receivedDateTime,
      isRead: response.isRead,
      client: this.extractClientFromSubject(response.subject) as EmailClient,
      classification: response.categories?.[0],
    };
  }

  private extractClientFromSubject(subject: string): string {
    const match = subject.match(/\[(.*?)\]/);
    return match ? match[1].toLowerCase() : 'unknown';
  }
}
