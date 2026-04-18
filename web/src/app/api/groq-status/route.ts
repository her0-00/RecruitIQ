import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'groq/compound',
  'meta-llama/llama-4-scout-17b-16e-instruct'
];

export async function POST(req: Request) {
  try {
    const { api_key } = await req.json();
    const groqKey = api_key || process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'Missing Groq API Key' }, { status: 400 });
    }

    const groq = new Groq({ apiKey: groqKey });
    const results = await Promise.all(
      GROQ_MODELS.map(async (model) => {
        try {
          const startTime = Date.now();
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Hi' }],
              max_tokens: 5
            })
          });
          
          const latency = Date.now() - startTime;
          const data = await response.json();
          
          // Extract rate limit headers
          const tokensRemaining = response.headers.get('x-ratelimit-remaining-tokens');
          const tokensLimit = response.headers.get('x-ratelimit-limit-tokens');
          const requestsRemaining = response.headers.get('x-ratelimit-remaining-requests');
          const requestsLimit = response.headers.get('x-ratelimit-limit-requests');
          const resetTokens = response.headers.get('x-ratelimit-reset-tokens');
          const resetRequests = response.headers.get('x-ratelimit-reset-requests');
          
          if (!response.ok) {
            const isDecommissioned = response.status === 400 && data.error?.message?.includes('decommissioned');
            const isRateLimit = response.status === 429;
            
            return {
              model,
              status: isDecommissioned ? 'decommissioned' : isRateLimit ? 'rate-limited' : 'error',
              error: data.error?.message || 'Unknown error',
              tokensRemaining,
              tokensLimit,
              requestsRemaining,
              resetTime: resetTokens || resetRequests
            };
          }
          
          return {
            model,
            status: 'active',
            tokensRemaining: tokensRemaining || 'N/A',
            tokensLimit: tokensLimit || 'N/A',
            requestsRemaining: requestsRemaining || 'N/A',
            requestsLimit: requestsLimit || 'N/A',
            resetTime: resetTokens || 'N/A',
            latency: `${latency}ms`
          };
        } catch (err: any) {
          return {
            model,
            status: 'error',
            error: err?.message?.substring(0, 150) || 'Network error'
          };
        }
      })
    );

    return NextResponse.json({ models: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
