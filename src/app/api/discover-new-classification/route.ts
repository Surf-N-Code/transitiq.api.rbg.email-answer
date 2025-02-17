import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@/types/email';
import { fetchEmails } from '@/app/actions/actions';
import {
  makeAICall,
  initializeAnalysisFile,
  appendAnalysisResult,
  finalizeAnalysisFile,
} from '@/app/util/ai';
import { EmailAnalysis, EmailBatchAnalysisResult } from '@/types';
import { logError, logInfo } from '@/lib/logger';

const ANALYSIS_SYSTEM_PROMPT = `Sie sind ein Experte für die Analyse von Kundenanfragen bei einem öffentlichen Verkehrsunternehmen. Ihre Aufgabe ist es, Kunden-E-Mails zu analysieren und deren Hauptthemen sowie Kernpunkte zu identifizieren.

Konzentrieren Sie sich auf die Identifizierung spezifischer verkehrsbezogener Themen. Beispiele könnten sein:
- "Beschwerde über nicht erfolgte Mitnahme an der Haltestelle"
- "Beschwerde über verschmutzte Fahrzeuge"
- "Erstattungsantrag wegen Verspätung"
- "Anfrage zu Fahrplaninformationen"
- "Beschwerde über Mitarbeiterverhalten"
- "Nachfrage zu verlorenen Gegenständen"

Es gibt weitere Kategorien und Themen. Bitte erweitern Sie die Liste, wenn Sie neue Themen identifizieren.

Seien Sie präzise und einheitlich bei der Themenbenennung. Erstellen Sie bei Bedarf neue Themen basierend auf dem E-Mail-Inhalt.

Geben Sie für jede E-Mail Ihre Analyse im folgenden JSON-Format aus:
{
  "mainPoints": ["point1", "point2"],  // 2-3 Hauptpunkte aus der Nachricht
  "topic": "specific topic",           // Das Hauptthema/die Kategorie, die diese E-Mail am besten beschreibt
  "priority": "high|medium|low"        // Priorität basierend auf Dringlichkeit und Auswirkung
}`;

async function analyzeEmailContent(emailText: string): Promise<EmailAnalysis> {
  const response = await makeAICall(emailText, {
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 200,
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
  });

  try {
    return JSON.parse(response) as EmailAnalysis;
  } catch (error) {
    throw new Error('Failed to parse AI response as EmailAnalysis');
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const client = searchParams.get('client') as Client | 'all';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    const response = await fetchEmails({
      client,
      unreadOnly,
      page,
      pageSize,
    });

    // Initialize analysis file
    const filePath = initializeAnalysisFile({
      client,
      total: response.total,
      page,
      pageSize,
    });
    logInfo('Analysis file initialized for number of emails:', {
      filePath,
      total: response.total,
    });

    // Analyze each email
    const analysisResults: EmailBatchAnalysisResult[] = [];
    const uniqueTopics = new Set<string>();

    for (const email of response.emails) {
      try {
        const analysis = await analyzeEmailContent(email.text);
        uniqueTopics.add(analysis.topic);

        const analysisResult = {
          emailId: email.id,
          analysis,
          allTopics: Array.from(uniqueTopics),
        };

        analysisResults.push(analysisResult);

        // Write each result to file immediately
        await appendAnalysisResult(email, analysisResult);
        logInfo('Analysis result appended for email:', { emailId: email.id });
      } catch (error) {
        logError('Email analysis failed:', {
          id: email.id,
          subject: email.subject,
          error,
        });
      }
    }

    // Finalize the analysis file
    try {
      const finalFilePath = await finalizeAnalysisFile();
      logInfo('Analysis file finalized:', { finalFilePath });
    } catch (error) {
      logError('Failed to finalize analysis file:', { error });
    }

    return NextResponse.json({
      emails: response.emails,
      total: response.total,
      page,
      pageSize,
      analysis: analysisResults,
      allTopics: Array.from(uniqueTopics),
    });
  } catch (error) {
    console.error('Error processing emails:', error);
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500 }
    );
  }
}
