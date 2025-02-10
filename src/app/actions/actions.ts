'use server';

import { logError } from '@/lib/logger';
import { openai } from '@/lib/openai';
import { rbgClassifyEmail, rbgClassifyAndAnswer } from '@/prompts';
import { EmailFields } from '@/types/email';
import axios from 'axios';

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
  clientData: EmailFields,
  clientName: string
) {
  // Get just the placeholder keys
  let clientClose = '';
  if (clientName === 'rheinbahn') {
    clientClose = process.env.CLIENT_CLOSE_RBG || '';
  } else if (clientName === 'wsw') {
    clientClose = process.env.CLIENT_CLOSE_WSW || '';
  }

  console.log('clientData', clientData);
  const prompt = rbgClassifyAndAnswer(
    clientName,
    anonymized_text,
    anonymized_text_parts,
    clientData,
    clientClose
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
