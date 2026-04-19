"""
4 nouveaux thèmes photo ORIGINAUX pour RIIS
Chaque thème a un layout unique et différent

IMPORTANT: Ces thèmes ont été intégrés directement dans backend/pdf_cv.py.
Ce fichier n'est conservé que pour référence historique des templates originaux.
Les corrections et personnalisations doivent être faites dans backend/pdf_cv.py.
"""

# THÈME 1: Corporate Elite - Layout asymétrique avec photo intégrée dans header coloré
CORPORATE_ELITE = """
class _CorporateElite:
    BG = HexColor("#FFFFFF")
    ACCENT = HexColor("#1E3A5F")
    ACCENT2 = HexColor("#8B7355")
    TEXT_DARK = HexColor("#1A1A1A")
    TEXT_MED = HexColor("#555555")
    TEXT_LIGHT = HexColor("#999999")
    DIVIDER = HexColor("#DDDDDD")
    PHOTO_BORDER = HexColor("#8B7355")
    
    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 50, W - 100
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        
        # Header avec fond gris clair
        HEADER_H = 110 * _fscale
        _draw_rect(c, 0, H - HEADER_H, W, HEADER_H, fill=HexColor("#F8F9FA"))
        
        # Photo ronde DANS le header (gauche)
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 75 * _fscale
        if photo:
            _draw_photo(c, photo, MX, H - HEADER_H + 18 * _fscale, PHOTO_SIZE, 'circle',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT2), border_width=3 * _fscale)
        
        # Name & Title à droite de la photo
        name_x = MX + PHOTO_SIZE + 20 * _fscale
        c.setFont(_f("Poppins-Bold"), 20)
        c.setFillColor(cls.TEXT_DARK)
        c.drawString(name_x, H - 40 * _fscale, cv_data.get("name", ""))
        
        c.setFont(_f("Poppins-Light"), 10)
        c.setFillColor(cls.ACCENT)
        c.drawString(name_x, H - 58 * _fscale, cv_data.get("title", ""))
        
        _draw_wrapped_contact(c, cv_data, name_x, H - 80 * _fscale, W - name_x - 50, "Poppins", 7, cls.TEXT_LIGHT, " | ")
        
        my = H - HEADER_H - 25 * _fscale
        
        def section_title(t, y):
            c.setFont(_f("Poppins-Bold"), 9)
            c.setFillColor(cls.ACCENT)
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(cls.ACCENT2)
            c.setLineWidth(2)
            c.line(MX, y - 4 * _fscale, MX + 60 * _fscale, y - 4 * _fscale)
            return y - 18 * _fscale
        
        if cv_data.get("summary"):
            my = section_title("À Propos", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, cls.TEXT_MED, MW, 13) - 18 * _fscale
        
        if cv_data.get("experiences"):
            my = section_title("Expérience", my)
            for exp in cv_data["experiences"]:
                if my < 120: break
                c.setFont(_f("Poppins-Bold"), 10)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins"), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium"), 8.5)
                c.setFillColor(cls.ACCENT)
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: break
                    c.setFillColor(cls.ACCENT2)
                    c.circle(MX + 3, my + 3 * _fscale, 2 * _fscale, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 12, my, "Poppins", 8, cls.TEXT_MED, MW - 14, 11) - 2 * _fscale
                my -= 10 * _fscale
        
        c.save()
        return buf.getvalue()
"""

# THÈME 2: Minimalist Pro - Photo centrée en haut, design épuré
MINIMALIST_PRO = """
class _MinimalistPro:
    BG = HexColor("#FFFFFF")
    ACCENT = HexColor("#2C3E50")
    ACCENT2 = HexColor("#95A5A6")
    TEXT_DARK = HexColor("#2C3E50")
    TEXT_MED = HexColor("#7F8C8D")
    TEXT_LIGHT = HexColor("#BDC3C7")
    DIVIDER = HexColor("#ECF0F1")
    PHOTO_BORDER = HexColor("#2C3E50")
    
    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 60, W - 120
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        
        # Photo centrée en haut
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 70 * _fscale
        if photo:
            _draw_photo(c, photo, (W - PHOTO_SIZE) / 2, H - 65 * _fscale, PHOTO_SIZE, 'circle',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT), border_width=2 * _fscale)
        
        my = H - 80 * _fscale
        c.setFont(_f("Poppins-Bold"), 26)
        c.setFillColor(cls.TEXT_DARK)
        c.drawCentredString(W / 2, my, cv_data.get("name", ""))
        my -= 20 * _fscale
        
        c.setFont(_f("Poppins-Light"), 11)
        c.setFillColor(cls.ACCENT)
        c.drawCentredString(W / 2, my, cv_data.get("title", ""))
        my -= 18 * _fscale
        
        my = _draw_wrapped_centred_contact(c, cv_data, W/2, my, MW, "Poppins", 7.5, cls.TEXT_LIGHT, "  •  ")
        my -= 22 * _fscale
        
        c.setStrokeColor(cls.DIVIDER)
        c.setLineWidth(1)
        c.line(MX, my, W - MX, my)
        my -= 22 * _fscale
        
        def section_title(t, y):
            c.setFont(_f("Poppins-Bold"), 8)
            c.setFillColor(cls.ACCENT)
            c.drawCentredString(W / 2, y, t.upper())
            c.setStrokeColor(cls.ACCENT2)
            c.setLineWidth(0.5)
            c.line(MX, y - 4 * _fscale, W - MX, y - 4 * _fscale)
            return y - 16 * _fscale
        
        if cv_data.get("summary"):
            my = section_title("Profil", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, cls.TEXT_MED, MW, 13) - 18 * _fscale
        
        if cv_data.get("experiences"):
            my = section_title("Expérience Professionnelle", my)
            for exp in cv_data["experiences"]:
                if my < 120: break
                c.setFont(_f("Poppins-Bold"), 10)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins"), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium"), 8.5)
                c.setFillColor(cls.ACCENT)
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: break
                    my = _draw_multiline(c, "— " + bullet, MX, my, "Poppins", 8, cls.TEXT_MED, MW, 11) - 2 * _fscale
                my -= 10 * _fscale
        
        c.save()
        return buf.getvalue()
"""

print("Nouveaux thèmes créés:")
print("1. Corporate Elite - Layout asymétrique avec photo dans header")
print("2. Minimalist Pro - Photo centrée, design épuré")
print("3. Consultant Premium - Layout 3 colonnes (déjà créé)")
print("4. International Profile - À créer avec sidebar et barres")
