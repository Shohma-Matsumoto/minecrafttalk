import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompt';
import { parseLLMResponse, type LLMResponse } from './commands';

type Provider = 'ollama' | 'openai' | 'gemini' | 'claude';

const PROVIDER_DEFAULTS: Record<Provider, { baseURL?: string; model: string; apiKey?: string }> = {
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'qwen2.5:7b', apiKey: 'ollama' },
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.0-flash' },
  claude: { model: 'claude-sonnet-4-20250514' },
};

const provider = (process.env.LLM_PROVIDER || 'ollama') as Provider;

if (!PROVIDER_DEFAULTS[provider]) {
  throw new Error(`未対応のプロバイダーです: ${provider} (対応: ollama, openai, gemini, claude)`);
}

const defaults = PROVIDER_DEFAULTS[provider];
const model = process.env.LLM_MODEL || defaults.model;

async function callClaude(userMessage: string): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.LLM_API_KEY,
    ...(process.env.LLM_BASE_URL && { baseURL: process.env.LLM_BASE_URL }),
  });

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.1,
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('LLMからの応答が空でした');
  }
  return block.text;
}

async function callOpenAICompatible(userMessage: string): Promise<string> {
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL || defaults.baseURL,
    apiKey: process.env.LLM_API_KEY || defaults.apiKey || '',
  });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLMからの応答が空でした');
  }
  return content;
}

export async function translateToCommands(userMessage: string): Promise<LLMResponse> {
  const content = provider === 'claude'
    ? await callClaude(userMessage)
    : await callOpenAICompatible(userMessage);

  return parseLLMResponse(content);
}
