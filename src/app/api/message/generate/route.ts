import axios from 'axios';
import { openai } from '@/lib/openai';
import { logInfo, logError } from '@/lib/logger';

export async function POST(req: Request) {
  const { text, vorname, nachname, anrede, clientName } = await req.json();
  const clientData = { vorname, nachname, anrede };

  if (!text) {
    logError('No text provided to analyze');
    return Response.json({ error: 'No text provided' }, { status: 400 });
  }

  logInfo('Starting message analysis:', {
    userMessage: text,
    clientData: {
      vorname,
      nachname,
      anrede,
    },
  });

  // Anonymize text first and then classify the anonymized text
  const { anonymized_text, replacements } = await anonymizeText(text);

  try {
    // Only generate response if it's a complaint about being left behind
    let finalResponse = null;
    const aiResponse = await processTextWithAi(
      anonymized_text,
      replacements,
      clientData,
      clientName
    );
    if (!aiResponse) {
      logError('AI response generation failed', {
        anonymized_text,
        clientData,
      });
      return Response.json({ error: 'Error in GPT processing' });
    }

    logInfo('AI response generated successfully:', {
      originalMessage: text,
      aiResponse,
      clientData,
    });

    finalResponse = deAnonymizeText(aiResponse, replacements);
    logInfo('Final response prepared:', {
      finalResponse,
      clientData,
    });

    return Response.json({
      finalResponse,
      anonymized_text,
      replacements,
    });
  } catch (error: any) {
    logError('Error in text classification:', { error: error?.message });
    return Response.json({ error: 'Classification failed' }, { status: 500 });
  }
}
