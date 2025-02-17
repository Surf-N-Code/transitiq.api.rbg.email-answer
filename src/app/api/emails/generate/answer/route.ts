import { EmailHandler } from '@/controller/EmailHandler';
import { EmailFields } from '@/types/email';
import { logError, logInfo } from '@/lib/logger';
import { classifyText, anonymizeText, aiResponse } from '@/app/actions/actions';
import { deAnonymizeText, getPlaceholderKeys } from '@/lib/anonymization';
import { has } from 'node_modules/cheerio/dist/commonjs/api/traversing';

export async function POST(req: Request) {
  const { text, vorname, nachname, anrede, clientName } = await req.json();

  if (!text) {
    logError('No text provided to analyze');
    return Response.json({ error: 'No text provided' }, { status: 400 });
  }

  const anonymizedText = await anonymizeText(text);
  logInfo('Text & anonymized text:', { anonymizedText });
  const placeholders = getPlaceholderKeys(anonymizedText.replacements);
  logInfo('Placeholders:', { placeholders });

  let emailReply: string | null = null;
  const gender =
    anrede === 'Herr' ? 'male' : anrede === 'Frau' ? 'female' : 'neutral';
  const hasLastname = nachname !== '';
  emailReply = await aiResponse(
    anonymizedText.anonymized_text,
    placeholders,
    clientName,
    gender,
    hasLastname
  );

  if (!emailReply) {
    logError('Ai answer generation failed for email');
    throw new Error('Ai answer generation failed');
  }

  const deAnonymizedEmailReply = deAnonymizeText(
    emailReply,
    anonymizedText.replacements,
    nachname
  );
  logInfo('emailReply', { emailReply });
  logInfo('De-anonymized email reply:', { deAnonymizedEmailReply });

  return Response.json({
    text: deAnonymizedEmailReply,
  });
}
