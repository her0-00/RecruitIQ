import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';
import { GoogleGenerativeAI } from '@google/generative-ai';

type AIProvider = 'groq' | 'mistral' | 'google';

/**
 * Sanitize extracted PDF text before sending to LLM.
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
 * Extract the first valid JSON object from a string.
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
  'llama-3.1-8b-instant',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct'
];

const MISTRAL_MODELS = [
  'ministral-8b-latest',
  'mistral-small-latest',
  'mistral-large-latest',
  'open-mistral-nemo'
];

const GOOGLE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest'
];

async function callGoogle(apiKey: string, system: string, userMsg: string, label: string): Promise<{ data: any; model: string }> {
  const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
  const genAI = new GoogleGenerativeAI(cleanApiKey);
  const removeEmojis = (str: string) => str.replace(/[^\x00-\xFF]/g, '').replace(/\s+/g, ' ').trim();
  
  let lastError: any;
  for (const modelName of GOOGLE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      });
      const prompt = `${removeEmojis(system)}\n\n${removeEmojis(userMsg)}`;
      const result = await model.generateContent(prompt);
      const rawText = (await result.response).text();
      try {
        return { data: JSON.parse(rawText), model: modelName };
      } catch (e) {
        return { data: extractJson(rawText), model: modelName };
      }
    } catch (err: any) {
      console.warn(`[${label}] Google ${modelName} failed, trying next...`, err);
      lastError = err;
    }
  }
  throw lastError;
}

async function callMistral(apiKey: string, system: string, userMsg: string, label: string): Promise<{ data: any; model: string }> {
  const mistral = new Mistral({ apiKey: apiKey.trim() });
  let lastError: any;
  for (const model of MISTRAL_MODELS) {
    try {
      const response = await mistral.chat.complete({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
        temperature: 0.1,
        responseFormat: { type: 'json_object' }
      });
      const raw = response.choices?.[0]?.message?.content || '';
      const rawText = typeof raw === 'string' ? raw : JSON.stringify(raw);
      try {
        return { data: JSON.parse(rawText), model };
      } catch (e) {
        return { data: extractJson(rawText), model };
      }
    } catch (err: any) {
      console.warn(`[${label}] Mistral ${model} failed, trying next...`, err);
      lastError = err;
    }
  }
  throw lastError;
}

async function callGroq(apiKey: string, system: string, userMsg: string, label: string): Promise<{ data: any; model: string }> {
  const groq = new Groq({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
  let lastError: any;
  for (const model of GROQ_MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
        model,
        temperature: 0.1,
      });
      const raw = completion.choices[0]?.message?.content || '';
      return { data: extractJson(raw), model };
    } catch (err: any) {
      console.warn(`[${label}] Groq ${model} failed, trying next...`, err);
      lastError = err;
    }
  }
  throw lastError;
}

export async function performFullAnalysis(params: {
  cvText: string,
  jobDesc: string,
  apiKey: string,
  boostMode: boolean,
  lang: string,
  aiProvider: AIProvider
}) {
  const { cvText, jobDesc, apiKey, boostMode, lang, aiProvider } = params;
  const outputLang = lang === 'en' ? 'English' : 'French';
  const cleanCvText = sanitizeCvText(cvText);

  // --- AGENT 1: Audit ---
  const system1 = `You are a senior HR expert, work psychologist and ATS specialist.
Analyze the CV and job offer provided, then output a single JSON object.
CRITICAL: Base ALL analysis strictly on the actual CV content. For present_keywords, only list keywords that genuinely appear in the CV. For missing_keywords, only list keywords from the job offer that are truly absent from the CV.

PRO EXPERT RULES TO ENFORCE (CareerOps-inspired):
1. APPRENTICESHIP/ALTERNANCE: If the candidate mentions "alternance" or "apprentissage", check if they specified their "rythme" (e.g., 1 week / 3 weeks). If missing, flag as a CON in Formations.
2. IDENTITY: Check for full name, a professional title matching the target job, and a location (City + Zip).
3. MOBILITY: Check for mentions of "Permis B" / Driver's license if relevant.
4. QUANTIFIABLE IMPACT: Every experience MUST have at least one figure (number, %, $, €, time saved, users impacted). If no numbers are found in an experience, flag lack of impact.
5. ONLINE BRAND: Check for a LinkedIn profile link. If missing, flag as a critical CON in Identité.
6. ORTHOGRAPHY: Specifically scan for typos, double spaces, and syntax errors.
7. ATS STRUCTURE RISK: Detect multi-column layouts (Canva-style, sidebar designs). Warn explicitly.
8. DATE FORMAT CONSISTENCY: Check if dates follow consistent format (MM/YYYY).
9. KEYWORD DENSITY: Check if top 5 job offer keywords appear in the first 3 lines of the CV.

Required fields: global_score (0-100), ats_pass_probability, ats_structure_risk, ats_structure_warning, salary_gap, salary_estimate, salary_potential, market_value_verdict, sections, job_match, psychology, ia_detector_score, international_compatibility, top_strength, critical_fixes, missing_keywords, present_keywords, detailed_report, orthography_verdict, benchmark, grounding.
Output ONLY the raw JSON object.`;

  const prompt1 = `CV TEXT:\n${cleanCvText.substring(0, 7000)}\n\nJOB OFFER:\n${jobDesc ? jobDesc.substring(0, 3000) : 'Senior management — general analysis'}`;

  const agent1Func = aiProvider === 'groq' ? callGroq : aiProvider === 'mistral' ? callMistral : callGoogle;
  const agent1Result = await agent1Func(apiKey, system1, prompt1, 'Agent1-Audit');
  const analysisData = agent1Result.data;

  // --- AGENT 2: Rewrite ---
  const missingKws = (analysisData.missing_keywords || []).slice(0, 8).join(', ');
  const system2 = boostMode
    ? `You are an aggressive CV optimizer and career coach. Your goal: make this CV the strongest possible candidate for the target job.
WRITE EVERYTHING IN ${outputLang.toUpperCase()} — including role titles, bullets, summary, skill category names, and education details. Translate any French content to ${outputLang}.

CRITICAL FIXES TO APPLY:
${(analysisData.critical_fixes || []).slice(0, 4).map((fix: string, i: number) => `${i + 1}. ${fix}`).join('\n')}

MISSING KEYWORDS TO INJECT: ${missingKws}

KEYWORD INJECTION STRATEGY:
- ONLY reformulate existing experience with job offer vocabulary
- NEVER invent skills or accomplishments
- Examples: JD: "RAG pipelines" + CV: "LLM workflows" -> "RAG pipeline design and LLM orchestration"

Rules:
- name: full name only.
- title: rewrite to perfectly match the target role. 
- period: FORCED DATE FORMAT. MM/YYYY.
- bullets: rewrite aggressively in ${outputLang}. QUANTIFY IMPACT.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}. Category names in ${outputLang}.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}].
Output ONLY the raw JSON object.`
    : `You are an expert CV rewriter and career coach.
Goal: rewrite the candidate's CV to maximize match, while staying truthful.
WRITE EVERYTHING IN ${outputLang.toUpperCase()}.
Rules:
- name: full name only.
- title: optimize to match the target role.
- period: FORCED DATE FORMAT. MM/YYYY.
- bullets: rewrite in ${outputLang}, stronger.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}].
Output ONLY the raw JSON object.`;

  const prompt2 = `CV TEXT:\n${cleanCvText.substring(0, 7000)}\n\nTARGET JOB OFFER:\n${jobDesc ? jobDesc.substring(0, 2000) : 'General optimization'}`;

  const agent2Result = await agent1Func(apiKey, system2, prompt2, 'Agent2-Rewrite');
  const llmFields = agent2Result.data;

  // --- COMPREHENSIVE NORMALIZATION (Exact Port from route.ts) ---

  // Normalize skills
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
  skills.categories = (skills.categories || []).map((cat: any) => ({
    name: typeof cat.name === 'string' ? cat.name.replace(/\*\*/g, '').replace(/\*/g, '') : (cat.category ?? ''),
    items: Array.isArray(cat.items) 
      ? cat.items.filter((i: any) => typeof i === 'string').map((i: string) => i.replace(/\*\*/g, '').replace(/\*/g, ''))
      : Array.isArray(cat.skills) 
      ? cat.skills.filter((i: any) => typeof i === 'string').map((i: string) => i.replace(/\*\*/g, '').replace(/\*/g, '')) 
      : []
  }));

  // Normalize languages
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
    const level = (typeof l.level === 'string' && l.level.trim()) ? l.level.replace(/\*\*/g, '').replace(/\*/g, '') : levelLabel(num, isEn);
    return { 
      lang: typeof l.lang === 'string' ? l.lang.replace(/\*\*/g, '').replace(/\*/g, '') : '', 
      level, 
      level_num: num 
    };
  });

  // Normalize experiences
  const rawExp = Array.isArray(llmFields.experiences) ? llmFields.experiences : [];
  const experiences = rawExp.map((e: any) => {
    if (typeof e === 'string') return { role: e, company: '', period: '', location: '', bullets: [] };
    const cleanBullets = Array.isArray(e.bullets) 
      ? e.bullets.filter((b: any) => typeof b === 'string').map((b: string) => b.replace(/\*\*/g, '').replace(/\*/g, ''))
      : [];
    return {
      role: typeof e.role === 'string' ? e.role.replace(/\*\*/g, '').replace(/\*/g, '') : '',
      company: typeof e.company === 'string' ? e.company : '',
      period: typeof e.period === 'string' ? e.period : (e.period ?? ''),
      location: typeof e.location === 'string' ? e.location : '',
      bullets: cleanBullets,
    };
  });

  // Normalize education
  const rawEdu = Array.isArray(llmFields.education) ? llmFields.education : [];
  const education = rawEdu.map((e: any) => {
    if (typeof e === 'string') return { degree: e, school: '', year: '', detail: null };
    return {
      degree: typeof e.degree === 'string' ? e.degree.replace(/\*\*/g, '').replace(/\*/g, '') : '',
      school: typeof e.school === 'string' ? e.school : '',
      year: typeof e.year === 'string' ? e.year : (e.year ?? ''),
      detail: typeof e.detail === 'string' ? e.detail.replace(/\*\*/g, '').replace(/\*/g, '') : null,
    };
  });

  const interestsData = llmFields.interests || llmFields["centres d'intérêt"] || llmFields["centre d'intérêt"] || llmFields.hobbies || llmFields.loisirs || [];
  const interests = Array.isArray(interestsData) ? interestsData.filter((i: any) => typeof i === 'string').map((i: string) => i.replace(/\*\*/g, '').replace(/\*/g, '')) : [];

  const currentScore = analysisData.global_score || 0;

  const cvDataStructured = {
    name:           String(llmFields.name || llmFields.nom || ''),
    title:          String(llmFields.title || llmFields.titre || '').replace(/\*\*/g, '').replace(/\*/g, ''),
    email:          typeof llmFields.email    === 'string' ? llmFields.email    : null,
    phone:          typeof llmFields.phone    === 'string' ? llmFields.phone    : null,
    location:       typeof llmFields.location === 'string' ? llmFields.location : null,
    linkedin:       typeof llmFields.linkedin === 'string' ? llmFields.linkedin : null,
    github:         typeof llmFields.github   === 'string' ? llmFields.github   : null,
    portfolio:      typeof llmFields.portfolio === 'string' ? llmFields.portfolio : null,
    website:        typeof llmFields.website === 'string' ? llmFields.website : null,
    summary:        String(llmFields.summary || llmFields.résumé || llmFields.profil || '').replace(/\*\*/g, '').replace(/\*/g, ''),
    experiences,
    education,
    certifications: Array.isArray(llmFields.certifications) ? llmFields.certifications.filter((c: any) => typeof c === 'string').map((c: string) => c.replace(/\*\*/g, '').replace(/\*/g, '')) : [],
    skills,
    languages,
    interests,
    score_before: currentScore,
    score_after:  Math.min(currentScore + 15, 100),
  };

  return {
    ...analysisData,
    _cv_data: cvDataStructured,
    _models_used: {
      provider: aiProvider,
      agent1: agent1Result.model,
      agent2: agent2Result.model
    }
  };
}
