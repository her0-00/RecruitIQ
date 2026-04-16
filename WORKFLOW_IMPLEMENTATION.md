# RecruitIQ - Dual Workflow Implementation

## ✅ Implemented Features

### 1. Upload CV → Text Extraction
- ✅ PDF upload via file input
- ✅ Python backend extraction using pdfminer.six
- ✅ Text displayed in sidebar

### 2. Workflow Choice After Upload
- ✅ Two buttons appear after CV upload:
  - **"📄 J'ai une offre d'emploi"** → Manual job description entry
  - **"🔍 Cherche des offres qui matchent mon CV"** → Auto job search

### 3. Auto Job Search Path
- ✅ New API endpoint: `/api/extract_keywords`
  - Uses Groq AI to extract 3-5 relevant keywords from CV
  - Focuses on job title, main skills, and domain
  - Fallback model chain for reliability
- ✅ Automatic job board scraping with extracted keywords
- ✅ Results displayed in "Find Jobs" tab with relevance scores
- ✅ Visual indicator showing auto-extracted keywords

### 4. Job Selection → Audit Flow
- ✅ "⬡ Audit CV" button on each job card
- ✅ Automatically fills job description field
- ✅ Switches to "have_offer" workflow mode
- ✅ Redirects to Audit tab
- ✅ User can then run analysis → rewrite → PDF export

### 5. UI/UX Improvements
- ✅ Workflow state management (`workflowMode`: none/have_offer/search_offers)
- ✅ "↻ Nouveau CV" reset button to start over
- ✅ Conditional button display based on workflow state
- ✅ Loading states for keyword extraction + search
- ✅ Empty state messages adapted to workflow stage

## 🎯 User Flow

```
1. Upload CV PDF
   ↓
2. Choose:
   ├─ "J'ai une offre"
   │  ├─ Paste job description in sidebar
   │  ├─ Click "⬡ LAUNCH AUDIT"
   │  ├─ View audit results
   │  ├─ Edit content (optional)
   │  └─ Generate PDF
   │
   └─ "Cherche des offres"
      ├─ AI extracts keywords from CV (auto)
      ├─ Scrapes WTTJ, HelloWork, RemixJobs, APEC (auto)
      ├─ Shows scored results in "Find Jobs" tab
      ├─ User clicks "⬡ Audit CV" on a job
      ├─ Job description auto-filled
      ├─ Click "⬡ LAUNCH AUDIT"
      ├─ View audit results
      ├─ Edit content (optional)
      └─ Generate PDF
```

## 📁 Files Modified/Created

### Created:
- `web/src/app/api/extract_keywords/route.ts` - AI keyword extraction endpoint

### Modified:
- `web/src/app/page.tsx` - Main UI with workflow logic
- `README.md` - Updated documentation with new workflow

## 🔧 Technical Details

### Keyword Extraction
- **Endpoint**: POST `/api/extract_keywords`
- **Input**: `{ cv_text: string, api_key: string }`
- **Output**: `{ keywords: string }` (comma-separated)
- **Models**: llama-3.3-70b-versatile → llama-3.1-8b-instant (fallback)
- **Prompt**: Extracts 3-5 keywords focusing on job title, skills, domain

### Job Scraping (existing)
- **Endpoint**: POST `/api/search_jobs`
- **Sources**: WTTJ, HelloWork, RemixJobs, APEC
- **Scoring**: AI relevance scoring 0-100 per job
- **Deduplication**: By title + company

### State Management
- `workflowMode`: Tracks user's chosen path
- `jobKeywords`: Stores extracted/manual keywords
- `jobResults`: Array of scraped jobs with scores
- `analysisResult`: CV audit data from Groq

## 🚀 Next Steps (Optional Enhancements)

- [ ] Save search history
- [ ] Export job list to CSV
- [ ] One-click apply to multiple jobs
- [ ] CV version management (save multiple rewrites)
- [ ] Email alerts for new matching jobs
- [ ] LinkedIn profile import
- [ ] Cover letter generation per job

## 🎨 Design Principles

- **Minimal code**: Only essential logic, no bloat
- **Clear UX**: Two-button choice, obvious next steps
- **Fast feedback**: Loading states, auto-redirect
- **Graceful fallback**: Works without API key (manual keywords)
- **Consistent styling**: Matches existing RecruitIQ design system
