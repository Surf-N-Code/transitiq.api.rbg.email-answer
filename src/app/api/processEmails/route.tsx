import { anonymizeText, generateEmailReply } from '@/app/actions/actions';
import { deAnonymizeText, getPlaceholderKeys } from '@/lib/anonymization';
import { classifyText } from '@/app/actions/actions';
import { EmailHandler } from '@/lib/EmailHandler';
import { EmailFields } from '@/types/email';
import dotenv from 'dotenv';
const { logInfo, logError } = require('@/lib/logger');
dotenv.config();

export async function POST(request: Request) {
  try {
    const {
      inboxToProcess,
      toRecipients,
      ccRecipients,
      nonCategoryRecipients,
    } = await request.json();
    await handleRequest(
      inboxToProcess,
      toRecipients,
      ccRecipients,
      nonCategoryRecipients
    );
    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST handler:', error?.message);
    return Response.json(
      { error: error?.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

async function handleRequest(
  inboxToProcess: string,
  toRecipients: string[],
  ccRecipients?: string[],
  nonCategoryRecipients?: string[]
) {
  const emailHandler = new EmailHandler();
  await emailHandler.initializeToken();
  emailHandler.setInboxToProcess(inboxToProcess);
  const emails = await emailHandler.crawlUnreadEmails();
  for (const email of emails) {
    const emailErrorObject = {
      id: email.id,
      from: email.from.emailAddress.address,
      subject: email.subject,
      receivedDateTime: email.receivedDateTime,
    };
    let extractedFields: EmailFields;
    try {
      extractedFields = emailHandler.extractCustomerFieldsFromComplaintEmail(
        email.body.content
      );
    } catch (error) {
      logError('Field extraction from email failed:', emailErrorObject);
      continue;
    }

    let isComplaintAboutBeingLeftBehind = false;
    try {
      isComplaintAboutBeingLeftBehind = await classifyText(
        extractedFields.message
      );
    } catch (error) {
      // if classification fails, we should move to the next email and leave it unread to handle it later again
      logError('Email categorization failed:', emailErrorObject);
      continue;
    }

    logInfo('Is complaint about being left behind:', {
      isComplaintAboutBeingLeftBehind,
    });

    if (!isComplaintAboutBeingLeftBehind) {
      logInfo(
        'Email is not a complaint about being left behind and returned to kundendialog'
      );
      try {
        await emailHandler.sendEmail(
          inboxToProcess,
          `❌ Kategorie: Andere Kategorie -> ${email.subject}`,
          email.body.content,
          nonCategoryRecipients || []
        );
        logInfo(
          `Email sent successfully to non-category recipients: ${nonCategoryRecipients?.join(', ') || 'no recipients'}`
        );
      } catch (error: any) {
        logError('Failed to send email to non-category recipients:', {
          error,
        });
      }
      continue;
    }

    const anonymizedText = await anonymizeText(extractedFields.message);
    const placeholders = getPlaceholderKeys(anonymizedText.replacements);

    let emailReply: string | null = null;
    try {
      emailReply = await generateEmailReply(
        anonymizedText.anonymized_text,
        anonymizedText.replacements,
        extractedFields,
        'rheinbahn'
      );
    } catch (error) {
      logError('Ai answer generation failed for email:', emailErrorObject);
      continue;
    }

    if (!emailReply) {
      logError('Ai answer generation failed for email:', emailErrorObject);
      continue;
    }

    const deAnonymizedEmailReply = deAnonymizeText(
      emailReply,
      anonymizedText.replacements
    );

    // Log the original message and AI response
    logInfo('Processing complaint email:', {
      emailId: email.id,
      subject: email.subject,
      userMessage: extractedFields.message,
      aiResponse: emailReply,
      deAnonymizedEmailReply,
      isComplaintAboutBeingLeftBehind,
    });

    let content =
      `<strong>Kategorie:</strong>\nBeschwerde stehen gelassen` +
      `\n\n<strong>Kunden Beschwerde:</strong>\n${extractedFields.message}` +
      `\n\n<strong>KI Antwort:</strong>\n` +
      deAnonymizedEmailReply;

    try {
      await emailHandler.sendEmail(
        inboxToProcess,
        `✅ Kategorie: Beschwerde stehen gelassen -> ${email.subject}`,
        content,
        toRecipients,
        ccRecipients
      );

      logInfo(`Email response sent successfully for email id: ${email.id}`);
    } catch (error: any) {
      logError('Failed to send email response:', {
        emailId: email.id,
        error: error?.message,
        subject: email.subject,
      });
      throw error;
    }
    try {
      emailHandler.markEmailAsRead(email.id);
      logInfo(`Email marked as read: ${email.id}`);
    } catch (error) {
      logError('Failed to mark email as read:', {
        emailId: email.id,
        error,
      });
    }
  }
}
