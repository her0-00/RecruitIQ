# 🎯 RecruitIQ v4.0 - Changelog & Features

## ✨ Nouvelles Fonctionnalités

### 1. **Workflow Dual-Path** 🔀
Après l'upload de votre CV, choisissez votre parcours:

#### 📄 "J'ai une offre d'emploi"
- Collez la description du poste
- Analyse immédiate CV vs offre
- Score ATS + keywords manquants
- Réécriture optimisée
- Export PDF

#### 🔍 "Cherche des offres qui matchent mon CV"
- **Extraction automatique** de keywords depuis votre CV (Groq AI)
- **Scraping intelligent** avec Playwright (WTTJ, HelloWork)
- **Rate limiting** respectueux (2s entre sites, max 10 offres/site)
- **Scoring AI** de pertinence (0-100) pour chaque offre
- Sélection d'une offre → Audit → Réécriture → PDF

### 2. **Job Scraping Intelligent** 🤖
- **Playwright headless** pour sites JS-rendered
- **Timeouts intelligents**: 15s/page, 30s total
- **Déduplication** automatique
- **Filtrage rapide** (exclut navigation, menus, etc.)
- **Sources**: WTTJ, HelloWork (extensible)

### 3. **UI 100% Mobile-Responsive** 📱
- **Sidebar collapsible** sur mobile
- **Tabs scrollables** horizontalement
- **Job cards adaptatives** (flex → column sur mobile)
- **Theme carousel** en grid 2x2 sur mobile
- **KPIs** optimisés (3 colonnes → tailles réduites)
- **Boutons** full-width sur petit écran

### 4. **Visite Guidée Mise à Jour** 🎓
- Nouvelle étape expliquant le dual workflow
- Tooltips adaptés mobile/desktop
- Positionnement intelligent (évite débordements)

---

## 🏗️ Architecture Technique

### Frontend (Next.js 15 + React 19)
```
web/src/app/
├── page.tsx                    # UI principale + workflow logic
├── OnboardingTour.tsx          # Visite guidée
├── globals.css                 # Styles responsive
└── api/
    ├── extract/route.ts        # Extraction PDF
    ├── extract_keywords/route.ts  # NEW: Extraction keywords AI
    ├── search_jobs/route.ts    # NEW: Scraping Playwright
    ├── analyze/route.ts        # Analyse CV
    └── generate_cv/route.ts    # Génération PDF
```

### Backend (Python)
```
backend/
├── extractor.py       # Extraction texte PDF (pdfminer.six)
├── pdf_cv.py          # Génération PDF (ReportLab)
├── worker.py          # Orchestration agents Groq
└── scraper_cli.py     # NEW: CLI Playwright pour scraping
```

### Workflow Scraping
```
1. User uploads CV
2. User clicks "🔍 Cherche des offres"
3. Next.js API calls Python CLI: scraper_cli.py
4. Playwright scrapes WTTJ + HelloWork (headless)
5. Results returned as JSON
6. Groq AI scores relevance (0-100)
7. Display sorted results
8. User selects job → Audit flow
```

---

## 🚀 Déploiement Render

### Fichiers Clés
- ✅ `Dockerfile` → Inclut Playwright + Chromium
- ✅ `requirements.txt` → `playwright>=1.40.0`
- ✅ `render.yaml` → Config optimale
- ✅ `DEPLOY_RENDER.md` → Guide complet

### Build Steps
```dockerfile
1. Install Node 20 + Python 3
2. Install Python deps (pdfminer, reportlab, playwright)
3. Install Playwright browsers (chromium only)
4. Install Node deps + build Next.js
5. Expose port 3000
6. Start: npm start
```

### Variables d'Environnement
```bash
NODE_ENV=production
PORT=3000
GROQ_API_KEY=gsk_xxx  # Optionnel (users can provide their own)
```

---

## 📊 Performance

### Temps de Réponse
- **Upload CV**: ~1-2s
- **Extract keywords**: ~3-5s (Groq API)
- **Scraping**: ~15-25s (2 sites, rate-limited)
- **Audit CV**: ~5-10s (Groq API)
- **Generate PDF**: ~2-3s (ReportLab)

### Ressources
- **RAM**: ~400-500 MB (avec Chromium headless)
- **CPU**: Spike à 80-100% pendant scraping (normal)
- **Disk**: ~200 MB (Chromium + deps)

### Rate Limiting
- ✅ 2s délai entre sites
- ✅ 15s timeout par page
- ✅ 30s timeout global
- ✅ Max 10 offres par site

---

## 🧪 Tests

### Test Local
```bash
# Terminal 1: Start dev server
cd web
npm run dev

# Terminal 2: Test scraper CLI
cd backend
python scraper_cli.py "développeur" "France"
```

### Test Workflow Complet
1. Upload CV PDF
2. Entrer clé Groq
3. Cliquer "🔍 Cherche des offres"
4. Vérifier extraction keywords
5. Vérifier résultats scraping
6. Sélectionner une offre
7. Vérifier audit + PDF

### Test Mobile
```
1. DevTools (F12) → Toggle device toolbar
2. iPhone 12 Pro (390x844)
3. Vérifier sidebar collapsible
4. Vérifier tabs scrollables
5. Vérifier job cards lisibles
```

---

## 🐛 Troubleshooting

### Scraping retourne 0 résultats
**Cause**: Sites modernes utilisent JS rendering
**Solution**: Playwright est déjà intégré, vérifier logs

### "Playwright not found"
**Cause**: Browsers pas installés
**Solution**: `python -m playwright install chromium`

### Out of memory sur Render
**Cause**: Plan Free (512 MB) trop juste
**Solution**: Upgrade Starter ($7/mo) ou réduire `max_jobs`

### PDF ne se génère pas
**Cause**: Path relatif incorrect
**Solution**: Vérifier `../backend/pdf_cv.py` dans `spawn()`

---

## 📱 Responsive Breakpoints

```css
/* Desktop */
@media (min-width: 1025px) { ... }

/* Tablet */
@media (max-width: 1024px) {
  .sidebar { width: 260px; }
  .sgrid { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile */
@media (max-width: 768px) {
  .page-container { flex-direction: column; }
  .sidebar { width: 100%; border-bottom: 1px solid; }
  .sidebar-toggle { display: block; }
  .kpis { grid-template-columns: repeat(3, 1fr); }
  .tabs { overflow-x: auto; }
  .job-card { flex-direction: column; }
}

/* Small mobile */
@media (max-width: 420px) {
  .theme-card { min-width: calc(50% - 4px); }
  .tab { font-size: 0.42rem; }
}
```

---

## 🎨 UI Components

### Job Card (Mobile-Responsive)
```tsx
<div className="job-card">
  <div className="job-score high">85</div>
  <div className="job-info">
    <div className="job-title">Développeur Full Stack</div>
    <div className="job-meta">
      <span>TechCorp</span>
      <span>📍 Paris</span>
      <span className="job-source">WTTJ</span>
    </div>
  </div>
  <div className="job-actions">
    <button className="btn-job audit">⬡ Audit CV</button>
    <button className="btn-job view">🔗 View</button>
  </div>
</div>
```

### Workflow Buttons
```tsx
{workflowMode === 'none' && cvText && (
  <div>
    <button onClick={() => setWorkflowMode('have_offer')}>
      📄 J'ai une offre d'emploi
    </button>
    <button onClick={() => { 
      setWorkflowMode('search_offers'); 
      handleAutoExtractAndSearch(); 
    }}>
      🔍 Cherche des offres qui matchent mon CV
    </button>
  </div>
)}
```

---

## 🔐 Sécurité

### API Keys
- ✅ Groq API key stockée côté client (localStorage)
- ✅ Jamais loggée côté serveur
- ✅ Optionnelle (env var ou user input)

### Scraping
- ✅ Rate limiting pour éviter ban
- ✅ User-Agent réaliste (Playwright)
- ✅ Timeout pour éviter hang
- ✅ Headless mode (pas de GUI)

### PDF
- ✅ Génération côté serveur (Python)
- ✅ Pas de stockage permanent
- ✅ Base64 envoyé au client
- ✅ Download immédiat

---

## 📚 Documentation

- `README.md` → Vue d'ensemble
- `DEPLOY_RENDER.md` → Guide déploiement complet
- `WORKFLOW_IMPLEMENTATION.md` → Détails techniques workflow
- `TESTING_CHECKLIST.md` → Scénarios de test

---

## 🎯 Roadmap

### v4.1 (Court terme)
- [ ] Cache Redis pour scraping
- [ ] Support Indeed + LinkedIn
- [ ] Export CSV des résultats
- [ ] Historique des recherches

### v4.2 (Moyen terme)
- [ ] Queue système (Bull) pour scraping async
- [ ] Webhook notifications
- [ ] Multi-langue UI (EN/FR/ES)
- [ ] Dark/Light theme toggle

### v5.0 (Long terme)
- [ ] Compte utilisateur + auth
- [ ] Sauvegarde CVs cloud
- [ ] Tracking candidatures
- [ ] Analytics dashboard

---

## 🤝 Contribution

### Setup Dev
```bash
git clone https://github.com/your-repo/recruitiq.git
cd recruitiq

# Install Python deps
pip install -r requirements.txt
python -m playwright install chromium

# Install Node deps
cd web
npm install
npm run dev
```

### Ajouter un Site de Scraping
1. Créer fonction dans `backend/scraper_cli.py`
2. Ajouter au workflow dans `scrape_all()`
3. Tester avec `python scraper_cli.py "test" "France"`
4. Mettre à jour `sources` dans `route.ts`

---

## 📄 License

MIT

---

✅ **RecruitIQ v4.0 - Production Ready** 🚀


---

## [4.1.0] - 2026-04-15

### ✨ Nouvelles Fonctionnalités

#### 📸 Personnalisation Complète des Photos de Profil

- **Contrôle de la couleur du contour** : Nouveau sélecteur de couleur dans le panneau CV Studio Customization
- **Support universel** : Fonctionne sur tous les 10 thèmes photo disponibles
- **Régénération automatique** : Le PDF se met à jour automatiquement (debounce 1.2s)
- **Couleurs par défaut intelligentes** : Chaque thème a une couleur de contour optimisée

#### 🎨 Thèmes Photo Améliorés

Tous les thèmes photo ont été mis à jour avec :
- Attribut `PHOTO_BORDER` pour définir la couleur par défaut
- Support de la customisation via `custom_style.photo_border_color`
- Largeurs de contour optimisées par thème (1-3px)

**Thèmes concernés :**
1. Executive Portrait
2. Modern Profile
3. Corporate Elite
4. Creative Vision
5. Minimalist Pro
6. Finance Executive
7. Tech Leader
8. Startup Founder
9. Consultant Premium
10. International Profile

### 🔧 Améliorations Techniques

#### Backend (pdf_cv.py)
- **Fonction `_draw_photo`** : Nouveaux paramètres `border_color` et `border_width`
- **Fonction `_apply_custom_style`** : Support de `photo_border_color`
- **Gestion d'erreur robuste** : Fallback gracieux si la couleur n'est pas définie

#### Frontend (page.tsx)
- **Nouveau state** : `customPhotoBorder` pour gérer la couleur personnalisée
- **Interface utilisateur** : Section "Photo Profile (si applicable)" dans le panneau de customisation
- **Auto-régénération** : Ajout de `customPhotoBorder` aux dépendances du useEffect

### 📚 Documentation

- **PHOTO_CUSTOMIZATION.md** : Documentation technique complète
- **GUIDE_PHOTO_FR.md** : Guide utilisateur en français
- **test_photo_customization.py** : Suite de tests automatisés

### 🐛 Corrections de Bugs

- Correction du fallback de couleur de contour pour les thèmes sans `PHOTO_BORDER` défini
- Amélioration de la gestion des erreurs lors du décodage base64 des photos

### 🎯 Performance

- Aucun impact sur la vitesse de génération PDF
- Utilisation optimale de `getattr()` pour les fallbacks
- Gestion mémoire améliorée pour les images base64

### 🔄 Compatibilité

- ✅ Compatible avec tous les thèmes existants (avec et sans photo)
- ✅ Rétrocompatible : les CV générés avant cette version fonctionnent toujours
- ✅ Support des formes circulaires et carrées

### 📊 Statistiques

- **10 thèmes photo** mis à jour
- **3 nouveaux fichiers** de documentation
- **1 script de test** automatisé
- **~200 lignes** de code ajoutées/modifiées

---
