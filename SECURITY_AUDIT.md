# 🔒 IRIS Security Audit - API Key Privacy

## ❌ PROBLÈME ACTUEL

**Les clés API utilisateur transitent par le backend:**
- Frontend → Backend `/api/analyze` → Groq/Mistral/Google
- La clé apparaît dans `req.json()` côté serveur
- Risque: logs Render peuvent capturer la clé

## ✅ SOLUTION RECOMMANDÉE

### Option 1: Appels directs depuis le navigateur (OPTIMAL)

**Architecture:**
```
Frontend → Groq/Mistral/Google API (direct)
         ↓
    Pas de backend
```

**Avantages:**
- ✅ Clé jamais exposée au serveur
- ✅ Pas de logs côté backend
- ✅ Plus rapide (pas de proxy)
- ✅ Moins de charge serveur

**Implémentation:**
```typescript
// web/src/app/api/analyze-client/route.ts (nouveau fichier)
// Ce fichier NE FAIT RIEN - juste documentation

// Le vrai code va dans page.tsx côté client:
async function analyzeCV(cvText: string, jobDesc: string, apiKey: string) {
  // Appel DIRECT depuis le navigateur
  const groq = new Groq({ 
    apiKey,
    dangerouslyAllowBrowser: true // Active mode navigateur
  });
  
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: 'llama-3.3-70b-versatile'
  });
  
  return completion.choices[0].message.content;
}
```

---

### Option 2: Chiffrement côté client (MOYEN)

**Si tu DOIS passer par le backend:**

```typescript
// Frontend chiffre la clé avant envoi
import CryptoJS from 'crypto-js';

const encryptedKey = CryptoJS.AES.encrypt(apiKey, SECRET).toString();

fetch('/api/analyze', {
  body: JSON.stringify({ 
    encrypted_api_key: encryptedKey 
  })
});

// Backend déchiffre
const apiKey = CryptoJS.AES.decrypt(encrypted_api_key, SECRET).toString(CryptoJS.enc.Utf8);
```

**Problème:** Le SECRET doit être partagé = pas vraiment sécurisé

---

### Option 3: Masquer les logs (MINIMUM)

**Si tu gardes l'architecture actuelle:**

```typescript
// web/src/app/api/analyze/route.ts
export async function POST(req: Request) {
  // Désactiver les logs pour cette route
  console.log = () => {};
  console.error = () => {};
  
  try {
    const { api_key, ...rest } = await req.json();
    
    // NE JAMAIS logger api_key
    console.log('[analyze] Request received', { 
      ...rest, 
      api_key: '[REDACTED]' 
    });
    
    // ... reste du code
  } finally {
    // Restaurer les logs
    console.log = originalLog;
    console.error = originalError;
  }
}
```

---

## 🎯 RECOMMANDATION FINALE

**Pour IRIS:**
1. ✅ **Migrer vers appels directs navigateur** (Option 1)
2. ✅ Garder le backend UNIQUEMENT pour:
   - PDF generation (worker.py)
   - DOCX export
   - ATS simulator
   - Job search (Adzuna)

**Bénéfices:**
- 🔒 Clés jamais exposées au serveur
- ⚡ Plus rapide (pas de proxy)
- 💰 Moins de charge Render
- 📊 Pas de logs sensibles

---

## 📝 CHECKLIST AVANT LINKEDIN

- [ ] Migrer `/api/analyze` vers appels client-side
- [ ] Tester avec Groq SDK `dangerouslyAllowBrowser: true`
- [ ] Vérifier logs Render (aucune clé visible)
- [ ] Mettre à jour Privacy Shield section
- [ ] Ajouter badge "Zero Server Logs" sur homepage

---

## 🔗 RESSOURCES

- Groq Browser SDK: https://github.com/groq/groq-javascript
- Mistral Browser: https://docs.mistral.ai/api/#tag/chat
- Google AI Web: https://ai.google.dev/gemini-api/docs/get-started/web
