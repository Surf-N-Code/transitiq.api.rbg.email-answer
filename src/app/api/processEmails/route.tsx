import { EmailHandler } from '@/controller/EmailHandler';
import dotenv from 'dotenv';
import { generateEmailResponse } from '@/controller/generateEmailResponseHandler';
import { logInfo, logError } from '@/lib/logger';
import { createInterface } from 'readline';
import { stdin as input, stdout as output } from 'process';
import { ExtractMessageFromEmailError } from '@/exceptions/ExtractMessageFromEmailError';
import { EmailCategorizationError } from '@/exceptions/EmailCategorizationError';
import { SendEmailError } from '@/exceptions/SendEmailError';
import { AiAnswerGenerationError } from '@/exceptions/AiAnswerGenerationError';

dotenv.config();

const askForConfirmation = async (
  inboxToProcess: string,
  toRecipients: string[],
  ccRecipients: string[],
  nonCategoryRecipients: string[]
): Promise<boolean> => {
  const rl = createInterface({ input, output });

  try {
    const redText = `\x1b[31mAre you sure you want to process emails for ${inboxToProcess}? ${toRecipients.join(
      ', '
    )} ${ccRecipients?.join(', ')} ${nonCategoryRecipients?.join(', ')}\x1b[0m`;
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${redText} (y/n): `, resolve);
    });

    return answer.toLowerCase() === 'y';
  } finally {
    rl.close();
  }
};

export async function POST(request: Request) {
  try {
    const {
      inboxToProcess,
      emailFromAddressToProcess,
      toRecipients,
      ccRecipients,
      nonCategoryRecipients,
    } = await request.json();

    const confirmed = await askForConfirmation(
      inboxToProcess,
      toRecipients,
      ccRecipients,
      nonCategoryRecipients
    );

    if (!confirmed) {
      return Response.json({ message: 'Operation cancelled by user' });
    }

    await handleRequest(
      inboxToProcess,
      emailFromAddressToProcess,
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
  emailFromAddressToProcess: string,
  toRecipients: string[],
  ccRecipients?: string[],
  nonCategoryRecipients?: string[]
) {
  const emailHandler = new EmailHandler();
  await emailHandler.initializeToken();
  emailHandler.setInboxToProcess(inboxToProcess);
  emailHandler.setEmailFromAddressToProcess(emailFromAddressToProcess);
  const emails = await emailHandler.crawlUnreadEmails(true);
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
  logInfo('Finished processing emails');
}
