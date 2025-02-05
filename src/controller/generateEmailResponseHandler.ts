import { anonymizeText, classifyText, aiResponse } from '@/app/actions/actions';
import { extractStructuredInfoFromEmail } from '@/lib/extractStructuredInfoFromEmail';
import { logError, logInfo } from '@/lib/logger';
import { CrawledEmail, EmailFields } from '@/types/email';
import { EmailHandler } from './EmailHandler';
import { deAnonymizeText, getPlaceholderKeys } from '@/lib/anonymization';

export async function generateEmailResponse(
  emailHandler: EmailHandler,
  email: CrawledEmail,
  inboxToProcess: string,
  toRecipients: string[],
  ccRecipients?: string[],
  nonCategoryRecipients?: string[]
) {
  const emailErrorObject = {
    id: email.id,
    from: email.from.emailAddress.address,
    subject: email.subject,
    receivedDateTime: email.receivedDateTime,
  };

  let extractedFields: EmailFields;
  try {
    extractedFields = extractStructuredInfoFromEmail(email.body.content);
    logInfo('Extracted fields:', extractedFields);
  } catch (error) {
    throw new ExtractMessageFromEmailError(
      'Field extraction from email failed',
      new Error(JSON.stringify(emailErrorObject))
    );
  }

  let isComplaintAboutBeingLeftBehind = false;
  try {
    isComplaintAboutBeingLeftBehind = await classifyText(
      extractedFields.message
    );
    logInfo('Is complaint about being left behind:', {
      isComplaintAboutBeingLeftBehind,
    });
  } catch (error) {
    throw new EmailCategorizationError(
      'Email categorization failed',
      new Error(JSON.stringify(emailErrorObject))
    );
  }

  if (!isComplaintAboutBeingLeftBehind) {
    try {
      await emailHandler.sendEmail(
        inboxToProcess,
        `❌ Kategorie: Andere Kategorie -> ${email.subject}`,
        email.body.content,
        nonCategoryRecipients || []
      );
      logInfo(
        `Email sent to non-category recipients: ${(nonCategoryRecipients || []).join(', ')} with id: ${email.id} and subject: ${email.subject}`
      );
    } catch (error: any) {
      throw new SendEmailError(
        'Failed to send email to non-category recipients',
        new Error(JSON.stringify(emailErrorObject))
      );
    }
    return;
  }

  const anonymizedText = await anonymizeText(extractedFields.message);
  logInfo('Anonymized text:', anonymizedText);
  const placeholders = getPlaceholderKeys(anonymizedText.replacements);

  let emailReply: string | null = null;
  try {
    emailReply = await aiResponse(
      anonymizedText.anonymized_text,
      placeholders,
      extractedFields,
      'rheinbahn'
    );
    logInfo(`Ai response generated for email`, {
      email: email.id,
      subject: email.subject,
    });
  } catch (error) {
    throw new AiAnswerGenerationError(
      'Ai answer generation failed',
      new Error(JSON.stringify(emailErrorObject))
    );
  }

  if (!emailReply) {
    throw new AiAnswerGenerationError(
      'Ai answer generation failed',
      new Error(JSON.stringify(emailErrorObject))
    );
  }

  const deAnonymizedEmailReply = deAnonymizeText(
    emailReply,
    anonymizedText.replacements
  );

  // Log the original message and AI response
  logInfo('Deanonymized email reply:', {
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

    logInfo(`Email response sent successfully.`, {
      id: email.id,
      subject: email.subject,
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
