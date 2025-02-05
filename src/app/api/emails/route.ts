import { NextRequest, NextResponse } from 'next/server';
import {
  Client,
  CrawledEmail,
  CrawledEmailWithExtractedCustomerFields,
} from '@/types/email';
import { EmailHandler } from '@/lib/EmailHandler';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const client = searchParams.get('client') as Client | 'all';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    let allEmails: CrawledEmail[] = [];
    let emailHandler: EmailHandler;
    emailHandler = new EmailHandler();
    await emailHandler.initializeToken();

    if (client === 'all' || client === 'rheinbahn') {
      emailHandler.setInboxToProcess(process.env.MSAL_USER_EMAIL_RBG!);
      allEmails = await emailHandler.crawlUnreadEmails();
    }

    if (client === 'all' || client === 'wsw') {
      emailHandler.setInboxToProcess(process.env.MSAL_USER_EMAIL_WSW!);
      allEmails = await emailHandler.crawlUnreadEmails();
    }

    let emailsWithExtractedCustomerFields: CrawledEmailWithExtractedCustomerFields[] =
      [];
    for (const email of allEmails) {
      try {
        const extractedFields =
          emailHandler.extractCustomerFieldsFromComplaintEmail(
            email.body.content
          );
        const emailWithFields = {
          ...email,
          text: extractedFields.message,
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

    // Calculate pagination
    const total = emailsWithExtractedCustomerFields.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEmails = emailsWithExtractedCustomerFields.slice(
      startIndex,
      endIndex
    );

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
