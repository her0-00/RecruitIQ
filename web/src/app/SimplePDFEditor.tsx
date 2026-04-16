'use client';

import { useState } from 'react';
import { X, Edit2 } from 'lucide-react';

interface SimplePDFEditorProps {
  cvData: any;
  onUpdate: (newData: any) => void;
  pdfUrl: string;
}

export default function SimplePDFEditor({ cvData, onUpdate, pdfUrl }: SimplePDFEditorProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedField, setSelectedField] = useState('');
  const [editValue, setEditValue] = useState('');
  const [mouseStartPos, setMouseStartPos] = useState({ x: 0, y: 0 });

  // Liste de TOUS les champs éditables
  const allFields = [
    { path: 'name', label: '👤 Nom Complet' },
    { path: 'title', label: '💼 Titre Professionnel' },
    { path: 'email', label: '📧 Email' },
    { path: 'phone', label: '📱 Téléphone' },
    { path: 'location', label: '📍 Localisation' },
    { path: 'linkedin', label: '🔗 LinkedIn' },
    { path: 'github', label: '💻 GitHub' },
    { path: 'portfolio', label: '🌐 Portfolio' },
    { path: 'summary', label: '📝 Résumé Professionnel', multiline: true },

    // Experiences
    ...cvData.experiences?.flatMap((exp: any, idx: number) => [
      { path: `experiences.${idx}.role`, label: `💼 Exp ${idx + 1} - Poste` },
      { path: `experiences.${idx}.company`, label: `🏢 Exp ${idx + 1} - Entreprise` },
      { path: `experiences.${idx}.period`, label: `📅 Exp ${idx + 1} - Période` },
      { path: `experiences.${idx}.location`, label: `📍 Exp ${idx + 1} - Lieu` },
      ...exp.bullets?.map((b: any, bIdx: number) => ({
        path: `experiences.${idx}.bullets.${bIdx}`,
        label: `✓ Exp ${idx + 1} - Réalisation ${bIdx + 1}`,
        multiline: true
      })) || []
    ]) || [],

    // Education
    ...cvData.education?.flatMap((edu: any, idx: number) => [
      { path: `education.${idx}.degree`, label: `🎓 Formation ${idx + 1} - Diplôme` },
      { path: `education.${idx}.school`, label: `🏫 Formation ${idx + 1} - École` },
      { path: `education.${idx}.year`, label: `📅 Formation ${idx + 1} - Année` },
      { path: `education.${idx}.detail`, label: `📄 Formation ${idx + 1} - Détails`, multiline: true }
    ]) || [],

    // Skills
    ...cvData.skills?.categories?.flatMap((cat: any, catIdx: number) => [
      { path: `skills.categories.${catIdx}.name`, label: `🔧 Compétence Cat ${catIdx + 1} - Nom` },
      ...cat.items?.map((item: string, itemIdx: number) => ({
        path: `skills.categories.${catIdx}.items.${itemIdx}`,
        label: `• Compétence ${catIdx + 1}.${itemIdx + 1}`
      })) || []
    ]) || [],

    // Languages
    ...cvData.languages?.flatMap((lang: any, idx: number) => [
      { path: `languages.${idx}.lang`, label: `🌍 Langue ${idx + 1} - Nom` },
      { path: `languages.${idx}.level`, label: `📊 Langue ${idx + 1} - Niveau` }
    ]) || [],

    // Certifications
    ...cvData.certifications?.map((cert: string, idx: number) => ({
      path: `certifications.${idx}`,
      label: `🏆 Certification ${idx + 1}`,
      multiline: true
    })) || []
  ];

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

  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Calculer la distance du mouvement
    const dist = Math.sqrt(
      Math.pow(e.clientX - mouseStartPos.x, 2) + 
      Math.pow(e.clientY - mouseStartPos.y, 2)
    );
    
    // Si le mouvement est important (> 5px), c'est probablement un scroll ou un drag
    if (dist > 5) return;

    handlePDFClick(e);
  };

  const handlePDFClick = (e: React.MouseEvent) => {
    // SOLUTION DÉFINITIVE : Si la cible du clic est le conteneur lui-même (et non son contenu),
    // c'est qu'on a cliqué sur la barre de défilement (scrollbar) ou sa bordure.
    if (e.target === e.currentTarget) return;

    e.preventDefault();
    e.stopPropagation();

    // Position relative à la surface de clic
    const rect = e.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setShowPopup(true);
    setSelectedField('');
    setEditValue('');
  };

  const handleFieldSelect = (fieldPath: string) => {
    setSelectedField(fieldPath);
    const currentValue = getValueByPath(cvData, fieldPath);
    setEditValue(currentValue || '');
  };

  const handleSave = () => {
    if (!selectedField) return;

    try {
      const newData = setValueByPath(cvData, selectedField, editValue);
      // Clean circular references before passing to parent
      const cleanData = JSON.parse(JSON.stringify(newData));
      onUpdate(cleanData);
      setShowPopup(false);
      setSelectedField('');
      setEditValue('');
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    }
  };

  const handleClose = () => {
    setShowPopup(false);
    setSelectedField('');
    setEditValue('');
  };

  const currentField = allFields.find(f => f.path === selectedField);

  return (
    <div className="simple-pdf-editor">
      {/* PDF Container (Scrollable) */}
      <div 
        className="pdf-container"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Click Surface (Catch clicks to distinguish from scrollbar) */}
        <div className="pdf-click-surface">
          <iframe
            key={pdfUrl}
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="pdf-iframe"
          />
        </div>

        {/* Popup d'édition */}
        {showPopup && (
          <div
            className="edit-popup"
            style={{
              left: Math.min(popupPosition.x, typeof window !== 'undefined' ? window.innerWidth - 420 : popupPosition.x),
              top: Math.min(popupPosition.y, typeof window !== 'undefined' ? window.innerHeight - 500 : popupPosition.y)
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <div className="popup-header">
              <h3>✏️ Éditer un champ</h3>
              <button className="close-btn" onClick={handleClose}>
                <X size={16} />
              </button>
            </div>

            {!selectedField ? (
              <div className="field-list">
                <div className="field-list-header">Sélectionnez le champ à éditer :</div>
                <div className="field-scroll">
                  {allFields.map(field => (
                    <button
                      key={field.path}
                      className="field-item"
                      onClick={() => handleFieldSelect(field.path)}
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="edit-form">
                <div className="form-label">{currentField?.label}</div>
                {currentField?.multiline ? (
                  <textarea
                    className="form-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    rows={6}
                  />
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                )}
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setSelectedField('')}>
                    ← Retour
                  </button>
                  <button className="btn-save" onClick={handleSave}>
                    ✓ Sauvegarder
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="simple-toolbar">
        <div className="toolbar-content">
          <Edit2 size={16} />
          <span>Cliquez n'importe où sur le PDF pour éditer un champ</span>
        </div>
      </div>

      <style jsx>{`
        .simple-pdf-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface);
          border-radius: var(--r-lg);
          overflow: hidden;
        }

        .simple-toolbar {
          padding: 0.8rem 1.5rem;
          background: linear-gradient(135deg, #d4a853 0%, #f0c97a 100%);
          border-top: 2px solid #c8a96e;
        }

        .toolbar-content {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          color: #000;
          font-family: 'Space Mono', monospace;
          font-size: 0.75rem;
          font-weight: 600;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .pdf-container {
          flex: 1;
          position: relative;
          background: #525252;
          overflow-y: auto;
          overflow-x: hidden;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center; /* Centre le CV horizontalement */
          padding: 2rem 0;
        }

        .pdf-click-surface {
          width: 100%;
          max-width: 850px; /* Taille optimale pour un CV A4 sans scroll horizontal */
          height: fit-content;
          display: flex;
          flex-direction: column;
          position: relative;
          pointer-events: auto;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          margin: 0 auto;
        }

        .pdf-iframe {
          width: 100%;
          min-height: 1200px; /* Force a tall content area to scroll scroll correctly */
          border: none;
          display: block;
          pointer-events: none;
          flex: 1;
        }

        .edit-popup {
          position: absolute;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          min-width: 400px;
          max-width: 500px;
          max-height: 600px;
          display: flex;
          flex-direction: column;
          z-index: 10000;
          animation: popIn 0.2s ease;
        }

        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.2rem;
          border-bottom: 2px solid #f0f0f0;
          background: linear-gradient(135deg, #d4a853 0%, #f0c97a 100%);
          border-radius: 12px 12px 0 0;
        }

        .popup-header h3 {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 700;
          color: #000;
          font-family: 'Space Mono', monospace;
        }

        .close-btn {
          background: rgba(0, 0, 0, 0.2);
          border: none;
          border-radius: 6px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          color: #000;
        }

        .close-btn:hover {
          background: rgba(0, 0, 0, 0.3);
          transform: scale(1.1);
        }

        .field-list {
          padding: 1rem;
        }

        .field-list-header {
          font-size: 0.75rem;
          font-weight: 600;
          color: #666;
          margin-bottom: 0.8rem;
          font-family: 'Space Mono', monospace;
        }

        .field-scroll {
          max-height: 450px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .field-item {
          padding: 0.7rem 1rem;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.8rem;
          font-family: 'Poppins', sans-serif;
          color: #333;
        }

        .field-item:hover {
          background: #d4a853;
          border-color: #c8a96e;
          color: #000;
          transform: translateX(4px);
        }

        .edit-form {
          padding: 1.2rem;
        }

        .form-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #333;
          margin-bottom: 0.8rem;
          font-family: 'Space Mono', monospace;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 0.8rem;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 0.85rem;
          font-family: 'Poppins', sans-serif;
          color: #333;
          transition: all 0.2s;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #d4a853;
          box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.2);
        }

        .form-textarea {
          resize: vertical;
          min-height: 120px;
        }

        .form-actions {
          display: flex;
          gap: 0.8rem;
          margin-top: 1rem;
        }

        .btn-cancel,
        .btn-save {
          flex: 1;
          padding: 0.7rem;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          font-family: 'Space Mono', monospace;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel {
          background: #f0f0f0;
          color: #666;
        }

        .btn-cancel:hover {
          background: #e0e0e0;
        }

        .btn-save {
          background: linear-gradient(135deg, #52c97a, #45b068);
          color: white;
        }

        .btn-save:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(82, 201, 122, 0.4);
        }

        /* ========================================
           RESPONSIVE - TABLET
           ======================================== */
        @media (max-width: 768px) {
          .simple-toolbar {
            padding: 0.8rem 1rem;
          }

          .toolbar-content {
            font-size: 0.7rem;
            gap: 0.6rem;
          }

          .edit-popup {
            min-width: 90vw;
            max-width: 90vw;
            max-height: 80vh;
            left: 5vw !important;
            top: 10vh !important;
          }

          .popup-header h3 {
            font-size: 0.8rem;
          }

          .field-scroll {
            max-height: 50vh;
          }

          .field-item {
            padding: 0.8rem;
            font-size: 0.85rem;
          }

          .form-input,
          .form-textarea {
            font-size: 16px; /* Prevent zoom on iOS */
          }
        }

        /* ========================================
           RESPONSIVE - MOBILE
           ======================================== */
        @media (max-width: 480px) {
          .simple-toolbar {
            padding: 0.6rem 0.8rem;
          }

          .toolbar-content {
            font-size: 0.65rem;
            gap: 0.5rem;
          }

          .toolbar-content svg {
            width: 14px;
            height: 14px;
          }

          .edit-popup {
            min-width: 95vw;
            max-width: 95vw;
            max-height: 85vh;
            left: 2.5vw !important;
            top: 7.5vh !important;
            border-radius: 8px;
          }

          .popup-header {
            padding: 0.8rem 1rem;
          }

          .popup-header h3 {
            font-size: 0.75rem;
          }

          .close-btn {
            width: 32px;
            height: 32px;
          }

          .field-list {
            padding: 0.8rem;
          }

          .field-list-header {
            font-size: 0.7rem;
          }

          .field-scroll {
            max-height: 55vh;
          }

          .field-item {
            padding: 0.9rem 0.8rem;
            font-size: 0.9rem;
            border-radius: 6px;
          }

          .field-item:active {
            background: #d4a853;
            transform: scale(0.98);
          }

          .edit-form {
            padding: 1rem;
          }

          .form-label {
            font-size: 0.75rem;
          }

          .form-input,
          .form-textarea {
            padding: 0.9rem;
            font-size: 16px; /* Prevent zoom on iOS */
            border-radius: 6px;
          }

          .form-textarea {
            min-height: 150px;
          }

          .form-actions {
            gap: 0.6rem;
            flex-direction: column;
          }

          .btn-cancel,
          .btn-save {
            padding: 0.9rem;
            font-size: 0.85rem;
          }

          .btn-save:active {
            transform: scale(0.98);
          }
        }

        /* ========================================
           RESPONSIVE - SMALL MOBILE
           ======================================== */
        @media (max-width: 360px) {
          .toolbar-content {
            font-size: 0.6rem;
          }

          .popup-header h3 {
            font-size: 0.7rem;
          }

          .field-item {
            font-size: 0.85rem;
          }

          .form-input,
          .form-textarea {
            font-size: 16px;
          }
        }

        /* ========================================
           TOUCH IMPROVEMENTS
           ======================================== */
        @media (hover: none) and (pointer: coarse) {
          .field-item:hover {
            transform: none;
          }

          .btn-cancel:hover,
          .btn-save:hover {
            transform: none;
          }

          .close-btn:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
