import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AIProvider = 'groq' | 'mistral' | 'google';

/**
 * Sanitize extracted PDF text before sending to Groq.
 * Removes braces/brackets used as decorators in app-generated PDFs
 * (TechGrid/Startup/Logistics themes use { [ ] } as section markers).
 */
function sanitizeCvText(text: string): string {
  return text
    .replace(/(?<!\w)[{}\[\]](?!\w)/g, '')
    .replace(/\/\//g, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .trim();
}

/**
 * Extract the first valid, complete JSON object from a string.
 * Works even if the model outputs preamble text before the JSON.
 * Strategy: find the first '{', then find the matching closing '}'
 * by tracking brace depth, accounting for strings.
 */
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
        const jsonStr = text.slice(start, i + 1);
        return JSON.parse(jsonStr);
      }
    }
  }
  throw new Error('Incomplete JSON object in model response');
}

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct'
];

const MISTRAL_MODELS = [
  'ministral-8b-latest',       // OPTIMAL: rapide + précis pour parsing CV
  'ministral-3b-latest',       // Ultra rapide fallback
  'mistral-small-latest',      // Qualité supérieure si besoin
  'mistral-large-latest',      // Puissance maximale (rare)
  'open-mistral-nemo'          // Gratuit fallback
];

const GOOGLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest'
];

async function callGoogle(
  apiKey: string,
  system: string,
  userMsg: string,
  label: string,
  timeoutMs: number = 30000
): Promise<{ data: any; model: string }> {
  let lastError: any;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  for (const modelName of GOOGLE_MODELS) {
    try {
      console.log(`[${label}] Trying Google model: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });
      
      const prompt = `${system}\n\n${userMsg}`;
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )
      ]);
      
      const response = result.response;
      const raw = response.text();
      
      if (!raw) {
        console.warn(`[${label}][${modelName}] Empty response, trying next...`);
        lastError = new Error('Empty response');
        continue;
      }
      
      const rawText = typeof raw === 'string' ? raw : JSON.stringify(raw);
      
      try {
        const parsed = JSON.parse(rawText);
        return { data: parsed, model: modelName };
      } catch (e: any) {
        try {
          return { data: extractJson(rawText), model: modelName };
        } catch (e2: any) {
          console.warn(`[${label}][${modelName}] JSON extraction failed:`, e2.message);
          lastError = new Error(`${label}: could not extract valid JSON from model response`);
          continue;
        }
      }
    } catch (err: any) {
      console.error(`[${label}][${modelName}] Error:`, err?.message || err);
      const msg = err?.message || '';
      if (msg === 'timeout' || msg.includes('quota') || msg.includes('429')) {
        console.warn(`[${label}] ${modelName} skipped, trying next...`);
        lastError = err;
        continue;
      }
      if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('404')) {
        console.warn(`[${label}] ${modelName} not available, trying next...`);
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  
  const isNetworkError = lastError?.message?.includes('fetch failed') || lastError?.message?.includes('ECONNREFUSED') || lastError?.message?.includes('ENOTFOUND');
  if (isNetworkError) {
    throw new Error('Erreur de connexion à Google AI. Vérifiez votre connexion internet ou essayez un autre provider.');
  }
  
  throw new Error(lastError?.message ?? 'Erreur Google AI. Vérifiez votre clé API sur aistudio.google.com/apikey');
}

async function callMistral(
  mistral: Mistral,
  system: string,
  userMsg: string,
  label: string,
  timeoutMs: number = 30000,
  maxTokens: number = 4096
): Promise<{ data: any; model: string }> {
  let lastError: any;
  for (const model of MISTRAL_MODELS) {
    try {
      console.log(`[${label}] Trying Mistral model: ${model}`);
      
      // Mistral SDK v2.x uses chat.stream() or chat.complete() differently
      const response = await Promise.race([
        mistral.chat.complete({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMsg }
          ],
          temperature: 0.1,
          maxTokens,
          responseFormat: { type: 'json_object' },
          safePrompt: false
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )
      ]);
      
      console.log(`[${label}][${model}] Response received`);
      
      // Extract content from Mistral response structure
      const raw = response?.choices?.[0]?.message?.content || '';
      
      if (!raw) {
        console.warn(`[${label}][${model}] Empty response, trying next...`);
        lastError = new Error('Empty response');
        continue;
      }
      
      try {
        // If responseFormat json_object is used, content is already JSON
        const rawText = typeof raw === 'string' ? raw : JSON.stringify(raw);
        const parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
        return { data: parsed, model };
      } catch (e: any) {
        // Fallback to extractJson if not pure JSON
        try {
          const rawText = typeof raw === 'string' ? raw : JSON.stringify(raw);
          return { data: extractJson(rawText), model };
        } catch (e2: any) {
          console.warn(`[${label}][${model}] JSON extraction failed:`, e2.message);
          lastError = new Error(`${label}: could not extract valid JSON from model response`);
          continue;
        }
      }
    } catch (err: any) {
      console.error(`[${label}][${model}] Error:`, err?.message || err);
      const msg = err?.message || '';
      const skip = err?.statusCode === 429 || msg.includes('429') || msg.includes('rate_limit') || msg === 'timeout';
      if (skip) {
        console.warn(`[${label}] ${model} skipped (${msg.includes('rate_limit') || err?.statusCode === 429 ? 'rate-limit' : 'timeout'}), trying next...`);
        lastError = err;
        continue;
      }
      // Don't throw on connection errors, try next model
      if (msg.includes('fetch failed') || msg.includes('ConnectionError') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
        console.warn(`[${label}] ${model} connection failed, trying next...`);
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  const isRateLimit = lastError?.statusCode === 429 || lastError?.message?.includes('rate_limit');
  const isNetworkError = lastError?.message?.includes('fetch failed') || lastError?.message?.includes('ECONNREFUSED') || lastError?.message?.includes('ENOTFOUND');
  
  if (isNetworkError) {
    throw new Error(
      'Erreur de connexion à Mistral AI. Vérifiez votre connexion internet ou essayez Groq à la place.'
    );
  }
  
  throw new Error(
    isRateLimit
      ? 'Quota Mistral épuisé sur tous les modèles. Attendez quelques minutes.'
      : (lastError?.message ?? 'Erreur Mistral AI. Vérifiez votre clé API sur console.mistral.ai')
  );
}

async function callGroq(
  groq: Groq,
  system: string,
  userMsg: string,
  label: string,
  timeoutMs: number = 30000,
  maxTokens: number = 4096
): Promise<{ data: any; model: string }> {
  let lastError: any;
  for (const model of GROQ_MODELS) {
    try {
      const completion = await Promise.race([
        groq.chat.completions.create({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMsg }
          ],
          model,
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )
      ]);
      const raw = (completion as any).choices[0]?.message?.content || '';
      try {
        return { data: extractJson(raw), model };
      } catch (e: any) {
        console.warn(`[${label}][${model}] JSON extraction failed, trying next model...`);
        lastError = new Error(`${label}: could not extract valid JSON from model response`);
        continue;
      }
    } catch (err: any) {
      const msg = err?.message || '';
      const skip = err?.status === 429 || msg.includes('429') || msg.includes('rate_limit')
        || (err?.status === 400 && msg.includes('decommissioned'))
        || msg === 'timeout';
      if (skip) {
        console.warn(`[${label}] ${model} skipped (${msg.includes('rate_limit') || err?.status === 429 ? 'rate-limit' : msg === 'timeout' ? 'timeout' : 'decommissioned'}), trying next...`);
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  const isRateLimit = lastError?.status === 429 || lastError?.message?.includes('rate_limit');
  throw new Error(
    isRateLimit
      ? 'Quota Groq épuisé sur tous les modèles. Attendez quelques minutes ou upgradez votre plan sur console.groq.com.'
      : (lastError?.message ?? 'All models failed')
  );
}

export async function POST(req: Request) {
  try {
    const { cv_text, job_desc, api_key, boost_mode, lang, ai_provider } = await req.json();
    const provider: AIProvider = ai_provider || 'groq';
    const outputLang = lang === 'en' ? 'English' : 'French';

    if (!cv_text) {
      return NextResponse.json({ error: 'Missing cv_text' }, { status: 400 });
    }

    const apiKeyToUse = api_key || (provider === 'groq' ? process.env.GROQ_API_KEY : provider === 'mistral' ? process.env.MISTRAL_API_KEY : process.env.GOOGLE_API_KEY);
    if (!apiKeyToUse) {
      return NextResponse.json({ error: `Missing ${provider === 'groq' ? 'Groq' : provider === 'mistral' ? 'Mistral' : 'Google'} API Key` }, { status: 400 });
    }

    const cleanCvText = sanitizeCvText(cv_text);

    // ── AGENT 1: CV Audit ────────────────────────────────────────────────────────────────────────────────
    const system1 = `You are a senior HR expert, work psychologist and ATS specialist.
Analyze the CV and job offer provided, then output a single JSON object.
CRITICAL: Base ALL analysis strictly on the actual CV content. For present_keywords, only list keywords that genuinely appear in the CV. For missing_keywords, only list keywords from the job offer that are truly absent from the CV.

PRO EXPERT RULES TO ENFORCE:
1. APPRENTICESHIP/ALTERNANCE: If the candidate mentions "alternance" or "apprentissage", check if they specified their "rythme" (e.g., 1 week / 3 weeks). If missing, flag as a CON in Formations.
2. IDENTITY: Check for full name, a professional title matching the target job, and a location (City + Zip).
3. MOBILITY: Check for mentions of "Permis B" / Driver's license if relevant.
4. QUANTIFIABLE IMPACT: Every experience MUST have at least one figure (number, %, $, €). If no numbers are found in an experience, flag lack of impact.
5. ONLINE BRAND: Check for a LinkedIn profile link. If missing, flag as a critical CON in Identité.
6. ORTHOGRAPHY: Specifically scan for typos, double spaces, and syntax errors. Provide a verdict.

Required fields:
- global_score: integer 0-100
- ats_pass_probability: integer 0-100
- ats_structure_risk: string "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"
- ats_structure_warning: string (2-3 sentences, null if LOW)
- salary_gap, salary_estimate, salary_potential: strings
- market_value_verdict: short striking phrase
- sections: object {resume, formation, experience, competences, impact_quantifie, formatage_dates, verbes_action, longueur} (0-10)
- job_match: object {missions, skills, seniority, culture} (0-100)
- psychology: object {pourquoi_ignore, pourquoi_sous_paye, personal_brand} (strings)
- ia_detector_score, international_compatibility: integers
- top_strength: string
- critical_fixes: array of 6 strings
- missing_keywords: array of 6 strings
- present_keywords: array of 5 strings
- detailed_report: array of exactly 5 objects: {
    "category": string (MUST be: "Identité & Projet Professionnel", "Mobilité & Coordonnées", "Expériences Professionnelles", "Formations & Études", "Audit Technique (Compétences & Layout)"),
    "pros": array of strings (the conform points),
    "cons": array of strings (the points to improve)
  }
- orthography_verdict: string (detailed qualitative feedback)
- benchmark: object {tech, finance, consulting, marketing, rh_legal} (0-100)
- grounding: object {top_strength, pourquoi_ignore, market_value} using {"text", "line"}

ATS STRUCTURE DETECTION:
- Canva/Design CVs with columns ALWAYS fail ATS parsing - warn the user explicitly
Output ONLY the raw JSON object. Do not add any explanation, markdown, or text outside the JSON.`;

    const cvTextLines = cleanCvText.split('\n');
    const cvWithHeaderMarks = cvTextLines.map((line, idx) => 
      idx < 10 ? `[HEADER: CONTACT INFO - DO NOT CITE FOR STRENGTHS] ${line}` : line
    ).join('\n');

    const prompt1 = `CV TEXT (Indexed):\n${cvWithHeaderMarks.substring(0, 6000)}\n\nJOB OFFER:\n${job_desc ? job_desc.substring(0, 3000) : 'Senior management — general analysis'}`;
    
    const agent1Result = provider === 'groq'
      ? await callGroq(new Groq({ apiKey: apiKeyToUse }), system1, prompt1, 'Agent1-Audit', 35000, 4096)
      : provider === 'mistral'
      ? await callMistral(new Mistral({ apiKey: apiKeyToUse }), system1, prompt1, 'Agent1-Audit', 35000, 4096)
      : await callGoogle(apiKeyToUse, system1, prompt1, 'Agent1-Audit', 35000);
    
    const analysisData = agent1Result.data;

    // ── AGENT 2: CV Rewrite ────────────────────────────────────────────────────────────────────────────
    const missingKws = (analysisData.missing_keywords || []).slice(0, 8).join(', ');
    const currentScore = analysisData.global_score || 0;

    const system2 = boost_mode
      ? `You are an aggressive CV optimizer and career coach. Your goal: make this CV the strongest possible candidate for the target job.
WRITE EVERYTHING IN ${outputLang.toUpperCase()} — including role titles, bullets, summary, skill category names, and education details. Translate any French content to ${outputLang}.

CRITICAL FIXES TO APPLY:
${(analysisData.critical_fixes || []).slice(0, 4).map((fix: string, i: number) => `${i + 1}. ${fix}`).join('\n')}

MISSING KEYWORDS TO INJECT: ${missingKws}

Rules:
- name: full name only (no title, no pipe, no year).
- title: rewrite to perfectly match the target role. In ${outputLang}. If candidate is seeking "alternance/apprentissage", ADD the rhythm (e.g., "1 semaine / 3 semaines") in title if present in CV.
- email, phone, location, linkedin, github: copy VERBATIM from CV. null if absent.
- summary: 3 powerful sentences in ${outputLang} positioning the candidate as the ideal hire. INJECT missing keywords naturally. If seeking alternance/apprentissage and rhythm is mentioned in CV, include it here.
- experiences: company and location VERBATIM. Translate role to ${outputLang}. STAY TRUTHFUL - do not invent accomplishments or exaggerate.
- period: FORCED DATE FORMAT. If FR: 'MM/AAAA' (03/2021). If EN: 'MM/YYYY' (03/2021). For current roles, use 'Depuis MM/AAAA' (FR) or 'MM/YYYY - Present' (EN).
- rewrite bullets aggressively in ${outputLang}. INJECT missing keywords naturally. DO NOT hallucinate - stay faithful to original content.
- education: degree/school VERBATIM. 
- year: FORCED DATE FORMAT. If FR: 'MM/AAAA' (or just AAAA if month absent). If EN: 'MM/YYYY' (or just YYYY).
- detail = specialization if present, else null.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}. Max 3 categories. Category names in ${outputLang}. INJECT all missing keywords.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}]. ONLY languages from CV. level label in ${outputLang}.
- certifications: array of strings. [] if none. ADD "Permis B" if driving relevant and missing.
- interests: array of strings (hobbies, etc.). [] if none.
-formatting: STRICTLY NO MARKDOWN. Do not use bold (**) or any other markdown characters in the values.


CRITICAL: experiences must be objects with bullets array, NOT strings. STAY TRUTHFUL - optimize wording but do not fabricate content.
Output a single raw JSON with ONLY: name, title, email, phone, location, linkedin, github, summary, experiences, education, skills, languages, certifications, interests.`
      : `You are an expert CV rewriter and career coach.
Goal: rewrite the candidate's CV to maximize match with the target job, while staying truthful.
WRITE EVERYTHING IN ${outputLang.toUpperCase()} — including role titles, bullets, summary, skill category names, and education details. Translate any French content to ${outputLang}.

Rules:
- name: full name only (no title, no pipe, no year).
- title: optimize to match the target role in ${outputLang}. Short, no sentences.
- email, phone, location, linkedin, github: copy VERBATIM from CV. null if absent.
- summary: 3 punchy sentences in ${outputLang}. 
- experiences: company and location VERBATIM. Translate role to ${outputLang}. 
- period: FORCED DATE FORMAT. If FR: 'MM/AAAA' (03/2021). If EN: 'MM/YYYY' (03/2021). For current roles, use 'Depuis MM/AAAA' (FR) or 'MM/YYYY - Present' (EN).
- rewrite bullets in ${outputLang}, stronger.
- education: degree/school VERBATIM. 
- year: FORCED DATE FORMAT. If FR: 'MM/AAAA' (or just AAAA if month absent). If EN: 'MM/YYYY' (or just YYYY).
- detail = specialization if present, else null.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}. Max 3 categories. Category names in ${outputLang}.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}]. ONLY languages from CV. level label in ${outputLang}.
- certifications: array of strings. [] if none.
- interests: array of strings (hobbies, etc.). [] if none.
- formatting: STRICTLY NO MARKDOWN. Do not use bold (**) or any other markdown characters in the values.

CRITICAL: experiences must be objects with bullets array, NOT strings.
Output a single raw JSON with ONLY: name, title, email, phone, location, linkedin, github, summary, experiences, education, skills, languages, certifications, interests.`;

    const prompt2 = `CV HEADER (first lines):
${cleanCvText.split('\n').filter(l => l.trim()).slice(0, 6).join('\n')}

FULL CV TEXT:
${cleanCvText.substring(0, 6000)}

TARGET JOB OFFER:
${job_desc ? job_desc.substring(0, 2000) : 'General optimization for senior tech/data roles'}

IMPORTANT: The output language is ${outputLang.toUpperCase()}. Translate ALL role titles, bullets, summary, and skill category names into ${outputLang}. Do NOT keep any French words in role titles or bullets.`;

    // Long-form generation: Boost timeout to 60s and tokens to 6000
    const agent2Result = provider === 'groq'
      ? await callGroq(new Groq({ apiKey: apiKeyToUse }), system2, prompt2, 'Agent2-Rewrite', 65000, 6000)
      : provider === 'mistral'
      ? await callMistral(new Mistral({ apiKey: apiKeyToUse }), system2, prompt2, 'Agent2-Rewrite', 65000, 6000)
      : await callGoogle(apiKeyToUse, system2, prompt2, 'Agent2-Rewrite', 65000);
    
    const llmFields = agent2Result.data;

    // Normalize skills: [{category, skills}] or [{name, skills}] -> {categories:[{name,items}]}
    let skills = llmFields.skills;
    if (Array.isArray(skills)) {
      skills = {
        categories: skills.map((s: any) => ({
          name: s.name ?? s.category ?? '',
          items: s.items ?? s.skills ?? []
        }))
      };
    } else if (!skills?.categories) {
      skills = { categories: [] };
    }
    // Ensure each category has name:string and items:string[]
    skills.categories = (skills.categories as any[]).map((cat: any) => ({
      name: typeof cat.name === 'string' ? cat.name : (cat.category ?? ''),
      items: Array.isArray(cat.items) ? cat.items.filter((i: any) => typeof i === 'string')
        : Array.isArray(cat.skills) ? cat.skills.filter((i: any) => typeof i === 'string') : []
    }));

    // Normalize languages: "French" -> {lang,level,level_num}
    let languages: any[] = llmFields.languages ?? [];
    if (languages.length > 0 && typeof languages[0] === 'string') {
      languages = languages.map((l: string) => ({ lang: l, level: '', level_num: 3 }));
    }
    const levelLabel = (n: number, isEn: boolean) => {
      const fr = ['', 'Notions', 'Élémentaire', 'Intermédiaire', 'Professionnel', 'Natif'];
      const en = ['', 'Beginner', 'Elementary', 'Intermediate', 'Professional', 'Native'];
      return (isEn ? en : fr)[Math.min(Math.max(n, 1), 5)] ?? '';
    };
    languages = languages.map((l: any) => {
      const num = typeof l.level_num === 'number' ? l.level_num : 3;
      const isEn = outputLang === 'English';
      const level = (typeof l.level === 'string' && l.level.trim()) ? l.level : levelLabel(num, isEn);
      return { lang: typeof l.lang === 'string' ? l.lang : '', level, level_num: num };
    });

    // Normalize experiences: strings → {role, company, period, location, bullets}
    const rawExp = Array.isArray(llmFields.experiences) ? llmFields.experiences : [];
    const experiences = rawExp.map((e: any) => {
      if (typeof e === 'string') {
        return { role: e, company: '', period: '', location: '', bullets: [] };
      }
      // Clean markdown from bullets
      const cleanBullets = Array.isArray(e.bullets) 
        ? e.bullets
            .filter((b: any) => typeof b === 'string')
            .map((b: string) => b.replace(/\*\*/g, '').replace(/\*/g, ''))
        : [];
      
      return {
        role: typeof e.role === 'string' ? e.role : '',
        company: typeof e.company === 'string' ? e.company : '',
        period: typeof e.period === 'string' ? e.period : (e.period ?? ''),
        location: typeof e.location === 'string' ? e.location : '',
        bullets: cleanBullets,
      };
    });

    // Normalize education: strings ÔåÆ {degree, school, year, detail}
    const rawEdu = Array.isArray(llmFields.education) ? llmFields.education : [];
    const education = rawEdu.map((e: any) => {
      if (typeof e === 'string') {
        return { degree: e, school: '', year: '', detail: null };
      }
      return {
        degree: typeof e.degree === 'string' ? e.degree : '',
        school: typeof e.school === 'string' ? e.school : '',
        year: typeof e.year === 'string' ? e.year : (e.year ?? ''),
        detail: typeof e.detail === 'string' ? e.detail : null,
      };
    });

    const interests = llmFields.interests || llmFields["centres d'intérêt"] || llmFields["centre d'intérêt"] || llmFields.hobbies || llmFields.loisirs || [];

    const cvDataStructured = {
      name:           String(llmFields.name || llmFields.nom || ''),
      title:          String(llmFields.title || llmFields.titre || '').replace(/\*\*/g, '').replace(/\*/g, ''),
      email:          typeof llmFields.email    === 'string' ? llmFields.email    : null,
      phone:          typeof llmFields.phone    === 'string' ? llmFields.phone    : null,
      location:       typeof llmFields.location === 'string' ? llmFields.location : null,
      linkedin:       typeof llmFields.linkedin === 'string' ? llmFields.linkedin : null,
      github:         typeof llmFields.github   === 'string' ? llmFields.github   : null,
      summary:        String(llmFields.summary || llmFields.résumé || llmFields.profil || '').replace(/\*\*/g, '').replace(/\*/g, ''),
      experiences,
      education,
      certifications: Array.isArray(llmFields.certifications) ? llmFields.certifications.filter((c: any) => typeof c === 'string').map((c: string) => c.replace(/\*\*/g, '').replace(/\*/g, '')) : [],
      skills,
      languages,
      interests: Array.isArray(interests) ? interests.filter((i: any) => typeof i === 'string').map((i: string) => i.replace(/\*\*/g, '').replace(/\*/g, '')) : [],
      score_before: currentScore,
      score_after:  Math.min(currentScore + 15, 100),
    };

    return NextResponse.json({
      ...analysisData,
      _cv_data: cvDataStructured,
      _models_used: {
        provider,
        agent1: agent1Result.model,
        agent2: agent2Result.model
      }
    });

  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    let errorMessage = error.message || 'AI Analysis Failed';
    const statusCode = error.statusCode || error.status || 500;
    
    // Detect provider from error context or default to 'unknown'
    let detectedProvider: AIProvider = 'groq';
    try {
      const body = await req.json();
      detectedProvider = body.ai_provider || 'groq';
    } catch {
      // If we can't parse the request, use default
    }
    
    // Add helpful context for common errors
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
      errorMessage = `Erreur de connexion à ${detectedProvider === 'groq' ? 'Groq' : detectedProvider === 'mistral' ? 'Mistral' : 'Google'} AI. Vérifiez votre connexion internet ou essayez un autre provider.`;
    } else if (errorMessage.includes('API Key') || errorMessage.includes('api_key')) {
      errorMessage = `Clé API ${detectedProvider === 'groq' ? 'Groq' : detectedProvider === 'mistral' ? 'Mistral' : 'Google'} invalide. Vérifiez votre clé sur ${detectedProvider === 'groq' ? 'console.groq.com' : detectedProvider === 'mistral' ? 'console.mistral.ai' : 'aistudio.google.com/apikey'}`;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      provider: detectedProvider,
      suggestion: detectedProvider === 'google' ? 'Essayez Groq ou Mistral' : detectedProvider === 'mistral' ? 'Essayez Groq ou Google' : 'Essayez Mistral ou Google'
    }, { status: statusCode });
  }
}
