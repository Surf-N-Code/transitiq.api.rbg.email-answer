import { EmailHandler } from '@/controller/EmailHandler';
import { EmailFields } from '@/types/email';
import { logError, logInfo } from '@/lib/logger';
import { classifyText, anonymizeText, aiResponse } from '@/app/actions/actions';
import { deAnonymizeText, getPlaceholderKeys } from '@/lib/anonymization';

export async function POST(req: Request) {
  const { text, vorname, nachname, anrede, clientName } = await req.json();
  const clientData = { vorname, nachname, anrede, message: text, email: '' };

  if (!text) {
    logError('No text provided to analyze');
    return Response.json({ error: 'No text provided' }, { status: 400 });
  }

  const anonymizedText = await anonymizeText(text);
  const placeholders = getPlaceholderKeys(anonymizedText.replacements);

  let emailReply: string | null = null;
  emailReply = await aiResponse(
    anonymizedText.anonymized_text,
    placeholders,
    clientData,
    clientName
  );

  if (!emailReply) {
    logError('Ai answer generation failed for email');
    throw new Error('Ai answer generation failed');
  }

  const deAnonymizedEmailReply = deAnonymizeText(
    emailReply,
    anonymizedText.replacements
  );

  return Response.json({
    text: deAnonymizedEmailReply,
  });
}
