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
  private client: Client | null = null;
  private msalClient: ConfidentialClientApplication | null = null;
  private readonly inboxToProcess: string;

  constructor(inboxToProcess: string) {
    if (!inboxToProcess) {
      throw new Error('inboxToProcess parameter is required');
    }
    this.inboxToProcess = inboxToProcess;
  }

  private async initialize() {
    if (!this.client) {
      const clientId = process.env.AZURE_CLIENT_ID;
      const clientSecret = process.env.AZURE_CLIENT_SECRET;
      const tenantId = process.env.AZURE_TENANT_ID;

      if (!clientId || !clientSecret || !tenantId) {
        throw new Error('Azure credentials not properly configured');
      }

      try {
        this.msalClient = new ConfidentialClientApplication({
          auth: {
            clientId,
            clientSecret,
            authority: `https://login.microsoftonline.com/${tenantId}`,
          },
        });

        const authProvider: AuthProvider = async (done) => {
          try {
            const result =
              await this.msalClient!.acquireTokenByClientCredential({
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
      } catch (error) {
        console.error('Error initializing GraphClient:', error);
        throw error;
      }
    }
  }

  async getEmails(params: EmailsQueryParams): Promise<Email[]> {
    await this.initialize();
    const { client, unreadOnly, skip, top } = params;
    let filter = '';

    if (unreadOnly) {
      filter = 'isRead eq false';
    }

    const response = await this.client!.api(
      `/users/${this.inboxToProcess}/mailFolders/inbox/messages`
    )
      .select('id,subject,body,from,receivedDateTime,isRead,categories')
      .filter(filter)
      .orderby('receivedDateTime desc')
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
      classification: email.categories?.[0],
    }));
  }

  async markAsRead(emailId: string): Promise<void> {
    await this.initialize();
    await this.client!.api(
      `/users/${this.inboxToProcess}/messages/${emailId}`
    ).patch({ isRead: true });
  }
}
