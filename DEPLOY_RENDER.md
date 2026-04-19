# 🚀 Guide de Déploiement Render - RIIS v4.0

## ✅ Nouvelles Fonctionnalités

### 1. **Workflow Dual-Path**
- ✅ "J'ai une offre" → Analyse directe
- ✅ "Cherche des offres" → Scraping intelligent + AI scoring

### 2. **Job Scraping avec Playwright**
- ✅ Scraping WTTJ, HelloWork avec rate limiting
- ✅ Extraction automatique de keywords depuis CV
- ✅ Scoring AI de pertinence (0-100)

### 3. **UI 100% Mobile-Responsive**
- ✅ Sidebar collapsible sur mobile
- ✅ Tabs scrollables horizontalement
- ✅ Job cards adaptatives
- ✅ Theme carousel en grid sur mobile

---

## 📦 Prérequis Render

### 1. **Fichiers Mis à Jour**
- ✅ `Dockerfile` → Inclut Playwright + Chromium
- ✅ `requirements.txt` → Playwright ajouté
- ✅ `render.yaml` → Configuration optimale
- ✅ `backend/scraper_cli.py` → Script Python CLI
- ✅ `web/src/app/api/search_jobs/route.ts` → Intégration Playwright
- ✅ `web/src/app/api/extract_keywords/route.ts` → Extraction AI

### 2. **Variables d'Environnement**
```bash
NODE_ENV=production
PORT=3000
GROQ_API_KEY=gsk_your_key_here  # Optionnel (users can provide their own)
```

---

## 🔧 Déploiement sur Render

### Étape 1: Push sur GitHub
```bash
git add .
git commit -m "feat: dual workflow + playwright scraping + mobile responsive"
git push origin main
```

### Étape 2: Créer le Service Render
1. Aller sur [render.com](https://render.com)
2. **New** → **Web Service**
3. Connecter votre repo GitHub
4. Render détecte automatiquement le `Dockerfile`

### Étape 3: Configuration
- **Name**: `RIIS`
- **Region**: `Frankfurt` (ou autre)
- **Branch**: `main`
- **Runtime**: Docker
- **Plan**: Free (ou Starter pour plus de RAM)

### Étape 4: Variables d'Environnement (Optionnel)
Ajouter dans l'onglet "Environment":
```
GROQ_API_KEY=gsk_your_groq_key
```
> Si non défini, les utilisateurs devront entrer leur propre clé dans l'UI

### Étape 5: Déployer
- Cliquer sur **Create Web Service**
- Render va:
  1. Build l'image Docker (~10-15 min)
  2. Installer Playwright + Chromium
  3. Build Next.js
  4. Démarrer l'app sur port 3000

---

## ⚡ Optimisations Render

### 1. **Mémoire**
Le plan Free (512 MB) peut être juste avec Playwright. Recommandations:
- **Free Plan**: OK pour tests, peut être lent
- **Starter Plan ($7/mo)**: 512 MB → Recommandé pour production

### 2. **Cold Starts**
Sur le plan Free, l'app s'endort après 15 min d'inactivité:
- Premier chargement: ~30-60s (réveil + Playwright init)
- Solution: Pinger l'app toutes les 10 min avec un cron externe

### 3. **Rate Limiting**
Le scraper inclut déjà:
- ✅ 2s de délai entre sites
- ✅ Timeout 15s par page
- ✅ Max 10 offres par site
- ✅ Timeout global 30s

---

## 🧪 Tester Après Déploiement

### 1. **Test Upload CV**
```
1. Aller sur https://your-app.onrender.com
2. Entrer clé Groq API
3. Upload un PDF
4. Vérifier extraction texte
```

### 2. **Test "J'ai une offre"**
```
1. Après upload CV, cliquer "📄 J'ai une offre"
2. Coller description de poste
3. Cliquer "⬡ LAUNCH AUDIT"
4. Vérifier scores + keywords
5. Générer PDF
```

### 3. **Test "Cherche des offres"**
```
1. Après upload CV, cliquer "🔍 Cherche des offres"
2. Attendre extraction keywords (~3-5s)
3. Attendre scraping (~10-20s)
4. Vérifier résultats scorés
5. Cliquer "⬡ Audit CV" sur une offre
6. Vérifier analyse + PDF
```

### 4. **Test Mobile**
```
1. Ouvrir DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Tester iPhone 12 Pro (390x844)
4. Vérifier:
   - Sidebar collapsible
   - Tabs scrollables
   - Job cards lisibles
   - Boutons accessibles
```

---

## 🐛 Troubleshooting

### Erreur: "Playwright not found"
```bash
# Dans le Dockerfile, vérifier:
RUN python3 -m playwright install --with-deps chromium
```

### Erreur: "Out of memory"
- Upgrade vers Starter plan ($7/mo)
- Ou réduire `max_jobs` dans `scraper_cli.py` (ligne 50)

### Scraping retourne 0 résultats
- Vérifier logs Render: `playwright.async_api._errors.TimeoutError`
- Augmenter timeout dans `scraper_cli.py` (ligne 20)
- Vérifier que Chromium est bien installé

### PDF ne se génère pas
- Vérifier que `backend/pdf_cv.py` est accessible
- Vérifier logs Python: `spawn('python', ...)`
- Path relatif: `../backend/pdf_cv.py`

---

## 📊 Monitoring

### Logs Render
```bash
# Voir logs en temps réel
render logs -f

# Filtrer erreurs Python
render logs | grep "ERROR"

# Filtrer Playwright
render logs | grep "playwright"
```

### Métriques
- **CPU**: Playwright peut spike à 80-100% pendant scraping (normal)
- **RAM**: ~400-500 MB avec Chromium headless
- **Response Time**: 
  - Upload CV: ~1-2s
  - Audit: ~5-10s (Groq API)
  - Scraping: ~15-25s (2 sites)
  - PDF: ~2-3s

---

## 🎯 Checklist Pré-Déploiement

- [ ] `Dockerfile` inclut Playwright
- [ ] `requirements.txt` inclut `playwright>=1.40.0`
- [ ] `backend/scraper_cli.py` existe
- [ ] `web/src/app/api/search_jobs/route.ts` appelle le scraper
- [ ] `web/src/app/api/extract_keywords/route.ts` existe
- [ ] Tests locaux passent (`npm run dev`)
- [ ] Build Docker local réussit (`docker build -t RIIS .`)
- [ ] Variables d'env configurées sur Render
- [ ] Git push sur `main`

---

## 🚀 Post-Déploiement

### 1. **Tester l'URL publique**
```
https://RIIS.onrender.com
```

### 2. **Partager avec utilisateurs**
```
✅ Upload CV PDF
✅ Entrer clé Groq (gratuite sur console.groq.com)
✅ Choisir workflow:
   - "J'ai une offre" → Analyse directe
   - "Cherche des offres" → Scraping auto
✅ Générer PDF optimisé ATS
```

### 3. **Monitoring continu**
- Vérifier logs Render quotidiennement
- Surveiller usage RAM/CPU
- Tester scraping hebdomadairement (sites peuvent changer)

---

## 💡 Améliorations Futures

- [ ] Cache Redis pour résultats scraping (éviter re-scrape)
- [ ] Queue système (Bull/BullMQ) pour scraping async
- [ ] Webhook pour notifier fin de scraping
- [ ] Support plus de sites (Indeed, LinkedIn via API)
- [ ] Export résultats scraping en CSV
- [ ] Historique des recherches

---

## 📞 Support

**Erreurs de déploiement ?**
1. Vérifier logs Render
2. Tester build Docker local
3. Vérifier que tous les fichiers sont commités

**Scraping ne fonctionne pas ?**
1. Vérifier que Playwright est installé
2. Tester `scraper_cli.py` en local
3. Augmenter timeouts si nécessaire

---

✅ **Déploiement prêt pour production !** 🎉
