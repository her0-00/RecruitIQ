# Testing Checklist - Dual Workflow

## ✅ Fixed Issues
- [x] Runtime error: Cannot read properties of null (reading 'global_score')
  - Added conditional rendering for KPIs section
  - Added conditional rendering for tabs menu
  - Added analysisResult checks for all content tabs

## 🧪 Test Scenarios

### Scenario 1: "J'ai une offre" Path
1. [ ] Upload CV PDF
2. [ ] Verify CV text extracted
3. [ ] See two workflow buttons appear
4. [ ] Click "📄 J'ai une offre d'emploi"
5. [ ] Paste job description in sidebar
6. [ ] Click "⬡ LAUNCH AUDIT"
7. [ ] Verify KPIs appear
8. [ ] Verify tabs appear (Audit, Sections, Edit, PDF, Find Jobs)
9. [ ] Navigate through tabs
10. [ ] Generate PDF

### Scenario 2: "Cherche des offres" Path
1. [ ] Upload CV PDF
2. [ ] Enter Groq API key
3. [ ] Click "🔍 Cherche des offres qui matchent mon CV"
4. [ ] Verify redirect to "Find Jobs" tab
5. [ ] Verify loading spinner appears
6. [ ] Verify keywords extracted and displayed
7. [ ] Verify job results appear with scores
8. [ ] Filter by High/Mid/All
9. [ ] Click "⬡ Audit CV" on a job
10. [ ] Verify job description auto-filled
11. [ ] Verify redirect to Audit tab
12. [ ] Click "⬡ LAUNCH AUDIT"
13. [ ] Verify analysis runs
14. [ ] Generate PDF

### Scenario 3: Reset Flow
1. [ ] Complete either workflow
2. [ ] Click "↻ Nouveau CV"
3. [ ] Verify state resets
4. [ ] Upload new CV
5. [ ] Verify workflow choice appears again

### Scenario 4: Manual Job Search
1. [ ] Upload CV
2. [ ] Choose any workflow
3. [ ] Navigate to "Find Jobs" tab manually
4. [ ] Enter keywords manually
5. [ ] Click "🔍 SEARCH"
6. [ ] Verify results appear

### Scenario 5: Edge Cases
1. [ ] Upload CV without API key → Click "Cherche des offres" → Verify error message
2. [ ] Upload CV → Choose "J'ai une offre" → Don't paste job desc → Click audit → Verify works
3. [ ] Load example CV → Verify workflow buttons don't appear (already has analysis)
4. [ ] Navigate to Jobs tab before any workflow → Verify tab shows properly

## 🐛 Known Limitations
- Job scraping depends on website structure (may break if sites change)
- Keyword extraction requires Groq API key
- Some job boards may block requests (rate limiting)

## 🎯 Success Criteria
- ✅ No runtime errors
- ✅ Smooth workflow transitions
- ✅ Clear user guidance at each step
- ✅ Loading states visible
- ✅ Error messages helpful
- ✅ Reset functionality works
- ✅ Both paths lead to PDF generation
