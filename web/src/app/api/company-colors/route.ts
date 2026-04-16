import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

function extractJson(text: string): any {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model response');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }
  throw new Error('Incomplete JSON object');
}

export async function POST(req: Request) {
  try {
    const { company_name, api_key } = await req.json();

    const cleanName = (typeof company_name === 'string' ? company_name : '').trim().slice(0, 50);
    const cleanKey = (typeof api_key === 'string' ? api_key : '').trim();

    if (!cleanName) {
      return NextResponse.json({ error: 'Missing company name' }, { status: 400 });
    }

    const groqKey = cleanKey || process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'Missing Groq API Key' }, { status: 400 });
    }

    // Diagnostic log for Render debugging
    console.log(`[BRAND-COLORS] Input: "${cleanName}" | Key length: ${groqKey.length}`);

    const groq = new Groq({ apiKey: groqKey });

    const combinedPrompt = `Senior Brand Designer Task:
Extract/predict official colors for "${cleanName}" and adapt for professional CV.
Return ONLY this JSON:
{
  "palettes": [
    {
      "name": "Variation Name",
      "colors": {"primary": "Hex", "secondary": "Hex", "accent": "Hex", "text": "Hex", "background": "Hex"}
    }
  ]
}
Generate 4 variations style: Institutional, Modern, Minimalist, Bold. No preamble. No explanation.`;

    const fallbackModels = ['moonshotai/kimi-k2-instruct', 'groq/compound', 'allam-2-7b'];
    let chatCompletion;
    let lastError;

    for (const model of fallbackModels) {
      try {
        console.log(`[BRAND-COLORS] Attempting with PREMIUM model: ${model}`);
        chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: `Senior Brand Designer Knowledge Retrieval: What are the primary, secondary and accent brand hex colors for "${cleanName}"? 
Adapt them for 4 DISTINCT professional CV palettes: 1. Institutional, 2. Minimalist, 3. Bold, 4. Modern Dark.
Return ONLY a valid JSON object: {"palettes": [{"name": "Style", "colors": {"primary": "#Hex", "secondary": "#Hex", "accent": "#Hex", "text": "#Hex", "background": "#Hex"}}]}.
IMPORTANT: JSON ONLY. No preamble. No thinking.`
            }
          ],
          model: model,
          temperature: 0.1,
          max_tokens: 1000,
        });
        break; // Success!
      } catch (err: any) {
        lastError = err;
        if (err.status === 429) {
          console.warn(`[BRAND-COLORS] Model ${model} rate limited, trying next...`);
          continue;
        }
        throw err; // Real error
      }
    }

    if (!chatCompletion) throw lastError;

    const content = (chatCompletion.choices[0]?.message?.content || '').trim();
    console.log('[DEBUG-API] Final model output:', content);

    // Simple cleanup for common hallucination: extra quotes around objects in arrays
    const cleanedContent = content
      .replace(/",\s*\{/g, ', {')
      .replace(/\}\s*,"/g, '}, ')
      .replace(/\[\s*"/g, '[')
      .replace(/"\s*\]/g, ']');

    try {
      const data = extractJson(cleanedContent);
      return NextResponse.json(data);
    } catch (e: any) {
      console.error('[CompanyColors] JSON Parse Error:', content);
      return NextResponse.json({ error: 'Failed to generate valid palettes', raw: content }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Company Colors Error:', error);
    return NextResponse.json({ error: error.message || 'API Failed' }, { status: 500 });
  }
}
