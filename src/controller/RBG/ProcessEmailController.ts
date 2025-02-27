import { askForConfirmation } from '@/lib/util';
import express, { Request, Response } from 'express';
import { EmailHandler } from '../EmailHandler';
import { logError, logInfo } from '@/lib/logger';
import { generateEmailResponse } from '../generateEmailResponseHandler';
import { ExtractMessageFromEmailError } from '@/exceptions/ExtractMessageFromEmailError';
import { EmailCategorizationError } from '@/exceptions/EmailCategorizationError';
import { AiAnswerGenerationError } from '@/exceptions/AiAnswerGenerationError';
import { SendEmailError } from '@/exceptions/SendEmailError';
import { Client } from '@/types/email';
import { GraphClient } from '@/lib/graph-client';
import { classifyText } from '@/actions';

export class ProcessEmailController {
  static async getEmails(req: Request, res: Response) {
    const graphClient = new GraphClient(process.env.INBOX_TO_PROCESS!);
    try {
      const client = (req.query.client as Client | 'all') || 'rbg';
      const unreadOnly = req.query.unreadOnly === 'true' || true;
      const page = parseInt((req.query.page as string) || '1');
      const pageSize = parseInt((req.query.pageSize as string) || '10');

      const emails = await graphClient.getEmails({
        client,
        unreadOnly,
        skip: (page - 1) * pageSize,
        top: pageSize,
      });

      res.json(emails);
    } catch (error) {
      console.error('Error fetching emails:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const graphClient = new GraphClient(process.env.INBOX_TO_PROCESS!);
      const { id } = req.params;
      await graphClient.markAsRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking email as read:', error);
      res.status(500).json({ error: 'Failed to mark email as read' });
    }
  }

  static async classifyEmail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Email text is required' });
      }

      const classification = await classifyText(text);
      res.json({ classification });
    } catch (error) {
      console.error('Error classifying email:', error);
      res.status(500).json({ error: 'Failed to classify email' });
    }
  }

  static async processEmails(req: Request, res: Response) {
    try {
      const {
        inboxToProcess,
        emailFromAddressToProcess,
        toRecipients,
        ccRecipients,
        nonCategoryRecipients,
      } = req.body;

      const confirmed = await askForConfirmation(
        inboxToProcess,
        toRecipients,
        ccRecipients,
        nonCategoryRecipients
      );

      if (!confirmed) {
        return res.status(200).json({ message: 'Operation cancelled by user' });
      }

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
      return res.json({ success: true });
    } catch (error: any) {
      console.error('Error in POST handler:', error?.message);
      return res.status(500).json({
        error: error?.message || 'An error occurred',
      });
    }
  }
}
