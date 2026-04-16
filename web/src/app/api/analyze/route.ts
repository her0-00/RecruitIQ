import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

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
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'moonshotai/kimi-k2-instruct',
  'qwen/qwen3-32b',
  'llama-3.1-8b-instant',
];

async function callGroq(
  groq: Groq,
  system: string,
  userMsg: string,
  label: string
): Promise<any> {
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
          max_tokens: 4096,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 25000)
        )
      ]);
      const raw = (completion as any).choices[0]?.message?.content || '';
      try {
        return extractJson(raw);
      } catch (e: any) {
        console.error(`[${label}][${model}] JSON extraction failed:`, raw.substring(0, 300));
        throw new Error(`${label}: could not extract valid JSON from model response`);
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
      ? 'Quota Groq ├®puis├® sur tous les mod├¿les. Attendez quelques minutes ou upgradez votre plan sur console.groq.com.'
      : (lastError?.message ?? 'All models failed')
  );
}

export async function POST(req: Request) {
  try {
    const { cv_text, job_desc, api_key, boost_mode, lang } = await req.json();
    const outputLang = lang === 'en' ? 'English' : 'French';

    if (!cv_text) {
      return NextResponse.json({ error: 'Missing cv_text' }, { status: 400 });
    }

    const groqKey = api_key || process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'Missing Groq API Key' }, { status: 400 });
    }

    const groq = new Groq({ apiKey: groqKey });
    const cleanCvText = sanitizeCvText(cv_text);

    // ÔöÇÔöÇ AGENT 1: CV Audit ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    const system1 = `You are a senior HR expert, work psychologist and ATS specialist.
Analyze the CV and job offer provided, then output a single JSON object.
CRITICAL: Base ALL analysis strictly on the actual CV content. For present_keywords, only list keywords that genuinely appear in the CV. For missing_keywords, only list keywords from the job offer that are truly absent from the CV.
Required fields:
- global_score: integer 0-100
- ats_pass_probability: integer 0-100
- salary_gap: string like "22%"
- salary_estimate: string like "45-55kÔé¼"
- salary_potential: string like "65-78kÔé¼"
- market_value_verdict: short striking phrase
- sections: object with integer values 0-10 for keys: resume, formation, experience, competences, impact_quantifie, formatage_dates, verbes_action, longueur
- job_match: object with integer values 0-100 for keys: missions, skills, seniority, culture
- psychology: object with string values for keys: pourquoi_ignore (2-3 sentences), pourquoi_sous_paye (2-3 sentences), personal_brand (1 sentence)
- ia_detector_score: integer 0-100
- international_compatibility: integer 0-100
- top_strength: string
- critical_fixes: array of exactly 6 strings
- missing_keywords: array of exactly 6 strings
- present_keywords: array of exactly 5 strings
- benchmark: object with integer values 0-100 for keys: tech, finance, consulting, marketing, rh_legal
Output ONLY the raw JSON object. Do not add any explanation, markdown, or text outside the JSON.`;

    const prompt1 = `CV:\n${cleanCvText.substring(0, 6000)}\n\nJOB OFFER:\n${job_desc ? job_desc.substring(0, 3000) : 'Senior management ÔÇö general analysis'}`;

    const analysisData = await callGroq(groq, system1, prompt1, 'Agent1-Audit');

    // ÔöÇÔöÇ AGENT 2: CV Rewrite ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    const missingKws   = (analysisData.missing_keywords || []).slice(0, 8).join(', ');
    const currentScore = analysisData.global_score || 0;

    const system2 = boost_mode
      ? `You are an aggressive CV optimizer and career coach. Your goal: make this CV the strongest possible candidate for the target job.
WRITE EVERYTHING IN ${outputLang.toUpperCase()} ÔÇö including role titles, bullets, summary, skill category names, and education details. Translate any French content to ${outputLang}.

Rules:
- name: full name only (no title, no pipe, no year).
- title: rewrite to perfectly match the target role. In ${outputLang}.
- email, phone, location, linkedin, github: copy VERBATIM from CV. null if absent.
- summary: 3 powerful sentences in ${outputLang} positioning the candidate as the ideal hire.
- experiences: company/period/location VERBATIM. Translate role to ${outputLang}. Rewrite bullets aggressively in ${outputLang}.
- education: degree/school/year VERBATIM. detail = specialization if present, else null.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}. Max 3 categories. Category names in ${outputLang}.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}]. ONLY languages from CV. level label in ${outputLang}.
- certifications: array of strings. [] if none.

CRITICAL: experiences must be objects with bullets array, NOT strings.
Output a single raw JSON with ONLY: name, title, email, phone, location, linkedin, github, summary, experiences, education, skills, languages, certifications.`
      : `You are an expert CV rewriter and career coach.
Goal: rewrite the candidate's CV to maximize match with the target job, while staying truthful.
WRITE EVERYTHING IN ${outputLang.toUpperCase()} ÔÇö including role titles, bullets, summary, skill category names, and education details. Translate any French content to ${outputLang}.

Rules:
- name: full name only (no title, no pipe, no year).
- title: optimize to match the target role in ${outputLang}. Short, no sentences.
- email, phone, location, linkedin, github: copy VERBATIM from CV. null if absent.
- summary: 3 punchy sentences in ${outputLang}. Weave in missing keywords naturally.
- experiences: company/period/location VERBATIM. Translate role to ${outputLang}. Rewrite bullets in ${outputLang}, stronger, with missing keywords where they fit.
- education: degree/school/year VERBATIM. detail = specialization if present, else null.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}. Max 3 categories. Category names in ${outputLang}.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}]. ONLY languages from CV. level label in ${outputLang}.
- certifications: array of strings. [] if none.

CRITICAL: experiences must be objects with bullets array, NOT strings.
Output a single raw JSON with ONLY: name, title, email, phone, location, linkedin, github, summary, experiences, education, skills, languages, certifications.`;

    const prompt2 = `CV HEADER (first lines):
${cleanCvText.split('\n').filter(l => l.trim()).slice(0, 6).join('\n')}

FULL CV TEXT:
${cleanCvText.substring(0, 6000)}

TARGET JOB OFFER:
${job_desc ? job_desc.substring(0, 2000) : 'General optimization for senior tech/data roles'}

Missing keywords to integrate: ${missingKws}
Weave these into bullets, summary, and skills where they fit the candidate's actual experience.

IMPORTANT: The output language is ${outputLang.toUpperCase()}. Translate ALL role titles, bullets, summary, and skill category names into ${outputLang}. Do NOT keep any French words in role titles or bullets.`;

    const llmFields = await callGroq(groq, system2, prompt2, 'Agent2-Rewrite');

    // Normalize skills: [{category, skills}] or [{name, skills}] ÔåÆ {categories:[{name,items}]}
    let skills = llmFields.skills;
    if (Array.isArray(skills)) {
      skills = { categories: skills.map((s: any) => ({
        name:  s.name ?? s.category ?? '',
        items: s.items ?? s.skills ?? []
      })) };
    } else if (!skills?.categories) {
      skills = { categories: [] };
    }
    // Ensure each category has name:string and items:string[]
    skills.categories = (skills.categories as any[]).map((cat: any) => ({
      name:  typeof cat.name === 'string'  ? cat.name  : (cat.category ?? ''),
      items: Array.isArray(cat.items) ? cat.items.filter((i: any) => typeof i === 'string')
           : Array.isArray(cat.skills) ? cat.skills.filter((i: any) => typeof i === 'string') : []
    }));

    // Normalize languages: "French" ÔåÆ {lang,level,level_num}
    let languages: any[] = llmFields.languages ?? [];
    if (languages.length > 0 && typeof languages[0] === 'string') {
      languages = languages.map((l: string) => ({ lang: l, level: '', level_num: 3 }));
    }
    const levelLabel = (n: number, isEn: boolean) => {
      const fr = ['', 'Notions', '├ël├®mentaire', 'Interm├®diaire', 'Professionnel', 'Natif'];
      const en = ['', 'Beginner', 'Elementary', 'Intermediate', 'Professional', 'Native'];
      return (isEn ? en : fr)[Math.min(Math.max(n, 1), 5)] ?? '';
    };
    languages = languages.map((l: any) => {
      const num = typeof l.level_num === 'number' ? l.level_num : 3;
      const isEn = outputLang === 'English';
      const level = (typeof l.level === 'string' && l.level.trim()) ? l.level : levelLabel(num, isEn);
      return { lang: typeof l.lang === 'string' ? l.lang : '', level, level_num: num };
    });

    // Normalize experiences: strings ÔåÆ {role, company, period, location, bullets}
    const rawExp = Array.isArray(llmFields.experiences) ? llmFields.experiences : [];
    const experiences = rawExp.map((e: any) => {
      if (typeof e === 'string') {
        return { role: e, company: '', period: '', location: '', bullets: [] };
      }
      return {
        role:     typeof e.role     === 'string' ? e.role     : '',
        company:  typeof e.company  === 'string' ? e.company  : '',
        period:   typeof e.period   === 'string' ? e.period   : (e.period ?? ''),
        location: typeof e.location === 'string' ? e.location : '',
        bullets:  Array.isArray(e.bullets) ? e.bullets.filter((b: any) => typeof b === 'string') : [],
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
        year:   typeof e.year   === 'string' ? e.year   : (e.year ?? ''),
        detail: typeof e.detail === 'string' ? e.detail : null,
      };
    });

    const cvDataStructured = {
      name:           typeof llmFields.name     === 'string' ? llmFields.name     : '',
      title:          typeof llmFields.title    === 'string' ? llmFields.title    : '',
      email:          typeof llmFields.email    === 'string' ? llmFields.email    : null,
      phone:          typeof llmFields.phone    === 'string' ? llmFields.phone    : null,
      location:       typeof llmFields.location === 'string' ? llmFields.location : null,
      linkedin:       typeof llmFields.linkedin === 'string' ? llmFields.linkedin : null,
      github:         typeof llmFields.github   === 'string' ? llmFields.github   : null,
      summary:        typeof llmFields.summary  === 'string' ? llmFields.summary  : '',
      experiences,
      education,
      certifications: Array.isArray(llmFields.certifications) ? llmFields.certifications.filter((c: any) => typeof c === 'string') : [],
      skills,
      languages,
      score_before: currentScore,
      score_after:  Math.min(currentScore + 15, 100),
    };

    return NextResponse.json({
      ...analysisData,
      _cv_data: cvDataStructured
    });

  } catch (error: any) {
    console.error('Groq Analysis Error:', error);
    return NextResponse.json({ error: error.message || 'Groq Analysis Failed' }, { status: 500 });
  }
}
