import { NextResponse } from 'next/server';
import { Email } from '@/types/email';
import axios from 'axios';
import { extractEtag } from 'next/dist/server/image-optimizer';
const msal = require('@azure/msal-node');
const cheerio = require('cheerio');
import { openai } from '@/lib/openai';

// This is a mock implementation. Replace with your actual email fetching logic
const mockEmails: Email[] = [
  {
    id: '1',
    sender: 'john@example.com',
    subject: 'Meeting Tomorrow',
    text: 'Hi, can we schedule a meeting for tomorrow at 2 PM?',
    timestamp: new Date().toISOString(),
    isRead: false,
  },
  {
    id: '2',
    sender: 'sarah@example.com',
    subject: 'Project Update',
    text: 'Here are the latest updates on the project...',
    timestamp: new Date().toISOString(),
    isRead: false,
  },
];

function extractCustomerFieldsFromComplaintEmail(
  textToAnalyze: string
): Fields {
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

    // if the text contains "Eure Nachricht an uns" and "Dokumenten-Upload" then the email will contain the below fields

    // Extract main message content
    const comaplaintFormStartMarker = 'Eure Nachricht an uns';
    const comaplaintFormEndMarker = 'Dokumenten-Upload';
    const fields: Fields = {
      anrede: '',
      email: '',
      vorname: '',
      nachname: '',
      message: '',
      category: false,
      id: '',
      from: '',
      date: new Date().toISOString(),
    };

    const startIndex = text.indexOf(comaplaintFormStartMarker);
    if (startIndex !== -1) {
      console.log('Complaint Form Complaint:');
      // Extract additional fields

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

      return fields;
    } else if (text.includes('Betreff:')) {
      //get new startindex
      console.log('Direct Mail Complaint:');
      const directMailComplaintMarker = 'Betreff:';
      const startIndex = text.lastIndexOf(directMailComplaintMarker);
      const endIndex = text.indexOf('Rheinbahn AG | ');
      console.log('Start Index:', startIndex);
      console.log('End Index:', endIndex);
      // get the text between the start and end index
      let messageText = text
        .substring(startIndex + directMailComplaintMarker.length, endIndex)
        .trim();

      messageText = messageText.replace(/\[Externe E-Mail\]/g, '');
      fields.message = messageText;
      console.log('Message Text:', messageText);
      return fields;
    } else {
      fields.message = text;
      return fields;
    }
  } catch (error) {
    console.error(`Error parsing HTML: ${error}`);
    throw new Error('Could not extract text and fields from email');
  }
}

export interface Fields {
  id: string;
  from: string;
  date: string;
  [key: string]: string;
  anrede: string;
  email: string;
  vorname: string;
  nachname: string;
  message: string;
  category: boolean;
}

class EmailCrawler {
  private msalClient: any;
  private config: any;
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

  async crawlUnreadEmails(msalUserEmail?: string) {
    if (!msalUserEmail) {
      throw new Error('MSAL user email env is not set');
    }
    try {
      const accessToken = await this.getAccessToken();
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      let endpoint =
        `${this.GRAPH_API_ENDPOINT}/users/${msalUserEmail}/messages?` +
        `$filter=isRead eq false&` +
        '$orderby=receivedDateTime desc&' +
        '$top=999&' +
        '$select=id,subject,body,from,receivedDateTime,isRead';

      let totalEmails = 0;

      while (endpoint) {
        let extractedFields: Fields[] = [];
        try {
          const response = await axios.get(endpoint, { headers });
          const emails = response.data.value;
          for (const email of emails) {
            if (
              email.from.emailAddress.address === process.env.MSAL_USER_EMAIL
            ) {
              console.log(`Skipping email ${totalEmails} - sent by self`);
              continue;
            }

            let fieldsFromEmail: Fields;
            try {
              fieldsFromEmail = extractCustomerFieldsFromComplaintEmail(
                email.body.content
              );

              fieldsFromEmail.date = email.receivedDateTime;
              fieldsFromEmail.id = email.id;
              fieldsFromEmail.from = email.from.emailAddress.address;
            } catch (error) {
              const emailErrorObject = {
                id: email.id,
                from: email.from.emailAddress.address,
                subject: email.subject,
                receivedDateTime: email.receivedDateTime,
              };
              console.error(
                `Error extracting fields from email: ${JSON.stringify(
                  emailErrorObject,
                  null,
                  2
                )}`
              );
              continue;
            }
            extractedFields.push(fieldsFromEmail);
          }

          endpoint = response.data['@odata.nextLink'] || null;
          return extractedFields;
        } catch (error) {
          console.error(`Error processing batch: ${error}`);
          throw error;
        }
      }

      return true;
    } catch (error) {
      console.error(`Error crawling emails: ${error}`);
      throw error;
    }
  }
}

export async function GET() {
  try {
    // Replace this with your actual email fetching logic
    const emailCrawler = new EmailCrawler();
    const emails = await emailCrawler.crawlUnreadEmails(
      process.env.MSAL_USER_EMAIL_WSW
    );

    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
