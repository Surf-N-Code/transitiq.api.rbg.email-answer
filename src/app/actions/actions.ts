'use server';

import { logError } from '@/lib/logger';
import { openai } from '@/lib/openai';
import { rbgClassifyEmail, rbgClassifyAndAnswer } from '@/prompts';
import { EmailFields } from '@/types/email';
import axios from 'axios';
import { EmailHandler } from '@/controller/EmailHandler';
import { extractStructuredInfoFromEmail } from '@/lib/extractStructuredInfoFromEmail';
import {
  Client,
  CrawledEmail,
  CrawledEmailWithExtractedCustomerFields,
  EmailFilters,
  EmailResponse,
} from '@/types/email';

export async function anonymizeText(text: string) {
  try {
    const response = await axios.post('http://localhost:8051/anonymize', {
      text: text,
    });
    return response.data;
  } catch (error: any) {
    logError('Anonymizing text failed:', { error: error?.message });
  }
}

export async function aiResponse(
  anonymized_text: string,
  anonymized_text_parts: Record<string, any>,
  clientName: string,
  gender: string,
  hasLastname: boolean
) {
  // Get just the placeholder keys
  let clientClose = '';
  if (clientName === 'rheinbahn') {
    clientClose = process.env.CLIENT_CLOSE_RBG || '';
  } else if (clientName === 'wsw') {
    clientClose = process.env.CLIENT_CLOSE_WSW || '';
  }

  const prompt = rbgClassifyAndAnswer(
    clientName,
    anonymized_text,
    anonymized_text_parts,
    clientClose,
    gender,
    hasLastname
  );

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 1,
      max_tokens: 2000,
    });

    return completion.choices[0].message.content;
  } catch (error: any) {
    throw new Error('Ai answer generation failed');
  }
}

export async function classifyText(text: string): Promise<boolean> {
  const prompt = rbgClassifyEmail(text);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein Assistent, der Texte analysiert und bestimmt, ob es sich um Beschwerden über das Zurücklassen am Bahnhof handelt.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1500,
      temperature: 0,
    });

    const answer = response.choices[0]?.message?.content?.toLowerCase() || '';
    return answer.includes('ja');
  } catch (error) {
    throw new Error('Error classifying text');
  }
}

export async function fetchEmails(
  filters: EmailFilters
): Promise<EmailResponse> {
  const { client, unreadOnly, page, pageSize } = filters;
  let allEmails: CrawledEmail[] = [];
  let emailHandler = new EmailHandler();
  await emailHandler.initializeToken();

  if (client === 'all' || client === 'rheinbahn') {
    emailHandler.setInboxToProcess(process.env.MSAL_USER_EMAIL_RBG!);
    const rbgEmails = await emailHandler.crawlUnreadEmails(unreadOnly);
    allEmails = [...allEmails, ...rbgEmails];
  }

  if (client === 'all' || client === 'wsw') {
    emailHandler.setInboxToProcess(process.env.MSAL_USER_EMAIL_WSW!);
    const wswEmails = await emailHandler.crawlUnreadEmails(unreadOnly);
    allEmails = [...allEmails, ...wswEmails];
  }

  let emailsWithExtractedCustomerFields: CrawledEmailWithExtractedCustomerFields[] =
    [];

  for (const email of allEmails) {
    try {
      const extractedFields = extractStructuredInfoFromEmail(
        email.body.content
      );
      console.log('extractedFields', extractedFields);
      const emailWithFields = {
        ...email,
        extractedFields,
      };
      emailsWithExtractedCustomerFields.push(emailWithFields);
    } catch (error) {
      logError('Field extraction from email failed:', {
        id: email.id,
        subject: email.subject,
        error,
      });
      continue;
    }
  }

  // Sort emails by timestamp
  emailsWithExtractedCustomerFields.sort(
    (a, b) =>
      new Date(b.receivedDateTime).getTime() -
      new Date(a.receivedDateTime).getTime()
  );

  // Transform to Email type
  const transformedEmails = emailsWithExtractedCustomerFields.map((email) => ({
    id: email.id,
    sender: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
    subject: email.subject,
    text: email.extractedFields.message,
    timestamp: email.receivedDateTime,
    isRead: email.isRead,
    client: filters.client === 'all' ? 'unknown' : filters.client,
    fields: email.extractedFields,
  }));

  console.log('transformedEmails', transformedEmails);

  // Calculate pagination
  const total = transformedEmails.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEmails = transformedEmails.slice(startIndex, endIndex);

  return {
    emails: paginatedEmails,
    total,
    page,
    pageSize,
  };
}
