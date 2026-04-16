import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const { cv_text, api_key } = await req.json();

    if (!cv_text) return NextResponse.json({ error: 'Missing CV text' }, { status: 400 });

    const groqKey = api_key || process.env.GROQ_API_KEY;
    if (!groqKey) return NextResponse.json({ error: 'Missing Groq API key' }, { status: 400 });

    const groq = new Groq({ apiKey: groqKey });

    const prompt = `Extract 3-5 job search keywords from this CV. Focus on job title, main skills, and domain.
Reply ONLY with keywords separated by commas, no explanation.

CV:
${cv_text.slice(0, 2000)}

Keywords:`;

    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    
    for (const model of models) {
      try {
        const res = await groq.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 50,
        });
        
        const keywords = res.choices[0]?.message?.content?.trim() || '';
        if (keywords) return NextResponse.json({ keywords });
      } catch (err) {
        continue;
      }
    }

    return NextResponse.json({ error: 'Failed to extract keywords' }, { status: 500 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 });
  }
}
