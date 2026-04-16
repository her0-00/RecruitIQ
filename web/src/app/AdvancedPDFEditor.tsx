'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Wand2, Save, X, Eye, EyeOff } from 'lucide-react';

interface TextZone {
  id: string;
  path: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: 'left' | 'center' | 'right';
  multiline: boolean;
}

interface AdvancedPDFEditorProps {
  cvData: any;
  onUpdate: (newData: any) => void;
  pdfBase64: string;
  theme: string;
}

export default function AdvancedPDFEditor({ cvData, onUpdate, pdfBase64, theme }: AdvancedPDFEditorProps) {
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Définition précise des zones basée sur le layout réel du PDF
  const getTextZones = (): TextZone[] => {
    const zones: TextZone[] = [];

    // Fonction helper pour créer une zone
    const zone = (id: string, path: string, label: string, x: number, y: number, w: number, h: number, opts: any = {}) => ({
      id, path, label,
      x: (x / 595) * 100,
      y: ((842 - y - h) / 842) * 100, // Inverser Y car PDF commence en bas
      width: (w / 595) * 100,
      height: (h / 842) * 100,
      fontSize: opts.fontSize || 10,
      fontWeight: opts.fontWeight || 'normal',
      color: opts.color || '#000000',
      align: opts.align || 'left',
      multiline: opts.multiline || false
    });

    // ═══════════════════════════════════════════════════════════
    // HEADER SECTION (Dark background at top)
    // ═══════════════════════════════════════════════════════════
    
    // Name - Large white text at top
    zones.push(zone('name', 'name', 'Nom Complet', 22, 738, 250, 28, {
      fontSize: 28, fontWeight: 'bold', color: '#FFFFFF'
    }));

    // Title - Below name, gold/accent color
    zones.push(zone('title', 'title', 'Titre Professionnel', 22, 758, 250, 18, {
      fontSize: 13, color: '#C8A96E'
    }));

    // Contact line - Right side of header
    const contactY = 747;
    zones.push(zone('email', 'email', 'Email', 250, contactY, 120, 12, {
      fontSize: 7.5, color: '#E8EAF2'
    }));
    zones.push(zone('phone', 'phone', 'Téléphone', 380, contactY, 100, 12, {
      fontSize: 7.5, color: '#E8EAF2'
    }));
    zones.push(zone('location', 'location', 'Localisation', 490, contactY, 85, 12, {
      fontSize: 7.5, color: '#E8EAF2'
    }));

    // ═══════════════════════════════════════════════════════════
    // MAIN CONTENT AREA (Right side - white background)
    // ═══════════════════════════════════════════════════════════

    // Summary/Profile section
    zones.push(zone('summary', 'summary', 'Résumé Professionnel', 241, 570, 330, 80, {
      fontSize: 9.5, color: '#4A4E5C', multiline: true
    }));

    // Experiences section
    let currentY = 480; // Start position for experiences
    cvData.experiences?.forEach((exp: any, idx: number) => {
      // Role title
      zones.push(zone(`exp-${idx}-role`, `experiences.${idx}.role`, `Poste ${idx + 1}`, 
        241, currentY, 280, 16, {
        fontSize: 10.5, fontWeight: 'bold', color: '#1A1C22'
      }));

      // Period (right aligned)
      zones.push(zone(`exp-${idx}-period`, `experiences.${idx}.period`, `Période ${idx + 1}`, 
        480, currentY, 90, 12, {
        fontSize: 7.5, color: '#8A8FA0', align: 'right'
      }));

      currentY += 18;

      // Company name
      zones.push(zone(`exp-${idx}-company`, `experiences.${idx}.company`, `Entreprise ${idx + 1}`, 
        241, currentY, 250, 14, {
        fontSize: 8.5, fontWeight: '500', color: '#9A7840'
      }));

      currentY += 18;

      // Bullets
      exp.bullets?.forEach((bullet: string, bIdx: number) => {
        const bulletHeight = Math.min(bullet.length / 3, 30); // Adaptive height
        zones.push(zone(`exp-${idx}-bullet-${bIdx}`, `experiences.${idx}.bullets.${bIdx}`, 
          `Réalisation ${bIdx + 1}`, 254, currentY, 317, bulletHeight, {
          fontSize: 8.2, color: '#4A4E5C', multiline: true
        }));
        currentY += bulletHeight + 4;
      });

      currentY += 12; // Space between experiences
    });

    // Education section
    cvData.education?.forEach((edu: any, eduIdx: number) => {
      zones.push(zone(`edu-${eduIdx}-degree`, `education.${eduIdx}.degree`, `Diplôme ${eduIdx + 1}`, 
        241, currentY, 280, 16, {
        fontSize: 9.5, fontWeight: 'bold', color: '#1A1C22'
      }));

      zones.push(zone(`edu-${eduIdx}-year`, `education.${eduIdx}.year`, `Année ${eduIdx + 1}`, 
        480, currentY, 90, 12, {
        fontSize: 7.5, color: '#8A8FA0', align: 'right'
      }));

      currentY += 18;

      zones.push(zone(`edu-${eduIdx}-school`, `education.${eduIdx}.school`, `École ${eduIdx + 1}`, 
        241, currentY, 250, 14, {
        fontSize: 8.5, fontWeight: '500', color: '#9A7840'
      }));

      currentY += 20;
    });

    // ═══════════════════════════════════════════════════════════
    // SIDEBAR (Left side - dark background)
    // ═══════════════════════════════════════════════════════════

    // Skills section
    let sidebarY = 570;
    cvData.skills?.categories?.forEach((cat: any, catIdx: number) => {
      zones.push(zone(`skill-cat-${catIdx}`, `skills.categories.${catIdx}.name`, 
        `Catégorie ${catIdx + 1}`, 14, sidebarY, 157, 12, {
        fontSize: 7.5, fontWeight: '500', color: '#E8C98E'
      }));
      sidebarY += 70; // Space for skills tags
    });

    // Languages section
    sidebarY = 380;
    cvData.languages?.forEach((lang: any, langIdx: number) => {
      zones.push(zone(`lang-${langIdx}-lang`, `languages.${langIdx}.lang`, 
        `Langue ${langIdx + 1}`, 14, sidebarY, 120, 12, {
        fontSize: 8, fontWeight: '500', color: '#E8EAF2'
      }));

      zones.push(zone(`lang-${langIdx}-level`, `languages.${langIdx}.level`, 
        `Niveau ${langIdx + 1}`, 14, sidebarY + 12, 120, 10, {
        fontSize: 6.5, color: '#6A6E82'
      }));

      sidebarY += 28;
    });

    // Certifications
    cvData.certifications?.forEach((cert: string, certIdx: number) => {
      zones.push(zone(`cert-${certIdx}`, `certifications.${certIdx}`, 
        `Certification ${certIdx + 1}`, 25, sidebarY, 146, 20, {
        fontSize: 7, color: '#6A6E82', multiline: true
      }));
      sidebarY += 24;
    });

    return zones;
  };

  const zones = getTextZones();

  const getValueByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  };

  const setValueByPath = (obj: any, path: string, value: any): any => {
    const newObj = JSON.parse(JSON.stringify(obj));
    const parts = path.split('.');
    let current = newObj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) current[part] = {};
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    return newObj;
  };

  const handleZoneClick = (zoneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingZone(zoneId);
  };

  const handleChange = (zoneId: string, newValue: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;

    const newData = setValueByPath(cvData, zone.path, newValue);
    onUpdate(newData);
  };

  const handleSave = () => {
    setEditingZone(null);
  };

  const handleCancel = () => {
    setEditingZone(null);
  };

  return (
    <div className="advanced-pdf-editor" ref={containerRef}>
      {/* Toolbar */}
      <div className="pdf-editor-toolbar">
        <div className="toolbar-section">
          <Wand2 size={16} className="toolbar-icon" />
          <span className="toolbar-title">Mode Édition Visuelle</span>
        </div>
        <div className="toolbar-section">
          <button 
            className={`toolbar-toggle ${showZones ? 'active' : ''}`}
            onClick={() => setShowZones(!showZones)}
            title="Afficher/Masquer les zones éditables"
          >
            {showZones ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{showZones ? 'Zones visibles' : 'Zones masquées'}</span>
          </button>
          <button 
            className={`toolbar-toggle ${debugMode ? 'active' : ''}`}
            onClick={() => setDebugMode(!debugMode)}
            title="Mode debug - Afficher toutes les zones avec labels"
            style={{ marginLeft: '8px' }}
          >
            <span>🐞 {debugMode ? 'Debug ON' : 'Debug OFF'}</span>
          </button>
        </div>
      </div>

      {/* PDF Container with overlay */}
      <div className="pdf-editor-container">
        <iframe 
          ref={iframeRef}
          src={`data:application/pdf;base64,${pdfBase64}`}
          className="pdf-editor-iframe"
        />
        
        {/* Editable zones overlay */}
        <div className="zones-overlay">
          {zones.map(zone => {
            const value = getValueByPath(cvData, zone.path);
            const isEditing = editingZone === zone.id;
            const isHovered = hoveredZone === zone.id;

            return (
              <div
                key={zone.id}
                className={`text-zone ${isEditing ? 'editing' : ''} ${isHovered ? 'hovered' : ''} ${!showZones && !isEditing && !debugMode ? 'hidden' : ''} ${debugMode ? 'debug' : ''}`}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  fontSize: `${zone.fontSize}px`,
                  fontWeight: zone.fontWeight,
                  color: zone.color,
                  textAlign: zone.align
                }}
                onMouseEnter={() => !isEditing && setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={(e) => !isEditing && handleZoneClick(zone.id, e)}
              >
                {debugMode && !isEditing && (
                  <div className="debug-label">
                    {zone.label}
                    <br />
                    <small>{zone.id}</small>
                  </div>
                )}
                {isEditing ? (
                  <div className="edit-container">
                    {zone.multiline ? (
                      <textarea
                        className="zone-editor zone-textarea"
                        value={value || ''}
                        onChange={(e) => handleChange(zone.id, e.target.value)}
                        autoFocus
                        style={{
                          fontSize: `${zone.fontSize}px`,
                          fontWeight: zone.fontWeight,
                          textAlign: zone.align
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        className="zone-editor zone-input"
                        value={value || ''}
                        onChange={(e) => handleChange(zone.id, e.target.value)}
                        autoFocus
                        style={{
                          fontSize: `${zone.fontSize}px`,
                          fontWeight: zone.fontWeight,
                          textAlign: zone.align
                        }}
                      />
                    )}
                    <div className="edit-actions">
                      <button className="edit-btn save-btn" onClick={handleSave} title="Sauvegarder">
                        <Save size={12} />
                      </button>
                      <button className="edit-btn cancel-btn" onClick={handleCancel} title="Annuler">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isHovered && (
                      <div className="zone-label">
                        <Edit2 size={10} />
                        <span>{zone.label}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .advanced-pdf-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface);
          border-radius: var(--r-lg);
          overflow: hidden;
        }

        .pdf-editor-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.8rem 1.2rem;
          background: linear-gradient(135deg, #d4a853 0%, #f0c97a 100%);
          border-bottom: 2px solid #c8a96e;
        }

        .toolbar-section {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .toolbar-icon {
          color: #000;
        }

        .toolbar-title {
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #000;
        }

        .toolbar-toggle {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.8rem;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(0, 0, 0, 0.2);
          border-radius: 6px;
          color: #000;
          font-size: 0.65rem;
          font-family: 'Space Mono', monospace;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toolbar-toggle:hover {
          background: rgba(0, 0, 0, 0.25);
        }

        .toolbar-toggle.active {
          background: rgba(0, 0, 0, 0.3);
          border-color: rgba(0, 0, 0, 0.4);
        }

        .pdf-editor-container {
          flex: 1;
          position: relative;
          background: #525252;
          overflow: auto;
        }

        .pdf-editor-iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }

        .zones-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .text-zone {
          position: absolute;
          pointer-events: all;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
          border-radius: 4px;
          padding: 2px 4px;
          line-height: 1.3;
        }

        .text-zone.hidden {
          opacity: 0;
          pointer-events: none;
        }

        .text-zone.debug {
          background: rgba(255, 0, 0, 0.15) !important;
          border: 2px solid red !important;
        }

        .debug-label {
          position: absolute;
          top: 2px;
          left: 2px;
          font-size: 8px;
          font-family: 'Courier New', monospace;
          color: red;
          background: rgba(255, 255, 255, 0.9);
          padding: 2px 4px;
          border-radius: 2px;
          pointer-events: none;
          z-index: 10000;
          line-height: 1.2;
        }

        .debug-label small {
          font-size: 7px;
          opacity: 0.7;
        }

        .text-zone.hovered {
          background: rgba(212, 168, 83, 0.2);
          border-color: rgba(212, 168, 83, 0.8);
          box-shadow: 0 0 12px rgba(212, 168, 83, 0.4),
                      inset 0 0 20px rgba(212, 168, 83, 0.1);
          transform: scale(1.02);
        }

        .text-zone.editing {
          background: rgba(255, 255, 255, 0.98);
          border-color: #d4a853;
          box-shadow: 0 4px 24px rgba(212, 168, 83, 0.6),
                      0 0 0 4px rgba(212, 168, 83, 0.2);
          z-index: 1000;
          transform: scale(1.03);
        }

        .zone-label {
          position: absolute;
          top: -28px;
          left: -2px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: linear-gradient(135deg, #d4a853, #f0c97a);
          color: #000;
          border-radius: 6px;
          font-size: 0.6rem;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
          z-index: 2000;
          animation: fadeInDown 0.2s ease;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .edit-container {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .zone-editor {
          width: 100%;
          height: 100%;
          background: white;
          border: none;
          outline: none;
          padding: 4px 6px;
          font-family: 'Poppins', sans-serif;
          color: #1A1C22;
          resize: none;
          line-height: 1.3;
        }

        .zone-textarea {
          overflow-y: auto;
        }

        .zone-editor:focus {
          background: rgba(255, 255, 255, 1);
        }

        .edit-actions {
          position: absolute;
          top: -36px;
          right: -2px;
          display: flex;
          gap: 4px;
          animation: fadeInDown 0.2s ease;
        }

        .edit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .save-btn {
          background: #52c97a;
          color: white;
        }

        .save-btn:hover {
          background: #45b068;
          transform: scale(1.05);
        }

        .cancel-btn {
          background: #e05252;
          color: white;
        }

        .cancel-btn:hover {
          background: #c94444;
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}
