import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
const msal = require('@azure/msal-node');

class EmailCrawler {
  private msalClient: any;
  private GRAPH_API_ENDPOINT: string;

  constructor() {
    this.GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0';
    this.msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: process.env.MSAL_CLIENT_ID,
        clientSecret: process.env.MSAL_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.MSAL_TENANT_ID}`,
      },
    });
  }

  async getAccessToken() {
    const scopes = ['https://graph.microsoft.com/.default'];
    try {
      const response = await this.msalClient.acquireTokenByClientCredential({
        scopes: scopes,
      });
      return response.accessToken;
    } catch (error) {
      console.error(`Error getting access token: ${error}`);
      throw error;
    }
  }

  async markEmailAsRead(emailId: string, userEmail: string) {
    try {
      const accessToken = await this.getAccessToken();
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const endpoint = `${this.GRAPH_API_ENDPOINT}/users/${userEmail}/messages/${emailId}`;

      await axios.patch(
        endpoint,
        {
          isRead: true,
        },
        { headers }
      );

      return true;
    } catch (error) {
      console.error(`Error marking email as read: ${error}`);
      throw error;
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const emailCrawler = new EmailCrawler();

    // Try both email addresses since we don't know which one owns the email
    try {
      await emailCrawler.markEmailAsRead(id, process.env.MSAL_USER_EMAIL_RBG!);
    } catch (error) {
      // If the first attempt fails, try the second email address
      await emailCrawler.markEmailAsRead(id, process.env.MSAL_USER_EMAIL_WSW!);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking email as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark email as read' },
      { status: 500 }
    );
  }
}
