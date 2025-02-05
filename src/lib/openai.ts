import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
console.log('openai api key:', process.env.OPENAI_API_KEY);
