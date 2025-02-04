import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@/types/email';
import axios from 'axios';
const msal = require('@azure/msal-node');
const cheerio = require('cheerio');

function extractEmailText(htmlContent: string): {
  text: string;
  fields: { [key: string]: string };
} {
  try {
    const $ = cheerio.load(htmlContent);

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
    const fields: { [key: string]: string } = {
      anrede: '',
      email: '',
      vorname: '',
      nachname: '',
    };

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

    // Extract message based on markers
    const complaintFormStartMarker = 'Eure Nachricht an uns';
    const complaintFormEndMarker = 'Dokumenten-Upload';
    const directMailComplaintMarker = 'Betreff:';
    const rheinbahnEndMarker = 'Rheinbahn AG | ';

    const complaintFormStart = text.indexOf(complaintFormStartMarker);
    if (complaintFormStart !== -1) {
      // This is a complaint form submission
      let messageText = text
        .substring(complaintFormStart + complaintFormStartMarker.length)
        .trim();

      const endIndex = messageText.indexOf(complaintFormEndMarker);
      if (endIndex !== -1) {
        messageText = messageText.substring(0, endIndex).trim();
      }
      return { text: messageText, fields };
    } else {
      // This might be a direct mail
      const directMailStart = text.lastIndexOf(directMailComplaintMarker);
      if (directMailStart !== -1) {
        const endIndex = text.indexOf(rheinbahnEndMarker);
        let messageText = text
          .substring(
            directMailStart + directMailComplaintMarker.length,
            endIndex !== -1 ? endIndex : undefined
          )
          .trim();
        return {
          text: messageText.replace(/\[Externe E-Mail\]/g, ''),
          fields,
        };
      }
    }

    // If no specific format is found, return the cleaned text
    return { text, fields };
  } catch (error) {
    console.error('Error extracting email text:', error);
    return { text: 'Error extracting email content', fields: {} };
  }
}

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

  async fetchEmails(msalUserEmail: string, isRead?: boolean) {
    if (!msalUserEmail) {
      throw new Error('MSAL user email is not set');
    }

    try {
      const accessToken = await this.getAccessToken();
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      let endpoint =
        `${this.GRAPH_API_ENDPOINT}/users/${msalUserEmail}/messages?` +
        (isRead !== undefined ? `$filter=isRead eq ${isRead}&` : '') +
        '$orderby=receivedDateTime desc&' +
        '$top=999&' +
        '$select=id,subject,body,from,receivedDateTime,isRead';

      const response = await axios.get(endpoint, { headers });

      return response.data.value.map((email: any) => {
        const extractedText = extractEmailText(email.body.content);
        console.log('extractedText', extractedText);
        return {
          id: email.id,
          sender: email.from.emailAddress.address,
          subject: email.subject,
          text: extractedText.text,
          fields: extractedText.fields,
          timestamp: email.receivedDateTime,
          isRead: email.isRead,
          client:
            msalUserEmail === process.env.MSAL_USER_EMAIL_RBG
              ? 'rheinbahn'
              : 'wsw',
        };
      });
    } catch (error) {
      console.error(`Error fetching emails: ${error}`);
      throw error;
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const client = searchParams.get('client') as Client | 'all';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    const emailCrawler = new EmailCrawler();
    let allEmails = [];

    // Fetch emails based on client selection
    if (client === 'all' || client === 'rheinbahn') {
      const rheinbahnEmails = await emailCrawler.fetchEmails(
        process.env.MSAL_USER_EMAIL_RBG!,
        unreadOnly ? false : undefined
      );
      allEmails.push(...rheinbahnEmails);
    }

    if (client === 'all' || client === 'wsw') {
      const wswEmails = await emailCrawler.fetchEmails(
        process.env.MSAL_USER_EMAIL_WSW!,
        unreadOnly ? false : undefined
      );
      allEmails.push(...wswEmails);
    }

    // Sort emails by timestamp
    allEmails.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Calculate pagination
    const total = allEmails.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEmails = allEmails.slice(startIndex, endIndex);

    return NextResponse.json({
      emails: paginatedEmails,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
