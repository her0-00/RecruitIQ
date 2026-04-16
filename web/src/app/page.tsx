'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, Download, Play, LayoutTemplate, Wand2, ShieldCheck, Lock, Server, Eye, Trash2 } from 'lucide-react';
import { cvExamples } from './examples';
import OnboardingTour from './OnboardingTour';
import SimplePDFEditor from './SimplePDFEditor';

const THEME_CATEGORIES = [
  {
    label: '🏛️ Classic',
    themes: [
      { name: 'Classic Dark', color: '#0F1117', accent: '#C8A96E', desc: 'Dark sidebar · Gold' },
      { name: 'Luxury Serif', color: '#FFFEF9', accent: '#8B6914', desc: 'Serif · Warm Gold' },
      { name: 'Executive C', color: '#FFFFFF', accent: '#334155', desc: 'Silver · Slate' },
      { name: 'Apprentice', color: '#FCD34D', accent: '#1E3A8A', desc: 'Yellow · Royal Blue' },
      { name: 'Creative Ag.', color: '#FFE4E6', accent: '#E11D48', desc: 'Rose · Coral' },
      { name: 'SOTA Luxury', color: '#FDFDFD', accent: '#C5B358', desc: 'Premium · Gold & Cream' },
    ],
  },
  {
    label: '🎨 Canva',
    themes: [
      { name: 'Canva Minimal', color: '#FFFFFF', accent: '#FF6B6B', desc: 'White · Coral' },
      { name: 'Medical Clean', color: '#F8FAFC', accent: '#0EA5E9', desc: 'Aqua · White' },
      { name: 'BTP Industry', color: '#FFFFFF', accent: '#F97316', desc: 'Steel · Orange' },
      { name: 'Retail Sales', color: '#FFFFFF', accent: '#DC2626', desc: 'Red · Black' },
    ],
  },
  {
    label: '🧊 Nordic',
    themes: [
      { name: 'Nordic Clean', color: '#F7F5F2', accent: '#5B8DB8', desc: 'Pastel · Blue' },
      { name: 'Finance Pro', color: '#FFFFFF', accent: '#A78B50', desc: 'Navy · Gold' },
      { name: 'Academic Legal', color: '#FFFFFF', accent: '#404040', desc: 'Pure B&W · Serif' },
    ],
  },
  {
    label: '⚡ TechGrid',
    themes: [
      { name: 'Tech Grid', color: '#0D1117', accent: '#58A6FF', desc: 'Dark · Blue' },
      { name: 'Startup SaaS', color: '#0F172A', accent: '#8B5CF6', desc: 'Indigo · Pink' },
      { name: 'Logistics', color: '#FFFFFF', accent: '#1E40AF', desc: 'Navy · Green' },
    ],
  },
  {
    label: '📷 Photo Profile',
    themes: [
      { name: 'Executive Portrait', color: '#FFFFFF', accent: '#B8956A', desc: 'Photo ronde header · Premium' },
      { name: 'Modern Profile', color: '#F8F9FA', accent: '#3498DB', desc: 'Grande photo sidebar · Tech' },
      { name: 'Corporate Elite', color: '#FFFFFF', accent: '#1E3A5F', desc: 'Photo header asymétrique' },
      { name: 'Creative Vision', color: '#FAFAFA', accent: '#FF6B9D', desc: 'Photo overlay diagonal' },
      { name: 'Minimalist Pro', color: '#FFFFFF', accent: '#2C3E50', desc: 'Photo centrée épurée' },
      { name: 'Finance Executive', color: '#FFFFFF', accent: '#A78B50', desc: 'Photo formelle · Navy' },
      { name: 'Tech Leader', color: '#F8F9FA', accent: '#58A6FF', desc: 'Photo sidebar moderne' },
      { name: 'Startup Founder', color: '#FAFAFA', accent: '#8B5CF6', desc: 'Photo overlay violet' },
      { name: 'Consultant Premium', color: '#FDFCFA', accent: '#2C5F7C', desc: 'Layout 3 colonnes' },
      { name: 'International Profile', color: '#FFFFFF', accent: '#D32F2F', desc: 'Sidebar barres progression' },
    ],
  },
];

const ALL_THEMES = THEME_CATEGORIES.flatMap(c => c.themes);

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('Classic Dark');
  const [boostMode, setBoostMode] = useState(false);
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [uiTheme, setUiTheme] = useState<'dark' | 'sota-luxury'>('dark');
  const [profilePhoto, setProfilePhoto] = useState<string>('');  // base64
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [editedCvDataJSON, setEditedCvDataJSON] = useState<string>('');
  const [pdfData, setPdfData] = useState<{ base64: string, filename: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'audit' | 'sections' | 'edit' | 'pdf' | 'tips'>('audit');
  const [visualEditMode, setVisualEditMode] = useState(false);
  const [isFullscreenUI, setIsFullscreenUI] = useState(false);

  // CV Studio Customization States
  const [customAccent, setCustomAccent] = useState('');
  const [customText, setCustomText] = useState('');
  const [customHeading, setCustomHeading] = useState('');
  const [customSubheading, setCustomSubheading] = useState('');
  const [customNameColor, setCustomNameColor] = useState('');
  const [customSidebarBg, setCustomSidebarBg] = useState('');
  const [customMainBg, setCustomMainBg] = useState('');
  const [customHeaderBg, setCustomHeaderBg] = useState('');
  const [customPhotoBorder, setCustomPhotoBorder] = useState('');
  const [fontScale, setFontScale] = useState(1.0);
  const [fontFamily, setFontFamily] = useState('Poppins');
  const [customOpen, setCustomOpen] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);

  // Brand Identity states
  const [targetCompany, setTargetCompany] = useState('');
  const [brandPalettes, setBrandPalettes] = useState<any[]>([]);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [isLoadingColors, setIsLoadingColors] = useState(false);

  // Get theme defaults for color pickers
  const getThemeDefaults = () => {
    const theme = ALL_THEMES.find(t => t.name === selectedTheme);
    return {
      sidebar: theme?.color || '#1A1C22',
      header: theme?.color || '#1A1C22',
      main: '#FFFFFF',
      name: '#FFFFFF',
      heading: theme?.accent || '#C8A96E',
      subheading: theme?.accent || '#C8A96E',
      text: '#1A1C22',
      accent: theme?.accent || '#C8A96E'
    };
  };

  // Auto-regeneration of PDF when content or customization changes
  useEffect(() => {
    if (!pdfData) return;
    setNeedsUpdate(true);
    const timer = setTimeout(() => {
      handleGeneratePdf();
      setNeedsUpdate(false);
    }, 1200); // 1.2s debounce
    return () => clearTimeout(timer);
  }, [
    customAccent, customText, customHeading, customSubheading,
    customNameColor, customSidebarBg, customMainBg, customHeaderBg, customPhotoBorder, fontScale, fontFamily,
    editedCvDataJSON, selectedTheme
  ]);

  // Clean up Blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const resetCustomization = () => {
    setCustomAccent('');
    setCustomText('');
    setCustomHeading('');
    setCustomSubheading('');
    setCustomNameColor('');
    setCustomSidebarBg('');
    setCustomMainBg('');
    setCustomHeaderBg('');
    setCustomPhotoBorder('');
    setFontScale(1.0);
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('groq_api_key');
    if (key) setApiKey(key);

    // Load saved UI theme
    const savedTheme = localStorage.getItem('ui-theme') as 'dark' | 'sota-luxury' | null;
    if (savedTheme) {
      setUiTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleUiTheme = () => {
    const newTheme = uiTheme === 'dark' ? 'sota-luxury' : 'dark';
    setUiTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('ui-theme', newTheme);
  };

  const loadExample = (exampleKey: 'marketing' | 'dev' | 'sales') => {
    const ex = cvExamples[exampleKey];
    setCvText(ex.cv_text);
    setJobDesc(ex.job_desc);

    // Clean the example data to avoid circular references
    const cleanCvData = JSON.parse(JSON.stringify(ex.cv_data));

    // Simulate an immediate analysis finish to show UI capabilities instantly
    // We will spoof the Groq call with the predefined cv_data inside example for the PDF part.
    setAnalysisResult({
      global_score: cleanCvData.score_after,
      ats_pass_probability: 85,
      salary_gap: "15%",
      salary_estimate: "55-65k",
      salary_potential: "70-85k",
      market_value_verdict: "Profil hautement attractif sur le marché actuel",
      top_strength: "Leadership et vision stratégique",
      psychology: {
        pourquoi_ignore: "Le profil est souvent perçu comme trop senior pour des rôles de management opérationnel de base.",
        pourquoi_sous_paye: "Manque d'insistance sur la monétisation directe.",
        personal_brand: "Leader affirmé, oriente résultat et croissance."
      },
      critical_fixes: [
        "Quantifiez l'impact de l'A/B testing",
        "Ajoutez plus de KPIs financiers"
      ],
      present_keywords: ["SaaS", "Growth", "Lead Generation"],
      missing_keywords: ["LTV", "CAC Payback"],
      sections: { resume: 9, formation: 8, experience: 9, competences: 9, impact_quantifie: 8, formatage_dates: 10, verbes_action: 9, longueur: 9 },
      job_match: { missions: 90, skills: 85, seniority: 95, culture: 80 },
      benchmark: { tech: 70, finance: 50, consulting: 60, marketing: 95, rh_legal: 40 },
      _cv_data: cleanCvData // Stash for PDF generation - now clean!
    });
    setEditedCvDataJSON(JSON.stringify(cleanCvData, null, 2));
    setPdfData(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const formData = new FormData();
      formData.append('file', f);
      try {
        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const { text } = await res.json();
        setCvText(text);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!cvText) return alert('No CV provided.');
    if (!apiKey) return alert('Please enter your Groq API Key.');

    setIsAnalyzing(true);
    setPdfData(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_text: cvText, job_desc: jobDesc, api_key: apiKey, boost_mode: boostMode, lang })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAnalysisResult(data);
      setEditedCvDataJSON(JSON.stringify(data._cv_data, null, 2));
      setPdfData(null);
    } catch (err: any) {
      alert("Analysis error: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGeneratePdf = async (cvDataOverride?: any) => {
    // Guard against React event objects being passed as data override
    const actualDataOverride = (cvDataOverride && cvDataOverride.nativeEvent) ? undefined : cvDataOverride;

    setIsGenerating(true);
    try {
      let cvDataToUse;

      if (actualDataOverride) {
        console.log('[PDF Gen] Using override data');
        cvDataToUse = actualDataOverride;
      } else if (editedCvDataJSON && editedCvDataJSON.trim()) {
        // ALWAYS use editedCvDataJSON if available - it's already clean JSON
        console.log('[PDF Gen] Using editedCvDataJSON');
        try {
          cvDataToUse = JSON.parse(editedCvDataJSON);
        } catch (e) {
          throw new Error("Erreur: Le format JSON dans l'onglet 'Edit Content' est invalide ! Veuillez corriger les erreurs de syntaxe.");
        }
      } else {
        // Fallback to example data
        console.log('[PDF Gen] Using fallback example data');
        cvDataToUse = cvExamples.marketing.cv_data;
      }

      const payload = {
        cv_data: {
          ...cvDataToUse,
          profile_photo: profilePhoto || undefined,  // Add photo to payload
          custom_style: {
            accent_color: customAccent || undefined,
            text_color: customText || undefined,
            heading_color: customHeading || undefined,
            subheading_color: customSubheading || undefined,
            name_color: customNameColor || undefined,
            sidebar_bg: customSidebarBg || undefined,
            main_bg: customMainBg || undefined,
            header_bg: customHeaderBg || undefined,
            photo_border_color: customPhotoBorder || undefined,
            font_scale: fontScale,
            font_family: fontFamily
          },
          lang: lang
        },
        theme: selectedTheme,
        is_cover_letter: false
      };
      const res = await fetch('/api/generate_cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Create Blob URL from base64
      const byteCharacters = atob(data.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
      setPdfData({ base64: data.pdf_base64, filename: `CV_${cvDataToUse.name.replace(/ /g, '_')}_${selectedTheme}.pdf` });
      setActiveTab('pdf');
      setNeedsUpdate(false);
    } catch (err: any) {
      alert("PDF Gen error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShuffleColors = async () => {
    const trimmedCompany = targetCompany.trim();

    // If we already have palettes for this company, cycle through them
    if (brandPalettes.length > 0 && trimmedCompany === brandPalettes[0].targetCompany) {
      const nextIdx = (paletteIndex + 1) % brandPalettes.length;
      const palette = brandPalettes[nextIdx];

      setCustomSidebarBg(palette.colors.primary);
      setCustomHeaderBg(palette.colors.primary);
      setCustomSubheading(palette.colors.secondary);
      setCustomAccent(palette.colors.accent);
      setCustomHeading(palette.colors.accent);
      setCustomPhotoBorder(palette.colors.accent);
      setCustomText(palette.colors.text);
      setCustomMainBg(palette.colors.background);

      setPaletteIndex(nextIdx);
      return;
    }

    // Otherwise, fetch new palettes
    if (!trimmedCompany) return alert('Veuillez saisir un nom d\'entreprise.');
    if (!apiKey) return alert('Veuillez saisir votre clé API Groq dans la barre latérale.');

    setIsLoadingColors(true);
    try {
      const res = await fetch('/api/company-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: trimmedCompany, api_key: apiKey }),
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('[DEBUG-COLORS] Data received:', data);
      if (data.error) throw new Error(data.error);

      if (data.palettes && data.palettes.length > 0) {
        const palettesWithTarget = data.palettes.map((p: any) => ({ ...p, targetCompany: trimmedCompany }));
        setBrandPalettes(palettesWithTarget);

        const palette = palettesWithTarget[0];
        setCustomSidebarBg(palette.colors.primary);
        setCustomHeaderBg(palette.colors.primary);
        setCustomSubheading(palette.colors.secondary);
        setCustomAccent(palette.colors.accent);
        setCustomHeading(palette.colors.accent);
        setCustomPhotoBorder(palette.colors.accent);
        setCustomText(palette.colors.text);
        setCustomMainBg(palette.colors.background);

        setPaletteIndex(0);
      }
    } catch (err: any) {
      alert("Erreur couleurs: " + err.message);
    } finally {
      setIsLoadingColors(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = pdfData?.filename || 'CV_Generated.pdf';
    link.click();
  };

  return (
    <div className="page-container">
      <OnboardingTour />
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="brand">
          <div className="brand-hex">⬡</div>
          <div className="brand-text">
            <div className="brand-name">RecruitIQ</div>
            <div className="brand-tag">ATS Intelligence v4.0</div>
          </div>
        </div>

        {/* Profile Photo Upload */}
        <div data-tour="photo-upload" style={{ marginBottom: '1rem' }}>
          <div className="slabel">/ Photo de Profil (Optionnel)</div>
          <div style={{
            border: '1px dashed var(--border2)',
            background: 'var(--card)',
            borderRadius: 'var(--r-md)',
            padding: '1rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
            onClick={() => document.getElementById('photo-input')?.click()}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gold)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
          >
            {photoPreview ? (
              <div style={{ position: 'relative' }}>
                <img src={photoPreview} alt="Preview" style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--gold)'
                }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setProfilePhoto(''); setPhotoPreview(''); }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 'calc(50% - 50px)',
                    background: 'var(--red)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>📷</div>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: 'var(--text2)', margin: 0 }}>
                  {photoUploading ? 'Traitement...' : 'Cliquez pour ajouter une photo'}
                </p>
                <p style={{ fontSize: '0.55rem', color: 'var(--text3)', marginTop: '0.3rem' }}>
                  Détection automatique du visage • Max 10MB
                </p>
              </>
            )}
            <input
              id="photo-input"
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setPhotoUploading(true);
                try {
                  const formData = new FormData();
                  formData.append('photo', file);
                  formData.append('shape', 'circle');
                  formData.append('targetSize', '300');

                  const res = await fetch('/api/upload_photo', {
                    method: 'POST',
                    body: formData
                  });

                  const data = await res.json();
                  if (data.error) throw new Error(data.error);

                  setProfilePhoto(data.photo_base64);
                  setPhotoPreview(`data:image/jpeg;base64,${data.photo_base64}`);
                } catch (err: any) {
                  alert('Erreur upload photo: ' + err.message);
                } finally {
                  setPhotoUploading(false);
                }
              }}
            />
          </div>
        </div>

        {/* UI Theme Toggle */}
        <button
          onClick={toggleUiTheme}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: '0.65rem',
            fontFamily: 'Space Mono, monospace',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {uiTheme === 'dark' ? '☀️ SOTA Luxury Light' : '🌙 Dark Mode'}
        </button>

        <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
          {sidebarOpen ? '▲ Hide settings' : '▼ Show settings — API key, CV, job offer'}
        </button>

        <div className={`sidebar-body${sidebarOpen ? '' : ' collapsed'}`}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="plan-badge" style={{ flex: 1 }}>◈ Pro Plan Active</div>
            <button
              onClick={() => (window as any).__resetTour?.()}
              title="Relancer la visite guidée"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 8px', marginLeft: 8,
                color: 'var(--text3)', cursor: 'pointer', fontSize: '0.75rem',
                transition: 'all 0.2s', flexShrink: 0
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--gold)'; (e.target as HTMLElement).style.color = 'var(--gold)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text3)'; }}
            >
              ?
            </button>
          </div>

          <div>
            <div className="slabel">/ API Key (Groq)</div>
            <input
              type="password"
              className="input-field"
              placeholder="gsk_••••••••••"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div>
            <div className="slabel">/ Job Description</div>
            <textarea
              className="input-field"
              placeholder="Paste the job listing..."
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
            ></textarea>
          </div>

          <div>
            <div className="slabel">/ Upload CV</div>
            <div className="file-drop" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="icon" />
              <p>{file ? file.name : "Click to select PDF"}</p>
              <input disabled={isAnalyzing} type="file" ref={fileInputRef} hidden accept="application/pdf" onChange={handleFileChange} />
            </div>
          </div>

          <button className="btn-primary" onClick={handleAnalyze} disabled={isAnalyzing || (!cvText && !file)}>
            {isAnalyzing ? "Analyzing CV..." : "⬡ LAUNCH AUDIT"}
          </button>

          <div
            data-tour="boost"
            onClick={() => setBoostMode(b => !b)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: boostMode ? 'rgba(200,169,110,0.1)' : 'var(--surface)',
              border: `1px solid ${boostMode ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
              background: boostMode ? 'var(--gold)' : 'transparent',
              border: `2px solid ${boostMode ? 'var(--gold)' : 'var(--text3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {boostMode && <span style={{ color: '#000', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: boostMode ? 'var(--gold)' : 'var(--text1)' }}>
                ⚡ Mode Boost Marché
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>
                L'IA enrichit vos expériences avec les compétences du poste, même si non explicitement mentionnées. Résultat plus compétitif, à relire avant envoi.
              </div>
            </div>
          </div>

          <div data-tour="lang" style={{ display: 'flex', gap: '6px' }}>
            {(['fr', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: '7px', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                  background: lang === l ? 'var(--gold)' : 'var(--surface)',
                  color: lang === l ? '#000' : 'var(--text3)',
                  border: `1px solid ${lang === l ? 'var(--gold)' : 'var(--border)'}`,
                  transition: 'all 0.2s'
                }}
              >
                {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </button>
            ))}
          </div>

          <div className="example-cvs">
            <div className="slabel" style={{ marginTop: '1rem' }}>/ Or Load Template</div>
            <button className="example-cv-btn" onClick={() => loadExample('marketing')}>
              <strong style={{ color: 'var(--gold-bright)' }}>Marketing Leader CV</strong>
              <span>91/100 ATS Score</span>
            </button>
            <button className="example-cv-btn" onClick={() => loadExample('dev')}>
              <strong style={{ color: 'var(--gold-bright)' }}>Senior Fullstack Dev CV</strong>
              <span>95/100 ATS Score</span>
            </button>
            <button className="example-cv-btn" onClick={() => loadExample('sales')}>
              <strong style={{ color: 'var(--gold-bright)' }}>Enterprise Sales Director</strong>
              <span>94/100 ATS Score</span>
            </button>
          </div>
        </div>{/* sidebar-body */}
      </div>{/* sidebar */}

      {/* MAIN */}
      <div className="main-content">
        <div className="hero">
          <div>
            <div className="eyebrow">Studio Grade Generator</div>
            <h1>Is your CV passing the<br /><em>AI screeners</em>?</h1>
            <p className="hero-sub">Complete ATS Analysis · AI Rewriting · Pixel-Perfect PDF Export</p>
          </div>
        </div>

        {!analysisResult ? (
          <div className="empty">
            {isAnalyzing ? (
              <>
                <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                <h3 style={{ color: 'var(--gold-bright)' }}>Analyzing with Groq AI...</h3>
                <p>Running multi-agent diagnostics on your resume...</p>
              </>
            ) : (
              <>
                <Sparkles size={48} opacity={0.3} style={{ color: 'var(--gold)' }} />
                <h3>Ready to Analyze</h3>
                <p>Upload a PDF and enter an API key, or load a pre-configured template from the sidebar to instantly see the results in action.</p>
                <div className="features">
                  <span className="feature-tag">ATS Profiling</span>
                  <span className="feature-tag">Pixel Perfect PDFs</span>
                  <span className="feature-tag">Next.js Architecture</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="kpis">
              <div className={`kpi ${analysisResult.global_score >= 80 ? 'ok' : 'warn'}`}>
                <div className="kpi-l">Global Score</div>
                <div className={`kpi-v ${analysisResult.global_score >= 80 ? 'green' : 'gold'}`}>{analysisResult.global_score}</div>
                <div className="kpi-s">/ 100 points</div>
              </div>
              <div className={`kpi ${analysisResult.ats_pass_probability >= 80 ? 'ok' : 'warn'}`}>
                <div className="kpi-l">ATS Pass.</div>
                <div className={`kpi-v ${analysisResult.ats_pass_probability >= 80 ? 'green' : 'gold'}`}>{analysisResult.ats_pass_probability}%</div>
                <div className="kpi-s">system bypass</div>
              </div>
              <div className="kpi danger">
                <div className="kpi-l">Salary Gap</div>
                <div className="kpi-v red">-{analysisResult.salary_gap}</div>
                <div className="kpi-s">Estimated: {analysisResult.salary_estimate}</div>
              </div>
            </div>

            {/* TABS MENU */}
            <div className="tabs">
              <button className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>⬡ Audit</button>
              <button className={`tab ${activeTab === 'sections' ? 'active' : ''}`} onClick={() => setActiveTab('sections')}>◈ Sections</button>
              <button className={`tab ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>✏️ Content</button>
              <button data-tour="pdf-tab" className={`tab ${activeTab === 'pdf' ? 'active' : ''}`} onClick={() => setActiveTab('pdf')}>🎨 CV PDF Export</button>
              <button className={`tab ${activeTab === 'tips' ? 'active' : ''}`} onClick={() => setActiveTab('tips')}>💡 Pro Tips</button>
            </div>

            {/* TAB: AUDIT */}
            {activeTab === 'audit' && (
              <div>
                <div className="card">
                  <div className="card-hd">Market Verdict</div>
                  <p className="verdict-text" style={{ fontStyle: 'italic', marginBottom: '1.2rem' }}>"{analysisResult.market_value_verdict}"</p>

                  <div className="ins cyan">
                    <div className="ins-l">Top Strength</div>
                    <p>{analysisResult.top_strength}</p>
                  </div>
                  <div className="ins danger">
                    <div className="ins-l">Why you might be ignored</div>
                    <p>{analysisResult.psychology?.pourquoi_ignore}</p>
                  </div>
                </div>

                <div className="keywords-grid">
                  <div className="card">
                    <div className="card-hd">✓ Present Keywords</div>
                    <div className="tags">
                      {analysisResult.present_keywords?.map((k: string) => <span key={k} className="tag pres">{k}</span>)}
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-hd">✗ Missing Keywords</div>
                    <div className="tags">
                      {analysisResult.missing_keywords?.map((k: string) => <span key={k} className="tag miss">{k}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TIPS */}
            {activeTab === 'tips' && (
              <div className="card" style={{ padding: '0' }}>
                <div className="card-hd" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>🚀 RecruitIQ Pro Tips</div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                  <div className="ins cyan" style={{ margin: 0 }}>
                    <div className="ins-l">🔗 Liens Hypertextes</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Pour ajouter des liens cliquables (LinkedIn, Portfolio, etc.), utilisez le format :<br />
                      <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>MonLien[https://url.com]</code>
                    </p>
                  </div>

                  <div className="ins gold" style={{ margin: 0 }}>
                    <div className="ins-l">🎨 Branding sur mesure</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Utilisez l'onglet <strong>CV PDF Export</strong> et saisissez le nom de l'entreprise cible dans <strong>AI Brand Identity</strong> pour matcher automatiquement ses couleurs officielles.
                    </p>
                  </div>

                  <div className="ins" style={{ margin: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div className="ins-l">📸 Photo de Profil</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Les thèmes comme <strong>Executive</strong> ou <strong>Nordic</strong> fonctionnent mieux avec une photo carrée recadrée sur le visage.
                    </p>
                  </div>

                  <div className="ins" style={{ margin: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div className="ins-l">✏️ Édition de Masse</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Si vous avez déjà un CV structuré en JSON, utilisez l'onglet <strong>Content</strong> pour tout copier-coller d'un coup et gagner du temps !
                    </p>
                  </div>

                  <div className="ins danger" style={{ margin: 0 }}>
                    <div className="ins-l">🤖 Optimisation ATS</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Regardez l'onglet <strong>Audit</strong> : les "Missing Keywords" sont cruciaux. Intégrez-les naturellement dans vos descriptions pour augmenter votre probabilité de passage.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SECTIONS */}
            {activeTab === 'sections' && (
              <div>
                <div className="sgrid">
                  {Object.entries(analysisResult.sections || {}).map(([key, val]: [string, any]) => (
                    <div key={key} className="sitem">
                      <div className="sitem-l" style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</div>
                      <div className={`sitem-v ${val >= 8 ? 'hi' : val >= 5 ? 'md' : 'lo'}`}>
                        {val} <span className="sitem-denom">/10</span>
                      </div>
                      <div className="sbar">
                        <div className="sbar-fill" style={{ width: `${val * 10}%`, background: val >= 8 ? 'var(--green)' : val >= 5 ? 'var(--amber)' : 'var(--red)' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* TAB: EDIT CONTENT */}
            {activeTab === 'edit' && (
              <div>
                <div className="card-hd">✏️ Editeur Haute Résolution (JSON)</div>
                <p style={{ color: 'var(--text2)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  Vous pouvez modifier librement le texte de votre CV ici avant de générer le PDF.
                  Assurez-vous de conserver un format JSON valide !
                </p>
                <textarea
                  className="input-field mono"
                  value={editedCvDataJSON}
                  onChange={(e) => setEditedCvDataJSON(e.target.value)}
                  style={{ fontSize: '0.7rem', padding: '1rem', lineHeight: '1.4', background: 'var(--surface)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button className="btn-primary btn-save" onClick={() => { handleGeneratePdf(); setActiveTab('pdf'); }}>
                    ✓ SAUVEGARDER & ALLER À L'EXPORT PDF
                  </button>
                </div>
              </div>
            )}

            {/* TAB: PDF EXPORT */}
            {activeTab === 'pdf' && (
              <div>
                <div className="card-hd" onClick={() => setShowAllThemes(!showAllThemes)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🎨 Select Premium Theme <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.8rem' }}>— 26 themes (16 standard + 10 photo)</span></span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--gold)', fontFamily: 'Space Mono, monospace' }}>{showAllThemes ? '[- Hide]' : '[+ Show All]'}</span>
                </div>
                <div data-tour="all-themes">
                  {!showAllThemes ? (
                    <div style={{ marginBottom: '1.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recommended Themes</div>
                      </div>
                      <div className="theme-carousel" style={{ flexWrap: 'wrap', gap: '8px' }}>
                        {ALL_THEMES.slice(0, 3).map(t => (
                          <div key={t.name} className={`theme-card ${selectedTheme === t.name ? 'active' : ''}`} onClick={() => { setSelectedTheme(t.name); setPdfData(null); }}>
                            <div className="theme-preview" style={{ background: t.color, border: `2px solid ${t.accent}`, position: 'relative' }}>
                              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: t.accent }}></div>
                            </div>
                            <div className="theme-title" style={{ fontSize: '0.65rem', lineHeight: 1.2 }}>{t.name}</div>
                            <div style={{ fontSize: '0.58rem', color: 'var(--text3)', lineHeight: 1.2, marginTop: 1 }}>{t.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: '0.5rem' }}></div>
                      {THEME_CATEGORIES.map(cat => (
                        <div key={cat.label} style={{ marginBottom: '1.2rem' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{cat.label}</div>
                          <div className="theme-carousel" style={{ flexWrap: 'wrap', gap: '8px' }}>
                            {cat.themes.map(t => (
                              <div key={t.name} className={`theme-card ${selectedTheme === t.name ? 'active' : ''}`} onClick={() => { setSelectedTheme(t.name); setPdfData(null); }}>
                                <div className="theme-preview" style={{ background: t.color, border: `2px solid ${t.accent}`, position: 'relative' }}>
                                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: t.accent }}></div>
                                </div>
                                <div className="theme-title" style={{ fontSize: '0.65rem', lineHeight: 1.2 }}>{t.name}</div>
                                <div style={{ fontSize: '0.58rem', color: 'var(--text3)', lineHeight: 1.2, marginTop: 1 }}>{t.desc}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* CV STUDIO CUSTOMIZATION PANEL */}
                <div className="custom-panel" data-tour="customization">
                  <div className="custom-panel-header" onClick={() => setCustomOpen(!customOpen)}>
                    <h4><span>✨</span> CV Studio Customization</h4>
                    <span className={`toggle-icon ${customOpen ? 'open' : ''}`}>▼</span>
                  </div>
                  <div className={`custom-panel-body ${customOpen ? 'open' : ''}`}>
                    {/* NEW BRAND IDENTITY SECTION */}
                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>AI Brand Identity</div>
                    <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="custom-field" style={{ width: '100%' }}>
                        <label>Target Company</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Google, OpenAi, Amazon..."
                            value={targetCompany}
                            onChange={(e) => setTargetCompany(e.target.value)}
                            maxLength={50}
                            style={{ margin: 0, height: '32px', fontSize: '0.75rem' }}
                          />
                          <button
                            className="btn-primary"
                            onClick={handleShuffleColors}
                            disabled={isLoadingColors}
                            style={{ padding: '0 12px', height: '32px', minWidth: 'auto', background: 'var(--gold)' }}
                            title="Shuffle AI Brand Colors"
                          >
                            {isLoadingColors ? '...' : (brandPalettes.length > 0 && targetCompany === brandPalettes[0].targetCompany ? '✨ Shuffle' : '⭐ Get Colors')}
                          </button>
                        </div>
                      </div>
                      {brandPalettes.length > 0 && targetCompany === brandPalettes[0].targetCompany && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--gold)', fontFamily: 'Space Mono, monospace' }}>
                          Using Palette {paletteIndex + 1}/4: {brandPalettes[paletteIndex].name}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Layout & Backgrounds</div>
                    <div className="custom-row">
                      <div className="custom-field">
                        <label>Sidebar / Menu</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customSidebarBg || getThemeDefaults().sidebar}
                            onChange={(e) => setCustomSidebarBg(e.target.value)}
                            onBlur={(e) => setCustomSidebarBg(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Header / Top</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customHeaderBg || getThemeDefaults().header}
                            onChange={(e) => setCustomHeaderBg(e.target.value)}
                            onBlur={(e) => setCustomHeaderBg(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Main Background</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customMainBg || getThemeDefaults().main}
                            onChange={(e) => setCustomMainBg(e.target.value)}
                            onBlur={(e) => setCustomMainBg(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '12px' }}>Typography & Content</div>
                    <div className="custom-row">
                      <div className="custom-field">
                        <label>My Name</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customNameColor || getThemeDefaults().name}
                            onChange={(e) => setCustomNameColor(e.target.value)}
                            onBlur={(e) => setCustomNameColor(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Section Titles</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customHeading || getThemeDefaults().heading}
                            onChange={(e) => setCustomHeading(e.target.value)}
                            onBlur={(e) => setCustomHeading(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Post / Roles</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customSubheading || getThemeDefaults().subheading}
                            onChange={(e) => setCustomSubheading(e.target.value)}
                            onBlur={(e) => setCustomSubheading(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="custom-row">
                      <div className="custom-field">
                        <label>Body Text</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customText || getThemeDefaults().text}
                            onChange={(e) => setCustomText(e.target.value)}
                            onBlur={(e) => setCustomText(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Brand Accent</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customAccent || getThemeDefaults().accent}
                            onChange={(e) => setCustomAccent(e.target.value)}
                            onBlur={(e) => setCustomAccent(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '12px' }}>Photo Profile (si applicable)</div>
                    <div className="custom-row">
                      <div className="custom-field">
                        <label>Photo Border</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customPhotoBorder || getThemeDefaults().accent}
                            onChange={(e) => setCustomPhotoBorder(e.target.value)}
                            onBlur={(e) => setCustomPhotoBorder(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="custom-slider-row" style={{ marginTop: '12px' }}>
                      <label>Global Font Size</label>
                      <input
                        type="range"
                        min="0.7"
                        max="1.4"
                        step="0.05"
                        value={fontScale}
                        onChange={(e) => setFontScale(parseFloat(e.target.value))}
                      />
                      <span className="slider-value">{fontScale.toFixed(2)}x</span>
                    </div>

                    <div className="custom-field" style={{ marginTop: '12px' }}>
                      <label>Font Family (ATS Safety)</label>
                      <select
                        className="input-field"
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        style={{ background: 'var(--card)', color: 'var(--text)', fontSize: '0.75rem' }}
                      >
                        <option value="Poppins">Modern (Poppins)</option>
                        <option value="Roboto">Standard (Roboto - Safe)</option>
                        <option value="Lora">Elegant (Lora - Serif)</option>
                        <option value="Inter">Clean (Inter)</option>
                        <option value="Times-Roman">Traditional (Times)</option>
                      </select>
                    </div>

                    <div className="custom-actions">
                      <button className="btn-reset" onClick={resetCustomization}>Reset to Theme Defaults</button>
                    </div>
                  </div>
                </div>

                {!pdfData ? (
                  <div className="card pdf-generate-card" style={{ textAlign: 'center' }}>
                    <LayoutTemplate size={48} opacity={0.3} style={{ margin: '0 auto 1rem', color: 'var(--gold)' }} />
                    <h3 style={{ marginBottom: '1rem' }}>Generate Studio PDF</h3>
                    <p style={{ color: 'var(--text2)', marginBottom: '2rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                      Our Python Worker uses exact coordinates via ReportLab to draw an incredibly beautiful ATS-friendly layout.
                    </p>
                    <button data-tour="generate-pdf-btn" className="btn-primary" onClick={() => handleGeneratePdf()} style={{ maxWidth: '300px', margin: '0 auto', display: 'block' }} disabled={isGenerating}>
                      {isGenerating ? "GENERATING PDF..." : "GENERATE PDF PREVIEW"}
                    </button>
                  </div>
                ) : (
                  <>
                    {visualEditMode ? (
                      <div style={{ height: '800px', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                        <SimplePDFEditor
                          cvData={editedCvDataJSON ? JSON.parse(editedCvDataJSON) : (analysisResult?._cv_data || cvExamples.marketing.cv_data)}
                          onUpdate={(newData) => {
                            setEditedCvDataJSON(JSON.stringify(newData, null, 2));
                            setTimeout(() => handleGeneratePdf(newData), 1200);
                          }}
                          pdfUrl={pdfUrl}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="editor-bar">
                          <div className="ed-dot" style={{ background: '#e05252' }}></div>
                          <div className="ed-dot" style={{ background: '#e8a030' }}></div>
                          <div className="ed-dot" style={{ background: '#52c97a' }}></div>
                          <span className="ed-title">{pdfData.filename} — Powered by Next.js + Python Worker</span>
                          <div style={{ flex: 1 }}></div>
                          <button
                            className="visual-edit-toggle active"
                            onClick={() => setIsFullscreenUI(true)}
                            style={{ fontSize: '0.55rem', padding: '4px 10px' }}
                          >
                            ⛶ FULLSCREEN
                          </button>
                        </div>
                        <div className={`cv-preview ${isFullscreenUI ? 'pseudo-fullscreen' : ''}`} style={{ padding: 0, background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
                          {isFullscreenUI && (
                            <button className="fullscreen-close-btn" onClick={() => setIsFullscreenUI(false)}>
                              ✕ Fermer le plein écran
                            </button>
                          )}
                          <iframe
                            id="pdf-iframe"
                            key={pdfUrl} // Force re-render on URL change
                            src={`${pdfUrl}#toolbar=0&view=FitH`}
                            className="pdf-iframe"
                            style={{ border: 'none', display: 'block', width: '100%', height: isFullscreenUI ? '100vh' : '820px' }}
                          />
                        </div>
                      </>
                    )}
                    <div className="pdf-actions" style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                      <button
                        className={`btn-outline ${visualEditMode ? '' : 'visual-edit-toggle'}`}
                        onClick={() => setVisualEditMode(!visualEditMode)}
                        style={{ maxWidth: '300px' }}
                      >
                        <Wand2 size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                        {visualEditMode ? '← Retour à la Preview' : '✏️ Mode Édition Visuelle'}
                      </button>
                      <button className={`btn-outline ${needsUpdate ? 'pulse-gold' : ''}`} onClick={() => handleGeneratePdf()} disabled={isGenerating} style={{ maxWidth: '300px' }}>
                        {needsUpdate ? "✨ Updating Design..." : "Mettre à jour le design"}
                      </button>
                      <button className="btn-primary" onClick={downloadPdf} style={{ maxWidth: '300px' }}>
                        <Download size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                        TÉLÉCHARGER
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* PERSISTENT FOOTER - PROFESSIONAL PRIVACY SHIELD */}
        <footer style={{ 
          marginTop: '5rem', 
          padding: '4rem 2rem', 
          borderTop: '2px solid var(--border)', 
          background: 'var(--surface-subtle)',
          borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
          position: 'relative'
        }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '12px', 
              marginBottom: '2.5rem',
              color: 'var(--gold)'
            }}>
              <ShieldCheck size={28} />
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, letterSpacing: '0.15em', textTransform: 'uppercase' }}>RecruitIQ Privacy Shield</h2>
                <p style={{ fontSize: '0.65rem', opacity: 0.6, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conformité RGPD & Protection des Données (v4.1)</p>
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '2.5rem', 
              textAlign: 'left',
              marginBottom: '3rem'
            }}>
              
              <div className="privacy-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', color: 'var(--gold-bright)' }}>
                  <Lock size={18} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Traitement Ephémère</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: '1.6' }}>
                  <strong>Engagement 0-Day Retention :</strong> RecruitIQ opère exclusivement en mémoire vive (RAM). 
                  Vos CV, photos et offres d'emploi ne sont jamais enregistrés dans une base de données persistante.
                  Une fois votre session fermée, les données sont atomiquement purgées.
                </p>
              </div>

              <div className="privacy-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', color: 'var(--gold-bright)' }}>
                  <Server size={18} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Flux Sécurisés Cloud</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: '1.6' }}>
                  <strong>Transit HTTPS/TLS :</strong> Vos données textuelles sont transmises via tunnel sécurisé aux API de <strong>Groq Cloud</strong> 
                  pour l'analyse LLM. Les photos subissent un pré-traitement local sur notre instance temporaire, 
                  et tout fichier résiduel sur disque est supprimé immédiatement après encodage.
                </p>
              </div>

              <div className="privacy-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', color: 'var(--gold-bright)' }}>
                  <Eye size={18} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Vos Droits RGPD</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: '1.6' }}>
                  Conformément au règlement (UE) 2016/679, vous disposez d'un droit total d'accès, de rectification, 
                  et d'effacement. L'absence de stockage persistant garantit un <strong>droit à l'oubli automatique</strong> 
                  par simple fermeture du navigateur. Votre clé API Groq reste locale à votre session.
                </p>
              </div>

            </div>

            <div style={{ 
              borderTop: '1px solid var(--border)', 
              paddingTop: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{ 
                display: 'flex', 
                gap: '2rem', 
                fontSize: '0.62rem', 
                color: 'var(--text3)', 
                fontFamily: 'Space Mono, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> AES-256 TLS 1.3</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> In-Memory Processing</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> ISO 27001 Ready</span>
              </div>
              <div style={{ fontSize: '0.6rem', opacity: 0.4, color: 'var(--text3)' }}>
                RecruitIQ © 2026 — Plateforme d'Intelligence CV Indépendante — Hébergement Sécurisé via Render
              </div>
            </div>

          </div>
        </footer>
      </div>
    </div>
  );
}
