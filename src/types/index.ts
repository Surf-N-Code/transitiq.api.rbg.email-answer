import { z } from 'zod';

export interface OpenAIConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseSchema?: z.ZodType<any>;
}

export interface EmailAnalysis {
  mainPoints: string[];
  topic: string; // The specific topic/category identified
  priority: 'high' | 'medium' | 'low';
}

export interface EmailBatchAnalysisResult {
  emailId: string;
  analysis: EmailAnalysis;
  allTopics: string[]; // List of all unique topics identified in the batch
}
