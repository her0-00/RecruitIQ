# ✅ RecruitIQ - Checklist de Déploiement Render

## 📋 Pré-déploiement

### Configuration
- [x] `render.yaml` configuré avec runtime Docker
- [x] `Dockerfile` optimisé avec Node 20 + Python 3
- [x] Variables d'environnement définies (PORT=10000, NODE_ENV=production)
- [x] `.env.example` créé pour référence
- [x] `package.json` avec script `start` utilisant `$PORT`

### Optimisations
- [x] Next.js configuré avec `compress: true` et `reactStrictMode: true`
- [x] CSS responsive pour mobile/tablette/desktop
- [x] Gestion d'erreurs robuste dans les API routes
- [x] Timeout et fallback sur modèles AI multiples

### Responsive Design
- [x] Layout flex adaptatif (colonne sur mobile, row sur desktop)
- [x] Sidebar collapsible sur mobile
- [x] KPIs en grille 2 colonnes sur mobile
- [x] Tabs avec scroll horizontal
- [x] Thèmes en grille responsive
- [x] PDF iframe avec hauteur adaptative (60vh mobile, 70vh tablette)
- [x] Footer en colonne unique sur mobile
- [x] Customization panel en colonne unique sur mobile

## 🚀 Déploiement sur Render

### Étapes
1. Créer un compte sur [render.com](https://render.com)
2. Connecter le repository GitHub
3. Render détectera automatiquement `render.yaml`
4. Ajouter les variables d'environnement dans le dashboard:
   - `GROQ_API_KEY` (optionnel, les utilisateurs peuvent fournir leur propre clé)
   - `MISTRAL_API_KEY` (optionnel)
5. Déployer

### Variables d'environnement Render
```
NODE_ENV=production
PORT=10000
GROQ_API_KEY=<optionnel>
MISTRAL_API_KEY=<optionnel>
```

## 🧪 Tests Post-Déploiement

### Fonctionnalités à tester
- [ ] Page d'accueil charge correctement
- [ ] Upload de CV (PDF)
- [ ] Analyse avec Groq AI
- [ ] Analyse avec Mistral AI
- [ ] Génération de PDF (tous les thèmes)
- [ ] Upload de photo de profil
- [ ] Customisation des couleurs
- [ ] AI Brand Identity
- [ ] Export PDF
- [ ] Mode Boost
- [ ] Changement de langue (FR/EN)
- [ ] Changement de thème UI

### Tests Responsive
- [ ] Mobile (< 420px)
- [ ] Mobile (420-768px)
- [ ] Tablette (768-1024px)
- [ ] Desktop (> 1024px)

### Tests Navigateurs
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (iOS)
- [ ] Chrome Mobile (Android)

## 🔧 Dépannage

### Erreurs communes

**Build failed - Python dependencies**
- Vérifier que `Dockerfile` installe Python 3 et pip
- Vérifier `requirements.txt` pour versions compatibles

**Port binding error**
- Vérifier que `npm start` utilise `$PORT` variable
- Render injecte automatiquement PORT=10000

**API timeout**
- Augmenter timeout dans `callGroq`/`callMistral` (actuellement 30-65s)
- Vérifier quotas API Groq/Mistral

**PDF generation fails**
- Vérifier que ReportLab est installé
- Vérifier que fonts/ directory est copié dans Docker image

**Responsive issues**
- Tester avec Chrome DevTools device emulation
- Vérifier media queries dans globals.css

## 📊 Monitoring

### Métriques à surveiller
- Temps de réponse API (/api/analyze)
- Taux d'erreur 500
- Utilisation mémoire (Python worker)
- Quotas API Groq/Mistral

### Logs
- Render Dashboard > Logs
- Filtrer par "Error" ou "Failed"
- Surveiller les rate limits AI

## 🎯 Performance

### Optimisations appliquées
- Next.js compression activée
- Images optimisées (profile photos)
- CSS minifié en production
- Caching des fonts
- Lazy loading des composants lourds

### Temps de chargement cibles
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- API Analysis: < 10s (avec AI)
- PDF Generation: < 5s

## 🔒 Sécurité

### Mesures en place
- API keys jamais exposées côté client
- Validation des inputs (cv_text, job_desc)
- Sanitization du texte PDF
- HTTPS forcé par Render
- Rate limiting via AI providers

## 📝 Notes

- Free tier Render: 750h/mois, sleep après 15min d'inactivité
- Cold start: ~30s pour réveiller le service
- Upgrade vers Starter ($7/mois) pour éviter le sleep
- Groq free tier: 30 req/min, 14400 req/jour
- Mistral free tier: varie selon modèle

## ✅ Validation Finale

Avant de marquer comme "prêt pour production":
- [ ] Tous les tests fonctionnels passent
- [ ] Responsive vérifié sur 4+ devices
- [ ] Aucune erreur console en production
- [ ] Temps de chargement < 3s
- [ ] PDF export fonctionne sur tous les thèmes
- [ ] AI analysis fonctionne avec Groq ET Mistral
- [ ] Documentation README.md à jour
