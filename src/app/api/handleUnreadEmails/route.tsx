import { classifyText } from '@/lib/classifyText';

const axios = require('axios');
const msal = require('@azure/msal-node');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { logInfo, logError } = require('@/lib/logger');

interface Fields {
  [key: string]: string;
  anrede: string;
  email: string;
  vorname: string;
  nachname: string;
  message: string;
}

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
    };

    const startIndex = text.indexOf(comaplaintFormStartMarker);
    if (startIndex !== -1) {
      logInfo('Processing Complaint Form Complaint');
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

      logInfo('Extracted fields from email:', {
        ...fields,
        message: '[REDACTED]', // Don't log the full message content
      });

      return fields;
    } else {
      logInfo('Processing Direct Mail Complaint');
      const directMailComplaintMarker = 'Betreff:';
      const startIndex = text.lastIndexOf(directMailComplaintMarker);
      const endIndex = text.indexOf('Rheinbahn AG | ');
      logInfo('Complaint Text Boundaries:', { startIndex, endIndex });

      // get the text between the start and end index
      let messageText = text
        .substring(startIndex + directMailComplaintMarker.length, endIndex)
        .trim();

      messageText = messageText.replace(/\[Externe E-Mail\]/g, '');
      fields.message = messageText;
      logInfo('Extracted Message Text:', messageText);
      return fields;
    }
  } catch (error: any) {
    logError('Error parsing HTML:', { error: error?.message });
    throw new Error('Could not extract text and fields from email');
  }
}

async function sendEmailViaGraph(
  accessToken: string,
  subject: string,
  content: string,
  toRecipients: string[],
  ccRecipients?: string[]
) {
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

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
      'https://graph.microsoft.com/v1.0/users/' +
      process.env.MSAL_USER_EMAIL +
      '/sendMail';
    await axios.post(endpoint, emailData, { headers });
    logInfo('Email sent successfully', { recipients: toRecipients.join(', ') });
  } catch (error: any) {
    logError('Error sending email:', { error: error?.message });
    throw error;
  }
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
    } catch (error: any) {
      logError('Error getting access token:', { error: error?.message });
      throw error;
    }
  }

  async crawlUnreadEmails(toRecipients: string[], ccRecipients?: string[]) {
    try {
      const accessToken = await this.getAccessToken();
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      let endpoint =
        `${this.GRAPH_API_ENDPOINT}/users/${process.env.MSAL_USER_EMAIL}/messages?` +
        `$filter=isRead eq false&` +
        '$orderby=receivedDateTime desc&' +
        '$top=999&' +
        '$select=id,subject,body,from,receivedDateTime,isRead';

      let totalEmails = 0;

      while (endpoint) {
        try {
          const response = await axios.get(endpoint, { headers });
          const emails = response.data.value;
          totalEmails += emails.length;
          logInfo('Processing email batch', { count: emails.length });

          for (const email of emails) {
            if (
              email.from.emailAddress.address === process.env.MSAL_USER_EMAIL
            ) {
              logInfo('Skipping self-sent email', {
                totalProcessed: totalEmails,
              });
              continue;
            }

            // Extract clean text and fields from anonymized HTML content
            let extractedFields: Fields;
            try {
              extractedFields = extractCustomerFieldsFromComplaintEmail(
                email.body.content
              );
            } catch (error) {
              const emailErrorObject = {
                id: email.id,
                from: email.from.emailAddress.address,
                subject: email.subject,
                receivedDateTime: email.receivedDateTime,
              };
              logError('Error extracting fields from email:', emailErrorObject);
              continue;
            }
            logInfo('Extracted fields from email:', {
              ...extractedFields,
              message: '[REDACTED]', // Don't log the full message content
            });

            let isComplaintAboutBeingLeftBehind = false;
            try {
              isComplaintAboutBeingLeftBehind = await classifyText(
                extractedFields.message
              );
            } catch (error) {
              logError('Error classifying text:', { error });
              //@TODO: we need to store the email in the database and try again later
              continue;
            }

            if (!isComplaintAboutBeingLeftBehind) {
              logInfo(
                'Email is not a complaint about being left behind and returned to kundendialog'
              );
              await sendEmailViaGraph(
                accessToken,
                `Kategorie: Andere Kategorie -> ${email.subject}`,
                email.body.content,
                ['kundendialog@rheinbahn.de']
              );
              continue;
            }

            // Call the message/generate endpoint to generate the text
            const response = await fetch(
              'http://localhost:3000/api/message/generate',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: extractedFields.message,
                  vorname: extractedFields.vorname,
                  nachname: extractedFields.nachname,
                  anrede: extractedFields.anrede,
                }),
              }
            );

            if (!response.ok) {
              logError('Error calling message/generate endpoint:', {
                emailId: email.id,
                statusText: response.statusText,
                status: response.status,
              });
              throw new Error('Failed to generate text');
            }

            const messageGenerationResponse = await response.json();

            // Log the original message and AI response
            logInfo('Processing complaint email:', {
              emailId: email.id,
              subject: email.subject,
              userMessage: extractedFields.message,
              aiResponse: messageGenerationResponse.finalResponse,
              isComplaintAboutBeingLeftBehind:
                messageGenerationResponse.isComplaintAboutBeingLeftBehind,
            });

            // Send GPT response via email
            if (messageGenerationResponse) {
              let content =
                `<strong>Kategorie:</strong>\nBeschwerde stehen gelassen` +
                `\n\n<strong>Kunden Beschwerde:</strong>\n${extractedFields.message}` +
                `\n\n<strong>KI Antwort:</strong>\n` +
                messageGenerationResponse.finalResponse;
              if (!messageGenerationResponse.isComplaintAboutBeingLeftBehind) {
                content = `<strong>Kategorie:</strong>\nAndere Kategorie\n\n<strong>Kunden Beschwerde:</strong> \n${extractedFields.message}`;
              }

              try {
                await sendEmailViaGraph(
                  accessToken,
                  `Kategorie: ${messageGenerationResponse.isComplaintAboutBeingLeftBehind ? '✅ Beschwerde stehen gelassen' : '❗️ Andere Kategorie'} -> ${email.subject}`,
                  content,
                  toRecipients,
                  ccRecipients
                );

                logInfo('Email response sent successfully:', {
                  emailId: email.id,
                  subject: email.subject,
                  category:
                    messageGenerationResponse.isComplaintAboutBeingLeftBehind
                      ? 'Beschwerde stehen gelassen'
                      : 'Andere Kategorie',
                  recipients: toRecipients,
                  ccRecipients,
                });
              } catch (error: any) {
                logError('Failed to send email response:', {
                  emailId: email.id,
                  error: error?.message,
                  subject: email.subject,
                });
                throw error;
              }
            }

            // Mark email as read
            try {
              const markAsReadEndpoint = `${this.GRAPH_API_ENDPOINT}/users/${process.env.MSAL_USER_EMAIL}/messages/${email.id}`;
              await axios.patch(
                markAsReadEndpoint,
                { isRead: true },
                { headers }
              );
              logInfo('Email marked as processed:', {
                emailId: email.id,
                subject: email.subject,
              });
            } catch (error: any) {
              logError('Failed to mark email as read:', {
                emailId: email.id,
                error: error?.message,
                subject: email.subject,
              });
              throw error;
            }
          }

          // Check for more pages
          endpoint = response.data['@odata.nextLink'] || null;
        } catch (error: any) {
          logError('Error processing email batch:', { error: error?.message });
          throw error;
        }
      }

      return true;
    } catch (error: any) {
      logError('Error crawling unread emails:', { error: error?.message });
      throw error;
    }
  }
}

export async function POST(request: Request) {
  try {
    const emailCrawler = new EmailCrawler();
    await emailCrawler.crawlUnreadEmails(['norman@movementor.online']);
    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST handler:', error?.message);
    return Response.json(
      { error: error?.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
