import { EmailHandler } from '@/controller/EmailHandler';
import { EmailFields } from '@/types/email';
import dotenv from 'dotenv';
import { generateEmailResponse } from '@/controller/generateEmailResponseHandler';
import { logInfo, logError } from '@/lib/logger';
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
  console.log('ENV:', {
    nodeEnv: process.env.NODE_ENV,
    hasKey: !!process.env.OPENAI_API_KEY,
    keyPrefix: process.env.OPENAI_API_KEY?.slice(0, 3),
    openaiApiKey: process.env.OPENAI_API_KEY,
  });

  const emailHandler = new EmailHandler();
  await emailHandler.initializeToken();
  emailHandler.setInboxToProcess(inboxToProcess);
  const emails = await emailHandler.crawlUnreadEmails();
  for (const email of emails) {
    try {
      logInfo(`Start processing email`, {
        email: email.id,
        subject: email.subject,
      });
      await generateEmailResponse(
        emailHandler,
        email,
        inboxToProcess,
        toRecipients,
        ccRecipients,
        nonCategoryRecipients
      );
    } catch (error) {
      if (error instanceof ExtractMessageFromEmailError) {
        logError('ExtractMessageFromEmailError:', { error });
      } else if (error instanceof EmailCategorizationError) {
        logError('EmailCategorizationError:', { error });
      } else if (error instanceof AiAnswerGenerationError) {
        logError('AiAnswerGenerationError:', { error });
      } else if (error instanceof SendEmailError) {
        logError('SendEmailError:', { error });
      } else {
        logError('Unknown error:', { error });
      }

      // All Emails with problems should remain unread
      continue;
    }

    try {
      await emailHandler.markEmailAsRead(email.id);
      logInfo(
        `Email marked as read with id: ${email.id} and subject: ${email.subject}`
      );
    } catch (error) {
      logError('Failed to mark email as read:', {
        emailId: email.id,
        error,
      });
    }
  }
}
