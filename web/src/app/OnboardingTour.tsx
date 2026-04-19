'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const STEPS = [
  {
    target: '.brand',
    title: 'Bienvenue sur RIIS ⧡',
    desc: 'La plateforme tout-en-un : analysez votre CV avec l\'IA, optimisez-le pour les ATS, comparez-le aux systèmes ATS réels, exportez en 26 thèmes PDF premium et matchez avec des offres d\'emploi en temps réel.',
    position: 'right' as const,
  },
  {
    target: '.file-drop',
    title: '📄 1. Uploadez votre CV',
    desc: 'Déposez votre CV PDF + collez une offre d\'emploi. L\'IA extrait, analyse votre score ATS 0-100 et réécrit votre CV pour maximiser vos chances. La clé Groq (gratuite) alimente toute l\'analyse.',
    position: 'right' as const,
  },
  {
    target: '.kpis',
    title: '📊 2. Audit ATS + Comparaison',
    desc: 'Score global, keywords présents/manquants, insights psychologiques du recruteur, estimation salariale. Le Simulateur ATS compare votre CV aux systèmes réels : Greenhouse, Lever, Workday, SAP SuccessFactors...',
    position: 'bottom' as const,
  },
  {
    target: '.tabs',
    title: '✏️ 3. Edit Content',
    desc: 'Éditez votre CV structuré en JSON. Auto-sauvegarde après 3 min d\'inactivité. Erreurs de syntaxe signalées en temps réel. Utilisez "Save & Export" pour forcer la génération immédiate.',
    position: 'bottom' as const,
  },
  {
    target: '[data-tour="pdf-tab"]',
    title: '🎨 4. CV PDF Export',
    desc: '26 thèmes premium (16 Standard + 10 ATS-Optimized). Personnalisez couleurs, polices, taille. Brand Accent, détails formations, catégories compétences en gras — tout s\'intègre automatiquement.',
    position: 'bottom' as const,
    action: 'switchToPdfTab' as const,
  },
  {
    target: '.tabs',
    title: '💼 5. Smart Job Matcher',
    desc: 'Connectez Adzuna (clé gratuite) pour trouver les offres qui matchent votre profil. Filtre géo strict, tags sémantiques éditables, scoring basé sur vos compétences CV — sans consommer de tokens IA.',
    position: 'bottom' as const,
    action: 'switchToJobTab' as const,
  },
];

function getRect(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

export default function OnboardingTour() {
  const [show, setShow] = useState(false);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [showDemoOption, setShowDemoOption] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const done = localStorage.getItem('RIIS_tour_done');
      if (!done) setTimeout(() => setShow(true), 600);
    } catch {
      setTimeout(() => setShow(true), 600);
    }
  }, []);

  // Expose reset for dev — remove in prod if needed
  useEffect(() => {
    (window as any).__resetTour = () => {
      localStorage.removeItem('RIIS_tour_done');
      setShow(true);
      setActive(false);
      setStep(0);
    };
  }, []);

  const updateRect = useCallback(() => {
    const el = document.querySelector(STEPS[step].target);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Wait for scroll and potential tab transitions to finish before measuring
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect(r);
    }, 800); // Increased delay for smoother stabilization
  }, [step]);

  useEffect(() => {
    if (!active) return;
    
    // Execute action for current step after a delay
    const currentStep = STEPS[step];
    let actionTimeout: NodeJS.Timeout;
    
    if (currentStep.action === 'switchToPdfTab') {
      actionTimeout = setTimeout(() => {
        try {
          const pdfTab = Array.from(document.querySelectorAll('.tab')).find(
            el => el.textContent?.includes('PDF Export')
          ) as HTMLElement;
          if (pdfTab) pdfTab.click();
        } catch (e) { console.log('Could not switch tab:', e); }
      }, 800);
    } else if (currentStep.action === 'switchToJobTab') {
      actionTimeout = setTimeout(() => {
        try {
          const jobTab = Array.from(document.querySelectorAll('.tab')).find(
            el => el.textContent?.includes('Job') || el.textContent?.includes('Match')
          ) as HTMLElement;
          if (jobTab) jobTab.click();
        } catch (e) { console.log('Could not switch to job tab:', e); }
      }, 800);
    } else if (currentStep.action === 'generatePdf') {
      actionTimeout = setTimeout(() => {
        try {
          const generateBtn = Array.from(document.querySelectorAll('.btn-primary')).find(
            el => el.textContent?.includes('GENERATE PDF')
          ) as HTMLElement;
          if (generateBtn) generateBtn.click();
        } catch (e) {
          console.log('Could not generate PDF:', e);
        }
      }, 800);
    }
    
    updateRect();
    window.addEventListener('resize', updateRect);
    
    return () => {
      window.removeEventListener('resize', updateRect);
      if (actionTimeout) clearTimeout(actionTimeout);
    };
  }, [active, step, updateRect]);

  const startTour = () => { setShow(false); setActive(true); setStep(0); };
  const startDemo = () => {
    setShow(false);
    // Charge le 1er exemple de CV pour la démo
    setTimeout(() => {
      const exampleBtn = document.querySelector('.example-cv-btn') as HTMLButtonElement;
      if (exampleBtn) exampleBtn.click();
      // Démarre le tour après chargement
      setTimeout(() => { setActive(true); setStep(0); }, 1500);
    }, 300);
  };
  const skip = () => { setShow(false); localStorage.setItem('RIIS_tour_done', '1'); };
  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  };
  const prev = () => { if (step > 0) setStep(s => s - 1); };
  const finish = () => { setActive(false); localStorage.setItem('RIIS_tour_done', '1'); };

  const PAD = 8;
  const tooltipW = typeof window !== 'undefined' && window.innerWidth <= 768
    ? Math.min(window.innerWidth - 40, 300)
    : 320;

  const tooltipStyle = (): React.CSSProperties => {
    if (!rect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
    const base: React.CSSProperties = { position: 'fixed', width: tooltipW, zIndex: 10001 };
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const isMobile = viewW <= 768;
    const isSmallMobile = viewW <= 480;

    let top: number;
    let left: number;

    if (isMobile) {
      // On mobile always show tooltip below the highlighted element, centered
      top = rect.bottom + PAD + 12;
      left = Math.max(10, Math.min(viewW - tooltipW - 10, viewW / 2 - tooltipW / 2));
      // If it goes off bottom, show above
      const tooltipHeight = isSmallMobile ? 280 : 240;
      if (top + tooltipHeight > viewH - 10) {
        top = Math.max(10, rect.top - tooltipHeight - PAD - 12);
      }
      // If still off screen, center it
      if (top < 10 || top + tooltipHeight > viewH - 10) {
        top = Math.max(10, (viewH - tooltipHeight) / 2);
      }
    } else {
      top = rect.top + rect.height / 2 - 80;
      left = rect.right + PAD + 12;
      // If tooltip goes off right edge, put it on the left
      if (left + tooltipW > viewW - 10) left = rect.left - tooltipW - PAD - 12;
      // Clamp vertically
      const tooltipH = 240;
      if (top + tooltipH > viewH - 10) top = viewH - tooltipH - 10;
      if (top < 10) top = 10;
    }

    return { ...base, left, top };
  };

  return (
    <>
      {/* Welcome modal */}
      {show && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(5,6,10,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--gold)',
            borderRadius: 20, padding: '2.5rem', maxWidth: 480, width: '90%',
            boxShadow: '0 0 60px rgba(212,168,83,0.15)', textAlign: 'center'
          }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 1.2rem',
              background: 'linear-gradient(135deg, var(--gold), var(--gold-bright))',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem'
            }}>⬡</div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.6rem' }}>Bienvenue sur RIIS</h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.8rem' }}>
              Votre CV passe-t-il les filtres ATS ? Analyse IA, comparaison multi-ATS, 26 thèmes PDF et matching d\'offres en temps réel.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.72rem', color: 'var(--text3)' }}>
              <span>📊 Audit ATS</span><span>·</span>
              <span>🤖 Simulateur multi-ATS</span><span>·</span>
              <span>🎨 26 thèmes PDF</span><span>·</span>
              <span>💼 Smart Job Matcher</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '1.5rem' }}>
              <button
                onClick={startDemo}
                style={{
                  background: 'linear-gradient(135deg, var(--gold), var(--gold-bright))',
                  color: '#05060a', border: 'none', borderRadius: 8,
                  padding: '0.85rem 1.8rem', fontFamily: 'Space Mono, monospace',
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(212, 168, 83, 0.3)'
                }}
              >
                🎯 Démo Complète (CV pré-chargé + Tour)
              </button>
              <button
                onClick={startTour}
                style={{
                  background: 'transparent',
                  color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 8,
                  padding: '0.75rem 1.8rem', fontFamily: 'Space Mono, monospace',
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                ▶ Visite Guidée (Mon propre CV)
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={skip}
                style={{
                  background: 'transparent', color: 'var(--text3)',
                  border: 'none', borderRadius: 8,
                  padding: '0.5rem 1rem', fontFamily: 'Space Mono, monospace',
                  fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em',
                  textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                Passer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tour overlay */}
      {active && (
        <>
          {/* Dark overlay with hole */}
          <div ref={overlayRef} style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>
            {rect && (
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <mask id="hole">
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={rect.left - PAD} y={rect.top - PAD}
                      width={rect.width + PAD * 2} height={rect.height + PAD * 2}
                      rx={8} fill="black"
                    />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(5,6,10,0.75)" mask="url(#hole)" />
                <rect
                  x={rect.left - PAD} y={rect.top - PAD}
                  width={rect.width + PAD * 2} height={rect.height + PAD * 2}
                  rx={8} fill="none" stroke="var(--gold)" strokeWidth={2}
                  style={{ filter: 'drop-shadow(0 0 8px rgba(212,168,83,0.6))' }}
                />
              </svg>
            )}
          </div>

          {/* Tooltip */}
          <div style={{
            ...tooltipStyle(),
            background: 'var(--card)', border: '1px solid var(--gold)',
            borderRadius: 14, padding: '1.4rem',
            boxShadow: '0 8px 40px rgba(212,168,83,0.2)',
            pointerEvents: 'all'
          }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 4, marginBottom: '1rem' }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= step ? 'var(--gold)' : 'var(--border)',
                  transition: 'background 0.3s'
                }} />
              ))}
            </div>

            <div style={{
              fontFamily: 'Space Mono, monospace', fontSize: '0.52rem',
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: 'var(--gold)', marginBottom: '0.5rem'
            }}>
              Étape {step + 1} / {STEPS.length}
            </div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.6rem', color: 'var(--text)' }}>
              {STEPS[step].title}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              {STEPS[step].desc}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={prev}
                disabled={step === 0}
                style={{
                  background: 'transparent', color: step === 0 ? 'var(--text3)' : 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '0.5rem 1rem', fontFamily: 'Space Mono, monospace',
                  fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: step === 0 ? 'not-allowed' : 'pointer', opacity: step === 0 ? 0.4 : 1
                }}
              >
                ← Préc.
              </button>
              <button onClick={finish} style={{
                background: 'transparent', color: 'var(--text3)', border: 'none',
                fontFamily: 'Space Mono, monospace', fontSize: '0.55rem',
                letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer'
              }}>
                Quitter
              </button>
              <button
                onClick={next}
                style={{
                  background: 'linear-gradient(135deg, var(--gold), var(--gold-bright))',
                  color: '#05060a', border: 'none', borderRadius: 6,
                  padding: '0.5rem 1rem', fontFamily: 'Space Mono, monospace',
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                {step === STEPS.length - 1 ? 'Terminer ✓' : 'Suiv. →'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
