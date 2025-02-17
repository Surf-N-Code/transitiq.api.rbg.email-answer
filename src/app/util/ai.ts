import { openai } from '@/lib/openai';
import { OpenAIConfig } from '@/types';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import fs from 'fs';
import path from 'path';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';

const DEFAULT_CONFIG: OpenAIConfig = {
  model: 'gpt-4',
  temperature: 1,
  maxTokens: 2000,
};

interface AnalysisFile {
  client: string;
  startTime: string;
  emails: any[];
  analysis: any[];
  allTopics: Set<string>;
  metadata: {
    total: number;
    page: number;
    pageSize: number;
  };
}

let currentAnalysisFile: AnalysisFile | null = null;
let currentFilePath: string | null = null;

/**
 * Initializes a new analysis file for a batch of emails
 */
export function initializeAnalysisFile(metadata: {
  client: string;
  total: number;
  page: number;
  pageSize: number;
}): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `email-analysis-${metadata.client}-${timestamp}.json`;
  const dirPath = path.join(process.cwd(), 'analysis-results');
  currentFilePath = path.join(dirPath, filename);

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  currentAnalysisFile = {
    client: metadata.client,
    startTime: new Date().toISOString(),
    emails: [],
    analysis: [],
    allTopics: new Set<string>(),
    metadata: {
      total: metadata.total,
      page: metadata.page,
      pageSize: metadata.pageSize,
    },
  };

  // Write initial file structure
  fs.writeFileSync(
    currentFilePath,
    JSON.stringify(
      {
        ...currentAnalysisFile,
        allTopics: Array.from(currentAnalysisFile.allTopics),
      },
      null,
      2
    ),
    'utf-8'
  );

  return currentFilePath;
}

/**
 * Appends a single email analysis to the current analysis file
 */
export async function appendAnalysisResult(
  email: any,
  analysisResult: any
): Promise<void> {
  if (!currentAnalysisFile || !currentFilePath) {
    throw new Error('Analysis file not initialized');
  }

  // Update in-memory structure
  currentAnalysisFile.emails.push(email);
  currentAnalysisFile.analysis.push(analysisResult);
  currentAnalysisFile.allTopics.add(analysisResult.analysis.topic);

  // Write updated file
  await fs.promises.writeFile(
    currentFilePath,
    JSON.stringify(
      {
        ...currentAnalysisFile,
        lastUpdated: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf-8'
  );
}

/**
 * Finalizes the analysis file and returns its path
 */
export async function finalizeAnalysisFile(): Promise<string> {
  if (!currentAnalysisFile || !currentFilePath) {
    throw new Error('Analysis file not initialized');
  }

  // Add completion timestamp
  const finalContent = {
    ...currentAnalysisFile,
    allTopics: Array.from(currentAnalysisFile.allTopics),
    completedAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(
    currentFilePath,
    JSON.stringify(finalContent, null, 2),
    'utf-8'
  );

  const filePath = currentFilePath;

  // Reset state
  currentAnalysisFile = null;
  currentFilePath = null;

  return filePath;
}

/**
 * Makes a call to OpenAI's chat completion API with configurable parameters
 * @param prompt The main prompt/question to send to the API
 * @param config Optional configuration for the API call
 * @returns The response text from the API
 * @throws Error if the API call fails
 */
export async function makeAICall(
  prompt: string,
  config: OpenAIConfig = {}
): Promise<string> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const messages: ChatCompletionMessageParam[] = [];

  if (finalConfig.systemPrompt) {
    messages.push({
      role: 'system',
      content: finalConfig.systemPrompt,
    });
  }

  messages.push({
    role: 'user',
    content: prompt,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: finalConfig.model!,
      messages,
      temperature: finalConfig.temperature!,
      max_tokens: finalConfig.maxTokens!,
      ...(finalConfig.responseSchema && {
        response_format: zodResponseFormat(finalConfig.responseSchema, 'event'),
      }),
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    return responseContent;
  } catch (error: any) {
    throw new Error(`AI call failed: ${error.message}`);
  }
}
