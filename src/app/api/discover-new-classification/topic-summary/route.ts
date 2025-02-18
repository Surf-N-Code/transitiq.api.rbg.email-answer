import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { makeAICall } from '@/app/util/ai';
import { logError, logInfo } from '@/lib/logger';
import { z } from 'zod';

interface AnalysisFileContent {
  allTopics: string[];
  startTime: string;
  metadata: {
    total: number;
  };
  emails: any[];
}

// Define the Zod schema for the clustering response
const CategorySchema = z.object({
  name: z.string(),
  description: z.string(),
  topics: z.array(z.string()),
});

const ClusteringResponseSchema = z.object({
  categories: z.array(CategorySchema),
});

const TOPIC_CLUSTERING_PROMPT = `Als Experte für die Analyse von Kundenanfragen im öffentlichen Nahverkehr ist Ihre Aufgabe, die vorhandenen Themen in sinnvolle Cluster zu gruppieren.

Analysieren Sie die gegebene Liste von Themen und:
1. Gruppieren Sie sie in logische Hauptkategorien
2. Geben Sie jeder Kategorie einen beschreibenden Namen
3. Ordnen Sie die Originalthemen den Kategorien zu

Beispiel für Kategorien:
- Betriebsstörungen und Verspätungen
- Kundenservice und Mitarbeiter
- Infrastruktur und Ausstattung
- Fahrplan und Information
- Sicherheit und Sauberkeit
- Tickets und Abrechnung

Geben Sie Ihre Analyse im folgenden Format zurück:
{
  "categories": [
    {
      "name": "Name der Hauptkategorie",
      "description": "Kurze Beschreibung der Kategorie",
      "topics": ["Originalthema 1", "Originalthema 2"]
    }
  ],
}`;

async function readAnalysisFile(
  filename: string
): Promise<AnalysisFileContent> {
  const filePath = path.join(process.cwd(), 'analysis-results', filename);
  const fileContent = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

async function clusterTopics(
  topics: string[]
): Promise<z.infer<typeof ClusteringResponseSchema>> {
  try {
    const response = await makeAICall(
      `Analyze and cluster these topics: ${JSON.stringify(topics)}`,
      {
        model: 'gpt-4o-mini-2024-07-18',
        temperature: 0,
        maxTokens: 4000,
        systemPrompt: TOPIC_CLUSTERING_PROMPT,
        responseSchema: ClusteringResponseSchema,
      }
    );

    return JSON.parse(response) as z.infer<typeof ClusteringResponseSchema>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError('AI response validation failed:', { error });
      throw new Error('AI response did not match expected schema');
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename parameter is required' },
        { status: 400 }
      );
    }

    // Read the analysis file
    const analysisData = await readAnalysisFile(filename);
    const topics = Array.from(new Set(analysisData.allTopics));

    logInfo('Analyzing topics from file:', {
      filename,
      topicCount: topics.length,
    });

    // Cluster the topics
    const clustering = await clusterTopics(topics);

    // Add additional metadata
    const response = {
      filename,
      analysisTimestamp: new Date().toISOString(),
      originalAnalysisTime: analysisData.startTime,
      clustering,
    };

    // Store the clustering results
    const clusteringFilename = filename.replace(
      'email-analysis',
      'topic-clustering'
    );
    const clusteringPath = path.join(
      process.cwd(),
      'analysis-results',
      clusteringFilename
    );
    await fs.promises.writeFile(
      clusteringPath,
      JSON.stringify(response, null, 2),
      'utf-8'
    );

    logInfo('Topic clustering completed and stored:', { clusteringPath });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error analyzing topics:', error);
    return NextResponse.json(
      { error: 'Failed to analyze topics' },
      { status: 500 }
    );
  }
}
