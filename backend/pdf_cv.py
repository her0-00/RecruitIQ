"""
RecruitIQ — Moteur de génération PDF
5 thèmes CV : Classic-Dark, Canva-Minimal, Executive-Dark, Nordic-Clean, Tech-Grid, Luxury-Serif
"""

import io
import os
import re
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

from backend.logger import get_logger

log = get_logger("pdf_cv")

# ── FONT REGISTRATION ──────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(_HERE, "..", "fonts", "")

_FALLBACKS = {
    "Poppins":        "Helvetica",
    "Poppins-Bold":   "Helvetica-Bold",
    "Poppins-Light":  "Helvetica",
    "Poppins-Medium": "Helvetica",
    "Poppins-Italic": "Helvetica-Oblique",
    "Lora":           "Times-Roman",
    "Lora-Italic":    "Times-Italic",
}
_FONT_MAP = {}


def register_fonts():
    fonts = {
        "Poppins":        "Poppins-Regular.ttf",
        "Poppins-Bold":   "Poppins-Bold.ttf",
        "Poppins-Light":  "Poppins-Light.ttf",
        "Poppins-Medium": "Poppins-Medium.ttf",
        "Poppins-Italic": "Poppins-Italic.ttf",
        "Lora":           "Lora-Regular.ttf",
        "Lora-Italic":    "Lora-Italic.ttf",
    }
    for name, filename in fonts.items():
        path = os.path.join(FONT_DIR, filename)
        try:
            pdfmetrics.registerFont(TTFont(name, path, asciiReadable=1))
            _FONT_MAP[name] = name
        except Exception as e:
            _FONT_MAP[name] = _FALLBACKS[name]
            log.warning(f"Font {name} fallback → {_FALLBACKS[name]}")


register_fonts()


def _f(name: str, force_family: str = None) -> str:
    """Get registered font name with fallback and family overrides."""
    if not force_family:
        return _FONT_MAP.get(name, _FALLBACKS.get(name, "Helvetica"))

    # If force_family is set, we MUST map the requested style (bold, italic, etc.) 
    # to the corresponding variant of the forced family.
    is_bold = "Bold" in name or "Medium" in name # Treat medium as bold for families that lack it
    is_italic = "Italic" in name
    is_light = "Light" in name
    
    if force_family == "Roboto" or force_family == "Inter":
        # Map to standard sans-serif PDF fonts
        if is_bold: return "Helvetica-Bold"
        if is_italic: return "Helvetica-Oblique"
        return "Helvetica"
    elif force_family == "Times-Roman":
        # Map to standard serif PDF font
        if is_bold: return "Times-Bold"
        if is_italic: return "Times-Italic"
        return "Times-Roman"
    elif force_family == "Lora":
        # Lora is a serif font we have registered
        if is_italic: return "Lora-Italic"
        return "Lora" # We use regular for bold/light if not available
    elif force_family == "Poppins":
        # Poppins is a sans-serif font we have registered
        if is_bold: return "Poppins-Bold"
        if is_italic: return "Poppins-Italic"
        if is_light: return "Poppins-Light"
        return "Poppins"
    
    return _FONT_MAP.get(name, _FALLBACKS.get(name, "Helvetica"))


def _get_labels(lang="fr") -> dict:
    """Get localized section labels."""
    labels = {
        "fr": {
            "experience": "EXPÉRIENCE PROFESSIONNELLE",
            "education": "FORMATION",
            "skills": "COMPÉTENCES",
            "summary": "PROFIL",
            "languages": "LANGUES",
            "projects": "PROJETS",
            "certifications": "CERTIFICATIONS",
            "contact": "CONTACT",
            "expertise": "EXPERTISE"
        },
        "en": {
            "experience": "PROFESSIONAL EXPERIENCE",
            "education": "EDUCATION",
            "skills": "SKILLS & EXPERTISE",
            "summary": "SUMMARY",
            "languages": "LANGUAGES",
            "projects": "PROJECTS",
            "certifications": "CERTIFICATIONS",
            "contact": "CONTACT INFO",
            "expertise": "EXPERTISE"
        }
    }
    return labels.get(lang.lower(), labels["fr"])


def _sanitize_text(text: str) -> str:
    """Replace problematic Unicode characters."""
    if not text:
        return text
    replacements = {
        '\u0153': 'oe',
        '\u0152': 'OE',
        '\u00e6': 'ae',
        '\u00c6': 'AE',
        '\u20ac': 'EUR',
        '\u2014': '-',
        '\u2013': '-',
        '\u2018': "'",
        '\u2019': "'",
        '\u201c': '"',
        '\u201d': '"',
        '\u2026': '...',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


# ── HYPERLINK PARSING ──────────────────────────────────────────────
_LINK_RE = re.compile(r'^(.+?)\[(https?://[^\]]+)\]$')


def _parse_link(text: str):
    """Parse 'Label[https://url]' → (label, url) or (text, None)."""
    if not text:
        return (text, None)
    m = _LINK_RE.match(text.strip())
    if m:
        return (m.group(1).strip(), m.group(2).strip())
    return (text, None)


def _draw_link(c, x, y, label, url, font, size, color, underline=True, force_family=None):
    """Draw clickable hyperlink text. Returns width of the drawn text."""
    fn = _f(font, force_family=force_family)
    c.setFont(fn, size)
    c.setFillColor(color)
    c.drawString(x, y, label)
    w = c.stringWidth(label, fn, size)
    if underline:
        c.setStrokeColor(color)
        c.setLineWidth(0.4)
        c.line(x, y - 1.5, x + w, y - 1.5)
    # Create clickable annotation rect (x1, y1, x2, y2)
    c.linkURL(url, (x, y - 2, x + w, y + size), relative=0)
    return w


def _apply_custom_style(cls, cv_data):
    """Apply granular custom_style overrides from cv_data onto a theme class copy."""
    import types
    style = cv_data.get("custom_style", {})
    
    # Filter out None and empty string values
    style = {k: v for k, v in style.items() if v}
    
    if not style:
        return cls, 1.0

    log.info(f"[CUSTOM_STYLE] Applying: {style}")

    ns = types.SimpleNamespace()
    for attr in dir(cls):
        if attr.startswith('_'): continue
        setattr(ns, attr, getattr(cls, attr))

    # 1b. Font Global Override
    if style.get("font_family"):
        setattr(ns, "FONT_OVERRIDE", style["font_family"])
    else:
        setattr(ns, "FONT_OVERRIDE", None)
        
    setattr(ns, "LANG", cv_data.get("lang", "fr"))
    if style.get("main_bg"):
        try:
            col = HexColor(style["main_bg"])
            for a in ['BODY_BG', 'BG']:
                if hasattr(ns, a): setattr(ns, a, col)
        except: pass
    
    if style.get("sidebar_bg"):
        try:
            col = HexColor(style["sidebar_bg"])
            for a in ['SIDEBAR_BG', 'SIDEBAR_BG2', 'SURFACE', 'SURFACE2']:
                if hasattr(ns, a): setattr(ns, a, col)
        except: pass
    
    if style.get("header_bg"):
        try:
            col = HexColor(style["header_bg"])
            if hasattr(ns, 'HEADER_BG'): setattr(ns, 'HEADER_BG', col)
        except: pass

    # 2. Colors - General Accent (Lines, Dots, etc.)
    if style.get("accent_color"):
        try:
            acc = HexColor(style["accent_color"])
            # Aggressively override common accent keys
            # TAG_BG is EXCLUDED here to prevent text/bg color collision in Medical/Canva themes
            for a in ['ACCENT', 'ACCENT_LIGHT', 'ACCENT_DARK', 'ACCENT2', 'ACCENT3', 
                      'TAG_BORDER', 'BORDER', 'DIVIDER']:
                if hasattr(ns, a): setattr(ns, a, acc)
        except: pass

    # 3. Colors - General Typography
    if style.get("text_color"):
        try:
            col = HexColor(style["text_color"])
            for a in ['TEXT', 'TEXT_DARK', 'TEXT_MED', 'TEXT_LIGHT', 'SIDEBAR_TEXT', 'SIDEBAR_MUTED', 'BODY_TEXT']:
                if hasattr(ns, a): setattr(ns, a, col)
            setattr(ns, 'CONTACT_COLOR', col)
        except: pass

    # 4. Specific Typography (Applied last to override general settings)
    if style.get("subheading_color"):
        # This is "Post / Roles" in the frontend
        try:
            col = HexColor(style["subheading_color"])
            setattr(ns, 'TITLE_COLOR', col)
            setattr(ns, 'ROLE_COLOR', col)
            setattr(ns, 'ACCENT_DARK', col)
            if hasattr(ns, 'ACCENT_LIGHT'): setattr(ns, 'ACCENT_LIGHT', col)
            if hasattr(ns, 'SUBHEADING_COLOR'): setattr(ns, 'SUBHEADING_COLOR', col)
            if hasattr(ns, 'ACCENT3'): setattr(ns, 'ACCENT3', col)
        except: pass
    
    if style.get("heading_color"):
        # This is "Section Titles" in the frontend
        try:
            col = HexColor(style["heading_color"])
            setattr(ns, 'SECTION_TITLE_COLOR', col)
            if hasattr(ns, 'HEADING_COLOR'): setattr(ns, 'HEADING_COLOR', col)
            if hasattr(ns, 'ACCENT2'): setattr(ns, 'ACCENT2', col)
        except: pass
    
    if style.get("name_color"):
        try:
            col = HexColor(style["name_color"])
            setattr(ns, 'NAME_COLOR', col)
            # We don't override generic WHITE here to avoid background corruption
            if hasattr(ns, 'NAME_TEXT_COLOR'): setattr(ns, 'NAME_TEXT_COLOR', col)
        except: pass
    
    # 5. Photo Border Color
    if style.get("photo_border_color"):
        try:
            col = HexColor(style["photo_border_color"])
            setattr(ns, 'PHOTO_BORDER', col)
        except: pass
    
    font_scale = 1.0
    if style.get("font_scale"):
        try:
            font_scale = max(0.5, min(2.0, float(style["font_scale"])))
        except: pass
    
    log.info(f"[CUSTOM_STYLE] Applied successfully, font_scale={font_scale}")
    return ns, font_scale


# ── SHARED HELPERS ─────────────────────────────────────────────────
def _draw_rect(c, x, y, w, h, fill=None, stroke=None, radius=0, stroke_width=0.5):
    if fill:   c.setFillColor(fill)
    if stroke: c.setStrokeColor(stroke)
    c.setLineWidth(stroke_width)
    if radius > 0:
        c.roundRect(x, y, w, h, radius, fill=1 if fill else 0, stroke=1 if stroke else 0)
    else:
        c.rect(x, y, w, h, fill=1 if fill else 0, stroke=1 if stroke else 0)


def _draw_multiline(c, text, x, y, font, size, color, max_width, line_height, dry_run=False, force_family=None):
    """Draw text with word-wrap. returns the new y position."""
    text = _sanitize_text(text)
    fscale = getattr(c, "_fscale", 1.0)
    line_height = line_height * fscale
    font = _f(font, force_family=force_family)
    c.setFont(font, size)
    c.setFillColor(color)
    if not text or not text.strip():
        return y - line_height
    words = text.split()
    lines, current = [], []
    for word in words:
        test = " ".join(current + [word])
        if c.stringWidth(test, font, size) <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    if not lines:
        return y - line_height
    if dry_run:
        return y - (len(lines) * line_height)
    for line in lines:
        c.drawString(x, y, line)
        y -= line_height
    return y


def _multiline_height(c, text, font, size, max_width, line_height, force_family=None):
    """Calculate the pixel height that _draw_multiline would consume without drawing."""
    font = _f(font, force_family=force_family)
    c.setFont(font, size)
    if not text or not text.strip():
        return line_height
    words = text.split()
    lines, current = [], []
    for word in words:
        test = " ".join(current + [word])
        if c.stringWidth(test, font, size) <= max_width:
            current.append(word)
        else:
            if current: lines.append(" ".join(current))
            current = [word]
    if current: lines.append(" ".join(current))
    fscale = getattr(c, "_fscale", 1.0)
    return len(lines) * line_height * fscale


def _spaced_string(c, x, y, text, font, size, color, spacing=0.8, force_family=None):
    """Draw text with letter-spacing as a single string (ATS-safe)."""
    text = _sanitize_text(text)
    c.setFont(_f(font, force_family=force_family), size)
    c.setFillColor(color)
    c._charSpace = spacing
    c.drawString(x, y, text)
    c._charSpace = 0


def _spaced_centred(c, cx, y, text, font, size, color, spacing=0.8, force_family=None):
    text = _sanitize_text(text)
    c.setFont(_f(font, force_family=force_family), size)
    c.setFillColor(color)
    c._charSpace = spacing
    c.drawCentredString(cx, y, text)
    c._charSpace = 0


def _draw_wrapped_header(c, text, x, y, font, size, color, max_width, line_height, centered=False, dry_run=False, force_family=None):
    """Specifically for Name/Title wrapping in headers."""
    text = _sanitize_text(text)
    fscale = getattr(c, "_fscale", 1.0)
    line_height = line_height * fscale
    font = _f(font, force_family=force_family)
    c.setFont(font, size)
    c.setFillColor(color)
    if not text: return y
    
    words = text.split()
    lines, current = [], []
    for word in words:
        test = " ".join(current + [word])
        if c.stringWidth(test, font, size) <= max_width:
            current.append(word)
        else:
            if current: lines.append(" ".join(current))
            current = [word]
    if current: lines.append(" ".join(current))
    
    if dry_run:
        return y - (len(lines) * line_height)

    for line in lines:
        if centered:
            c.drawCentredString(x + max_width/2, y, line)
        else:
            c.drawString(x, y, line)
        y -= line_height
    return y


def _prepare_canvas(c, fscale):
    """
    Monkey-patch the canvas to scale all font sizes consistently.
    Ensures that c.stringWidth correctly accounts for fscale in measurements.
    """
    c._fscale = fscale
    if fscale == 1.0: return
    
    # 1. Scale drawing font size
    c._old_setFont = c.setFont
    c.setFont = lambda psname, size: c._old_setFont(psname, size * fscale)
    
    # 2. Scale measurement font size
    c._old_stringWidth = c.stringWidth
    def scaled_stringWidth(text, fontName=None, fontSize=None):
        if fontSize is not None:
            return c._old_stringWidth(text, fontName, fontSize * fscale)
        # If fontSize is None, ReportLab uses the current state (already scaled)
        return c._old_stringWidth(text, fontName, fontSize)
    c.stringWidth = scaled_stringWidth


def _draw_wrapped_contact(c, cv_data, x, y, max_w, font_name="Poppins", font_size=8, color=None, sep="  ·  ", dry_run=False, force_family=None):
    """
    Draws contact items (email, phone, etc.) wrapping them to new lines if they exceed max_w.
    Returns the new 'y' position.
    """
    from reportlab.lib.colors import HexColor
    color = color or HexColor("#666666")
    items = []
    for key in ["email", "phone", "location", "linkedin", "github", "portfolio"]:
        if cv_data.get(key):
            items.append((key, cv_data[key]))
    
    if not items:
        return y

    curr_x = x
    curr_y = y
    fscale = getattr(c, "_fscale", 1.0)
    c.setFont(_f(font_name, force_family=force_family), font_size)
    c.setFillColor(color)
    
    sep_w = c.stringWidth(sep, _f(font_name, force_family=force_family), font_size)
    
    for i, (key, val) in enumerate(items):
        label, url = _parse_link(val)
        item_w = c.stringWidth(label, _f(font_name, force_family=force_family), font_size)
        
        # Check if we need to wrap
        if i > 0 and curr_x + sep_w + item_w > x + max_w:
            curr_x = x
            curr_y -= (font_size * fscale + 4)
        
        if i > 0 and curr_x > x:
            c.setFont(_f(font_name, force_family=force_family), font_size)
            c.setFillColor(color)
            c.drawString(curr_x, curr_y, sep)
            curr_x += sep_w

        if not dry_run:
            if url:
                curr_x += _draw_link(c, curr_x, curr_y, label, url, font_name, font_size, color, force_family=force_family)
            else:
                c.setFont(_f(font_name, force_family=force_family), font_size)
                c.setFillColor(color)
                c.drawString(curr_x, curr_y, label)
                curr_x += item_w
        else:
            curr_x += (item_w + 2) # small buffer
            
    return curr_y - 14 * fscale


def _draw_vertical_contact(c, cv_data, x, y, font_name="Poppins", font_size=7, color=None, spacing=11, force_family=None):
    """Draw contact info as a vertical list (ideal for sidebars)."""
    from reportlab.lib.colors import HexColor
    color = color or HexColor("#666666")
    fscale = getattr(c, "_fscale", 1.0)
    spacing = spacing * fscale
    
    items = []
    for key in ["email", "phone", "location", "linkedin", "github", "portfolio"]:
        if cv_data.get(key):
            items.append(cv_data[key])
    
    curr_y = y
    for val in items:
        label, url = _parse_link(val)
        if url:
            _draw_link(c, x, curr_y, label, url, font_name, font_size, color, force_family=force_family)
        else:
            c.setFont(_f(font_name, force_family=force_family), font_size)
            c.setFillColor(color)
            c.drawString(x, curr_y, label)
        curr_y -= spacing
    
    return curr_y


def _draw_wrapped_centred_contact(c, cv_data, cx, y, max_w, font_name="Poppins", font_size=8, color=None, sep="  ·  ", dry_run=False, force_family=None):
    """Centred version of the wrapped contact line."""
    from reportlab.lib.colors import HexColor
    color = color or HexColor("#666666")
    items = []
    for key in ["email", "phone", "location", "linkedin", "github", "portfolio"]:
        if cv_data.get(key):
            items.append((key, cv_data[key]))
    
    if not items: return y

    fscale = getattr(c, "_fscale", 1.0)
    c.setFont(_f(font_name, force_family=force_family), font_size)
    c.setFillColor(color)
    
    sep_w = c.stringWidth(sep, _f(font_name, force_family=force_family), font_size)
    
    # We group items into lines manually
    lines = []
    current_line = []
    curr_w = 0
    
    for i, (key, val) in enumerate(items):
        label, url = _parse_link(val)
        item_w = c.stringWidth(label, _f(font_name, force_family=force_family), font_size)
        
        needed = item_w + (sep_w if current_line else 0)
        if curr_w + needed > max_w and current_line:
            lines.append(current_line)
            current_line = [(label, url, item_w)]
            curr_w = item_w
        else:
            current_line.append((label, url, item_w))
            curr_w += needed
    if current_line:
        lines.append(current_line)

    curr_y = y
    for line in lines:
        row_w = sum([it[2] for it in line]) + (sep_w * (len(line) - 1))
        lx = cx - row_w / 2
        for j, (label, url, item_w) in enumerate(line):
            if j > 0:
                c.setFont(_f(font_name, force_family=force_family), font_size)
                c.setFillColor(color)
                c.drawString(lx, curr_y, sep)
                lx += sep_w
            
            c.setFont(_f(font_name, force_family=force_family), font_size)
            c.setFillColor(color)
            c.drawString(lx, curr_y, label)
            if url:
                c.linkURL(url, (lx, curr_y - 2, lx + item_w, curr_y + font_size), relative=0)
            lx += item_w
        curr_y -= (font_size * fscale + 4)
        
    return curr_y - 6

class _ClassicDark:
    SIDEBAR_BG    = HexColor("#0F1117")
    SIDEBAR_BG2   = HexColor("#141720")
    ACCENT        = HexColor("#C8A96E")
    ACCENT_LIGHT  = HexColor("#E8C98E")
    ACCENT_DARK   = HexColor("#9A7840")
    WHITE         = HexColor("#FFFFFF")
    BODY_BG       = HexColor("#FAFAFA")
    TEXT_DARK     = HexColor("#1A1C22")
    TEXT_MED      = HexColor("#4A4E5C")
    TEXT_LIGHT    = HexColor("#8A8FA0")
    DIVIDER       = HexColor("#E8EAF0")
    SIDEBAR_TEXT  = HexColor("#E8EAF2")
    SIDEBAR_MUTED = HexColor("#6A6E82")

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        SIDEBAR_W = 185
        MAIN_X    = SIDEBAR_W + 28
        MAIN_W    = W - MAIN_X - 22

        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")

        def new_page():
            c.showPage()
            _draw_rect(c, 0, 0, W, H, fill=cls.BODY_BG)
            _draw_rect(c, 0, 0, SIDEBAR_W, H, fill=cls.SIDEBAR_BG)
            c.setFillColor(cls.ACCENT)
            c.rect(SIDEBAR_W - 3, 0, 3, H, fill=1, stroke=0)
            return H - 30

        # Background
        _draw_rect(c, 0, 0, SIDEBAR_W, H, fill=cls.SIDEBAR_BG)
        _draw_rect(c, SIDEBAR_W, 0, W - SIDEBAR_W, H, fill=cls.BODY_BG)
        c.setFillColor(cls.ACCENT)
        c.rect(SIDEBAR_W - 3, 0, 3, H, fill=1, stroke=0)

        # 1. PRE-CALCULATE Header Height (Dry Run)
        name = cv_data.get("name", "")
        # Estimate height for background
        hy = H - 52
        hy = _draw_wrapped_header(c, name, 22, hy, "Poppins-Bold", 28, cls.WHITE, SIDEBAR_W + 100, 32, dry_run=True)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), 22, hy, "Lora-Italic", 13, cls.ACCENT_LIGHT, SIDEBAR_W + 100, 16, dry_run=True)
        
        # Contacts (on the right) — positioned RELATIVE to name/title block
        cy = _draw_wrapped_contact(c, cv_data, MAIN_X + 4, hy - 8 * _fscale, W - MAIN_X - 10, "Poppins", 7.5, cls.SIDEBAR_TEXT, "  ·  ", dry_run=True, force_family=FF)
        
        HEADER_BOT = min(hy, cy) - 20
        HEADER_H = H - HEADER_BOT

        # 2. DRAW Backgrounds FIRST
        _draw_rect(c, 0, HEADER_BOT, W, HEADER_H, fill=cls.SIDEBAR_BG2)
        _draw_rect(c, 0, H - 4, W, 4, fill=cls.ACCENT)

        # 3. DRAW Header Content NOW (On top of backgrounds)
        hy = H - 52
        hy = _draw_wrapped_header(c, name, 22, hy, "Poppins-Bold", 28, getattr(cls, 'NAME_COLOR', cls.WHITE), SIDEBAR_W + 100, 32, force_family=FF)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), 22, hy, "Lora-Italic", 13, getattr(cls, 'TITLE_COLOR', cls.ACCENT_LIGHT), SIDEBAR_W + 100, 16, force_family=FF)
        cy = _draw_wrapped_contact(c, cv_data, MAIN_X + 4, hy - 8 * _fscale, W - MAIN_X - 10, "Poppins", 7.5, getattr(cls, 'CONTACT_COLOR', cls.SIDEBAR_TEXT), "  ·  ", force_family=FF)
        
        # 4. Sidebar/Main start relative to header bottom
        sy = HEADER_BOT - 25
        my = HEADER_BOT - 25
        SX, SW = 14, SIDEBAR_W - 28

        def sidebar_title(t, y):
            _spaced_string(c, SX, y, t.upper(), "Poppins-Bold", 6.5, cls.ACCENT, 0.8, force_family=FF)
            c.setStrokeColor(cls.ACCENT_DARK)
            c.setLineWidth(0.5)
            c.line(SX, y - 3 * _fscale, SX + SW, y - 3 * _fscale)
            return y - 16 * _fscale

        # Skills — with scaled badges and offsets
        cats = cv_data.get("skills", {}).get("categories", [])
        if cats:
            sy = sidebar_title(L["skills"], sy)
            for cat in cats:
                if sy < 90: break
                c.setFont(_f("Poppins-Medium", FF), 7.5)
                c.setFillColor(cls.ACCENT_LIGHT)
                c.drawString(SX, sy, cat.get("name", ""))
                sy -= 11 * _fscale
                tx = SX
                for skill in cat.get("items", []):
                    if sy < 90: break
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 6.5) + 12
                    if tx + sw_tag > SIDEBAR_W - 10:
                        tx = SX
                        sy -= 18 * _fscale
                        if sy < 90: break
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, sy - 10 * _fscale, sw_tag, tag_h, fill=cls.SIDEBAR_BG, stroke=cls.ACCENT_DARK, radius=3, stroke_width=0.5)
                    c.setFont(_f("Poppins", FF), 6.5)
                    c.setFillColor(cls.SIDEBAR_MUTED)
                    c.drawString(tx + 5, sy - 10 * _fscale + (tag_h - 6.5 * _fscale) / 2 + 0.5 * _fscale, skill)
                    tx += sw_tag + 4
                sy -= 28 * _fscale
            sy -= 6 * _fscale

        # Languages — with scaled dots and offsets
        for li in cv_data.get("languages", []):
            if sy < 80: break
            if li == cv_data.get("languages", [])[0]:
                sy = sidebar_title(L["languages"], sy)
            c.setFont(_f("Poppins-Medium", FF), 8)
            c.setFillColor(cls.SIDEBAR_TEXT)
            c.drawString(SX, sy, li.get("lang", ""))
            c.setFont(_f("Poppins", FF), 6.5)
            c.setFillColor(cls.SIDEBAR_MUTED)
            c.drawString(SX, sy - 9 * _fscale, li.get("level", ""))
            dot_x = SIDEBAR_W - 14 - 45 * _fscale
            try:
                level_num = int(li.get("level_num", 4))
            except:
                level_num = 4
            for i in range(5):
                c.setFillColor(cls.ACCENT if i < level_num else cls.SIDEBAR_BG2)
                c.circle(dot_x + i * 9 * _fscale, sy + 2 * _fscale, 3 * _fscale, fill=1, stroke=0)
            sy -= 22 * _fscale
        sy -= 4 * _fscale

        # Certifications
        certs = cv_data.get("certifications", [])
        if certs:
            sy = sidebar_title(L["certifications"], sy)
            for cert in certs:
                if sy < 80: break
                c.setFillColor(cls.ACCENT)
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.drawString(SX, sy + 0.5 * _fscale, "◆")
                sy = _draw_multiline(c, cert, SX + 11, sy, "Poppins", 7, cls.SIDEBAR_MUTED, SW - 12, 11, force_family=FF) - 4

        # Score badge automatically removed upon user request to avoid awkward generated CV layout

        # Main content start was already initialized relative to HEADER_BOT above
        MX, MW = MAIN_X, MAIN_W

        def main_title(t, y):
            _spaced_string(c, MX, y, t.upper(), "Poppins-Bold", 8, getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT), 0.6, force_family=FF)
            c.setStrokeColor(cls.DIVIDER)
            c.setLineWidth(0.6)
            c.line(MX, y - 4 * _fscale, MX + MW, y - 4 * _fscale)
            return y - 18 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = main_title(L["summary"], my)
            c.setFont(_f("Lora-Italic", FF), 36)
            c.setFillColor(cls.DIVIDER)
            c.drawString(MX - 2, my + 8, "\u201C")
            my = _draw_multiline(c, cv_data["summary"], MX + 10, my, "Lora-Italic", 9.5, cls.TEXT_MED, MW - 10, 14, force_family=FF) - 14

        # Experience
        if cv_data.get("experiences"):
            my = main_title(L["experience"], my)
            for i, exp in enumerate(cv_data["experiences"]):
                # Ensure enough room for at least the role line before drawing
                if my < 120: my = new_page()
                role_y = my  # anchor for timeline dot
                c.setFillColor(cls.ACCENT)
                c.circle(MX - 7, role_y + 3.5 * _fscale, 3.5 * _fscale, fill=1, stroke=0)
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  ·  " + exp["location"]
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT_DARK))
                c.drawString(MX, my, comp)
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: my = new_page()
                    bullet_y = my
                    c.setFillColor(cls.ACCENT)
                    c.setFont(_f("Poppins-Bold", FF), 8)
                    c.drawString(MX + 2, bullet_y + 0.8 * _fscale, "›")
                    my = _draw_multiline(c, bullet, MX + 13, bullet_y, "Poppins", 8.2, cls.TEXT_MED, MW - 16, 12, force_family=FF) - 2 * _fscale
                my -= 8 * _fscale
                if i < len(cv_data["experiences"]) - 1:
                    # Only draw separator if we have room — skip if near bottom
                    if my > 100:
                        c.setStrokeColor(cls.DIVIDER)
                        c.setLineWidth(0.3)
                        c.setDash(2, 3)
                        c.line(MX, my + 3, MX + MW, my + 3)
                        c.setDash()
                    my -= 6

        # Education
        if cv_data.get("education"):
            if my < 140: my = new_page()
            my = main_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 100: my = new_page()
                c.setFillColor(cls.ACCENT)
                c.rect(MX, my - 1, 5, 5, fill=1, stroke=0)
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX + 10, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 13
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(cls.ACCENT_DARK)
                c.drawString(MX + 10, my, edu.get("school", ""))
                if edu.get("detail"):
                    my -= 12
                    my = _draw_multiline(c, edu["detail"], MX + 10, my, "Poppins", 7.8, cls.TEXT_LIGHT, MW - 12, 11)
                else:
                    my -= 16

        # Footer
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(cls.SIDEBAR_MUTED)
        c.drawCentredString(W / 2, 14, name + "  ·  CV  ·  1")
        c.save()
        return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  THÈME 2 — CANVA MINIMAL  (blanc total, typo large, accent corail)
# ══════════════════════════════════════════════════════════════════
class _CanvaMinimal:
    BG          = HexColor("#FFFFFF")
    ACCENT      = HexColor("#FF6B6B")
    ACCENT2     = HexColor("#4ECDC4")
    TEXT_DARK   = HexColor("#2D3436")
    TEXT_MED    = HexColor("#636E72")
    TEXT_LIGHT  = HexColor("#B2BEC3")
    DIVIDER     = HexColor("#F0F0F0")
    TAG_BG      = HexColor("#FFF5F5")
    TAG_BORDER  = HexColor("#FFD5D5")

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 48, W - 96

        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")

        def new_page():
            c.showPage()
            _draw_rect(c, 0, 0, W, H, fill=cls.BG)
            return H - 50

        _draw_rect(c, 0, 0, W, H, fill=cls.BG)

        # Top accent bar
        _draw_rect(c, 0, H - 6, W, 6, fill=cls.ACCENT)

        # Header zone
        my = H - 50
        name = cv_data.get("name", "")
        # Name wrapping support
        my = _draw_wrapped_header(c, name, MX, my, "Poppins-Bold", 32, getattr(cls, 'NAME_COLOR', cls.TEXT_DARK), MW, 36, force_family=FF)
        my -= 2
        # Title wrapping support
        my = _draw_wrapped_header(c, cv_data.get("title", ""), MX, my, "Lora-Italic", 14, getattr(cls, 'TITLE_COLOR', cls.ACCENT), MW, 18, force_family=FF)
        my -= 4

        # Contact line — with wrapping support
        my = _draw_wrapped_contact(c, cv_data, MX, my, MW, "Poppins", 8, getattr(cls, 'CONTACT_COLOR', cls.TEXT_LIGHT), force_family=FF)

        # Full-width accent line
        c.setStrokeColor(cls.ACCENT)
        c.setLineWidth(2)
        c.line(MX, my, MX + MW, my)
        my -= 20

        # Two-column layout: main (left 60%) + sidebar (right 38%)
        COL1_W = int(MW * 0.60)
        COL2_X = MX + COL1_W + 20
        COL2_W = MW - COL1_W - 20
        col1_y = my
        col2_y = my

        def section_title(t, x, y, w, color=None):
            col = color or getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT)
            _spaced_string(c, x, y, t.upper(), "Poppins-Bold", 7, col, 1, force_family=FF)
            c.setStrokeColor(col)
            c.setLineWidth(1.5)
            c.line(x, y - 4 * _fscale, x + w, y - 4 * _fscale)
            return y - 18 * _fscale

        # Summary with scaled offset
        if cv_data.get("summary"):
            col1_y = section_title(L["summary"], MX, col1_y, COL1_W)
            col1_y = _draw_multiline(c, cv_data["summary"], MX, col1_y, "Poppins-Italic", 9, cls.TEXT_MED, COL1_W, 13, force_family=FF) - 16 * _fscale

        if cv_data.get("experiences"):
            col1_y = section_title(L["experience"], MX, col1_y, COL1_W)
            for exp in cv_data["experiences"]:
                if col1_y < 120: col1_y = new_page(); col2_y = col1_y
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, col1_y, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + COL1_W, col1_y, exp.get("period", ""))
                col1_y -= 12 * _fscale
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  ·  " + exp["location"]
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, col1_y, comp)
                col1_y -= 12 * _fscale
                # Bullets
                for bullet in exp.get("bullets", []):
                    if col1_y < 100: col1_y = new_page()
                    bullet_y = col1_y
                    c.setFillColor(cls.ACCENT)
                    c.circle(MX + 3, bullet_y + 3 * _fscale, 2 * _fscale, fill=1, stroke=0)
                    col1_y = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8, cls.TEXT_MED, COL1_W - 14, 12, force_family=FF) - 2 * _fscale
                col1_y -= 8 * _fscale
                if col1_y > 100:
                    c.setStrokeColor(cls.DIVIDER)
                    c.setLineWidth(0.5)
                    c.line(MX, col1_y + 3 * _fscale, MX + COL1_W, col1_y + 3 * _fscale)
                col1_y -= 6 * _fscale

        # Education in col1
        if cv_data.get("education"):
            col1_y = section_title(L["education"], MX, col1_y, COL1_W)
            for edu in cv_data["education"]:
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX, col1_y, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + COL1_W, col1_y, edu.get("year", ""))
                col1_y -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(cls.ACCENT)
                c.drawString(MX, col1_y, edu.get("school", ""))
                col1_y -= 14 * _fscale

        # ── COL2: Skills + Languages + Certs ──
        if cv_data.get("skills", {}).get("categories"):
            col2_y = section_title(L["skills"], COL2_X, col2_y, COL2_W, cls.ACCENT2)
            for cat in cv_data["skills"]["categories"]:
                if col2_y < 90: break
                c.setFont(_f("Poppins-Bold", FF), 7.5)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(COL2_X, col2_y, cat.get("name", ""))
                col2_y -= 11 * _fscale
                tx = COL2_X
                for skill in cat.get("items", []):
                    if col2_y < 90: break
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 6.5) + 10
                    if tx + sw_tag > COL2_X + COL2_W:
                        tx = COL2_X
                        col2_y -= 17 * _fscale
                        if col2_y < 90: break
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, col2_y - 10 * _fscale, sw_tag, tag_h, fill=cls.TAG_BG, stroke=cls.TAG_BORDER, radius=3, stroke_width=0.4)
                    c.setFont(_f("Poppins", FF), 6.5)
                    c.setFillColor(cls.ACCENT)
                    c.drawString(tx + 4, col2_y - 10 * _fscale + (tag_h - 6.5 * _fscale) / 2 + 0.5 * _fscale, skill)
                    tx += sw_tag + 4
                col2_y -= 26 * _fscale

        if cv_data.get("languages"):
            col2_y -= 6 * _fscale
            col2_y = section_title(L["languages"], COL2_X, col2_y, COL2_W, cls.ACCENT2)
            for li in cv_data["languages"]:
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(COL2_X, col2_y, li.get("lang", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawString(COL2_X, col2_y - 10 * _fscale, li.get("level", ""))
                # Dot bar
                try:
                    level_num = int(li.get("level_num", 4))
                except:
                    level_num = 4
                for i in range(5):
                    c.setFillColor(cls.ACCENT if i < level_num else cls.DIVIDER)
                    c.circle(COL2_X + COL2_W - 50 + i * 9 * _fscale, col2_y + 2 * _fscale, 3 * _fscale, fill=1, stroke=0)
                col2_y -= 22 * _fscale

        if cv_data.get("certifications"):
            col2_y -= 6
            col2_y = section_title(L["certifications"], COL2_X, col2_y, COL2_W, cls.ACCENT2)
            for cert in cv_data["certifications"]:
                c.setFillColor(cls.ACCENT2)
                c.setFont(_f("Poppins-Bold", FF), 7)
                c.drawString(COL2_X, col2_y + 1 * _fscale, "◆")
                col2_y = _draw_multiline(c, cert, COL2_X + 10, col2_y, "Poppins", 7, cls.TEXT_MED, COL2_W - 12, 11, force_family=FF) - 4

        # Vertical separator
        c.setStrokeColor(cls.DIVIDER)
        c.setLineWidth(1)
        c.line(COL2_X - 12, my, COL2_X - 12, min(col1_y, col2_y) - 10)

        # Footer
        _draw_rect(c, 0, 0, W, 22, fill=cls.ACCENT)
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(HexColor("#FFFFFF"))
        c.drawCentredString(W / 2, 8, name + "  ·  CV")

        c.save()
        return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  THÈME 3 — NORDIC CLEAN  (pastel, espace généreux, Scandinavie)
# ══════════════════════════════════════════════════════════════════
class _NordicClean:
    BG          = HexColor("#F7F5F2")
    HEADER_BG   = HexColor("#2C3E50")
    ACCENT      = HexColor("#5B8DB8")
    ACCENT2     = HexColor("#A8C5DA")
    TEXT_DARK   = HexColor("#2C3E50")
    TEXT_MED    = HexColor("#5D6D7E")
    TEXT_LIGHT  = HexColor("#AEB6BF")
    DIVIDER     = HexColor("#E8E4DF")
    WHITE       = HexColor("#FFFFFF")
    TAG_BG      = HexColor("#EBF3F9")

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 52, W - 104

        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")

        def new_page():
            c.showPage()
            _draw_rect(c, 0, 0, W, H, fill=cls.BG)
            return H - 50

        _draw_rect(c, 0, 0, W, H, fill=cls.BG)

        # 1. PRE-CALCULATE Header Height (Dry Run)
        name = cv_data.get("name", "")
        hy = H - 55
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 30, cls.WHITE, MW, 34, dry_run=True, force_family=FF)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Light", 13, cls.ACCENT2, MW, 16, dry_run=True, force_family=FF)

        # Contact bills simulation 
        cx = MX
        cy_h = hy - 12 * _fscale
        contact_keys = [("email", "✉"), ("phone", "✆"), ("location", "⌖"), ("linkedin", "↗"), ("github", "git"), ("portfolio", "🕸")]
        for key, icon in contact_keys:
            if not cv_data.get(key): continue
            label, _ = _parse_link(cv_data[key])
            badge_text = icon + " " + label
            badge_w = c.stringWidth(badge_text, _f("Poppins", FF), 7) + 16
            if cx + badge_w > W - MX:
                cx = MX
                cy_h -= 20 * _fscale
            cx += badge_w + 6
        HEADER_BOT = cy_h - 22 * _fscale
        HEADER_H = H - HEADER_BOT

        # 2. DRAW Backgrounds FIRST
        _draw_rect(c, 0, HEADER_BOT, W, HEADER_H, fill=cls.HEADER_BG)
        _draw_rect(c, 0, HEADER_BOT, 5, HEADER_H, fill=cls.ACCENT)

        # 3. DRAW Header Content NOW (On top of backgrounds)
        hy = H - 55
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 30, getattr(cls, 'NAME_COLOR', cls.WHITE), MW, 34, force_family=FF)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Light", 13, getattr(cls, 'TITLE_COLOR', cls.ACCENT2), MW, 16, force_family=FF)

        cx = MX
        cy_h = hy - 12 * _fscale
        for key, icon in contact_keys:
            if not cv_data.get(key): continue
            label, url = _parse_link(cv_data[key])
            badge_text = icon + " " + label
            badge_w = c.stringWidth(badge_text, _f("Poppins", FF), 7) + 16
            if cx + badge_w > W - MX:
                cx = MX
                cy_h -= 20 * _fscale
            tag_h = 14 * _fscale
            _draw_rect(c, cx, cy_h - 8 * _fscale, badge_w, tag_h, fill=HexColor("#3D5166"), radius=tag_h/2, stroke_width=0)
            c.setFont(_f("Poppins", FF), 7)
            c.setFillColor(getattr(cls, 'CONTACT_COLOR', cls.ACCENT2))
            c.drawString(cx + 8, (cy_h - 8 * _fscale) + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, badge_text)
            if url:
                c.linkURL(url, (cx, cy_h - 8 * _fscale, cx + badge_w, cy_h + 6 * _fscale), relative=0)
            cx += badge_w + 6

        # 4. Content starting point
        my = HEADER_BOT - 25

        def section_title(t, y):
            _draw_rect(c, MX - 14, y - 2 * _fscale, 4, 14 * _fscale, fill=cls.ACCENT)
            _spaced_string(c, MX, y, t.upper(), "Poppins-Bold", 9, getattr(cls, 'SECTION_TITLE_COLOR', cls.TEXT_DARK), 1.2, force_family=FF)
            c.setStrokeColor(cls.DIVIDER)
            c.setLineWidth(0.8)
            c.line(MX, y - 5 * _fscale, MX + MW, y - 5 * _fscale)
            return y - 20 * _fscale

        # Summary with scaled offset
        if cv_data.get("summary"):
            my = section_title(L["summary"], my)
            # Accent underline sits below the section title, above the body text
            _draw_rect(c, MX - 14, my + 6 * _fscale, MW + 14, 1, fill=cls.ACCENT2)
            my -= 4 * _fscale  # gap between bar and text
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Lora-Italic", 9.5, cls.TEXT_MED, MW, 14, force_family=FF) - 18 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 120: my = new_page()
                # Timeline dot — centered on role text line
                _draw_rect(c, MX - 18, my + 0.5 * _fscale, 7 * _fscale, 7 * _fscale, fill=cls.ACCENT, radius=3.5 * _fscale)
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.ACCENT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_MED))
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  —  " + exp["location"]
                c.drawString(MX, my, comp)
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: my = new_page()
                    bullet_y = my
                    # Vertical guide line with scaling
                    bullet_h = _multiline_height(c, bullet, "Poppins", 8.2, MW - 14, 12, force_family=FF)
                    c.setStrokeColor(cls.ACCENT)
                    c.setLineWidth(1)
                    c.line(MX + 2, bullet_y + 6 * _fscale, MX + 2, bullet_y - bullet_h + 12 * _fscale)
                    my = _draw_multiline(c, bullet, MX + 10, bullet_y, "Poppins", 8.2, cls.TEXT_MED, MW - 14, 12, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
                if my > 100:
                    c.setStrokeColor(cls.DIVIDER)
                    c.setLineWidth(0.5)
                    c.setDash(3, 4)
                    c.line(MX, my + 3 * _fscale, MX + MW, my + 3 * _fscale)
                    c.setDash()
                my -= 6 * _fscale

        # Education
        if cv_data.get("education"):
            if my < 140: my = new_page()
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 100: my = new_page()
                _draw_rect(c, MX - 18, my + 0.5 * _fscale, 7 * _fscale, 7 * _fscale, fill=cls.ACCENT2, radius=3.5 * _fscale)
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.ACCENT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 13 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(cls.TEXT_MED)
                c.drawString(MX, my, edu.get("school", ""))
                if edu.get("detail"):
                    my -= 12 * _fscale
                    my = _draw_multiline(c, edu["detail"], MX, my, "Poppins", 7.8, cls.TEXT_LIGHT, MW, 11, force_family=FF)
                else:
                    my -= 16 * _fscale

        # Skills + Languages bottom row
        if my < 160: my = new_page()
        my = section_title(L["skills_lang"], my)
        tx = MX
        for cat in cv_data.get("skills", {}).get("categories", []):
            c.setFont(_f("Poppins-Bold", FF), 7.5)
            c.setFillColor(cls.TEXT_DARK)
            c.drawString(tx, my, cat.get("name", ""))
            ty = my - 12 * _fscale
            for skill in cat.get("items", []):
                sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                tag_h = 15 * _fscale
                _draw_rect(c, tx, ty - 10 * _fscale, sw_tag, tag_h, fill=cls.TAG_BG, stroke=cls.ACCENT2, radius=4 * _fscale, stroke_width=0.5)
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.ACCENT)
                c.drawString(tx + 5, ty - 10 * _fscale + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, skill)
                ty -= 19 * _fscale
            tx += (MW // 3) + 10

        # Footer
        _draw_rect(c, 0, 0, W, 20, fill=cls.HEADER_BG)
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(cls.ACCENT2)
        c.drawCentredString(W / 2, 7, name + "  ·  CV")

        c.save()
        return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  THÈME 4 — TECH GRID  (géométrique, startup Silicon Valley)
# ══════════════════════════════════════════════════════════════════
class _TechGrid:
    BG          = HexColor("#0D1117")
    SURFACE     = HexColor("#161B22")
    SURFACE2    = HexColor("#21262D")
    ACCENT      = HexColor("#58A6FF")
    ACCENT2     = HexColor("#3FB950")
    ACCENT3     = HexColor("#F78166")
    TEXT        = HexColor("#E6EDF3")
    TEXT_MED    = HexColor("#8B949E")
    TEXT_LIGHT  = HexColor("#484F58")
    BORDER      = HexColor("#30363D")

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 44, W - 88

        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")

        def new_page():
            c.showPage()
            _draw_rect(c, 0, 0, W, H, fill=cls.BG)
            # Grid lines
            c.setStrokeColor(cls.BORDER)
            c.setLineWidth(0.3)
            for gx in range(0, int(W), 30):
                c.line(gx, 0, gx, H)
            for gy in range(0, int(H), 30):
                c.line(0, gy, W, gy)
            return H - 50

        _draw_rect(c, 0, 0, W, H, fill=cls.BG)

        # Subtle grid
        c.setStrokeColor(cls.BORDER)
        c.setLineWidth(0.3)
        for gx in range(0, int(W), 30):
            c.line(gx, 0, gx, H)
        for gy in range(0, int(H), 30):
            c.line(0, gy, W, gy)

        # 1. PRE-CALCULATE Header Height (Dry Run)
        name = cv_data.get("name", "")
        # Estimate height for background card
        hy = H - 52
        # Internal wrapping calculation (simulated heights)
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 26, cls.TEXT, MW, 30, dry_run=True)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Medium", 11, cls.ACCENT, MW, 14, dry_run=True)
        
        # Contact badges wrap estimate
        cx = MX
        cy_h = hy - 12 * _fscale
        contact_keys = [("email", "✉", cls.ACCENT), ("phone", "✆", cls.ACCENT2),
                         ("location", "⌖", cls.ACCENT3), ("linkedin", "↗", cls.ACCENT),
                         ("github", "git", cls.ACCENT2), ("portfolio", "🕸", cls.ACCENT3)]
        for key, icon, col in contact_keys:
            if not cv_data.get(key): continue
            label, _ = _parse_link(cv_data[key])
            badge_text = icon + " " + label
            badge_w = c.stringWidth(badge_text, _f("Poppins", FF), 7) + 14
            if cx + badge_w > W - MX:
                cx = MX
                cy_h -= 18 * _fscale
            cx += badge_w + 6
            
        HEADER_BOT = cy_h - 18 * _fscale
        header_card_h = H - 12 - HEADER_BOT
        
        # 2. DRAW Backgrounds FIRST
        _draw_rect(c, MX - 12, HEADER_BOT, MW + 24, header_card_h, fill=cls.SURFACE, stroke=cls.BORDER, radius=8, stroke_width=0.8)
        _draw_rect(c, MX - 12, H - 18, 60 * _fscale, 6 * _fscale, fill=cls.ACCENT, radius=3)

        # 3. DRAW Header Content NOW (On top of backgrounds)
        hy = H - 52
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 26, getattr(cls, 'NAME_COLOR', cls.TEXT), MW, 30)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Medium", 11, getattr(cls, 'TITLE_COLOR', cls.ACCENT), MW, 14)

        cx = MX
        cy_h = hy - 12 * _fscale
        for key, icon, col in contact_keys:
            if not cv_data.get(key): continue
            label, url = _parse_link(cv_data[key])
            badge_text = icon + " " + label
            badge_w = c.stringWidth(badge_text, _f("Poppins", FF), 7) + 14
            if cx + badge_w > W - MX:
                cx = MX
                cy_h -= 18 * _fscale
            tag_h = 14 * _fscale
            _draw_rect(c, cx, cy_h - 8 * _fscale, badge_w, tag_h, fill=cls.SURFACE2, stroke=cls.BORDER, radius=4, stroke_width=0.5)
            c.setFont(_f("Poppins", FF), 7)
            c.setFillColor(getattr(cls, 'CONTACT_COLOR', col))
            c.drawString(cx + 5, (cy_h - 8 * _fscale) + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, badge_text)
            if url:
                c.linkURL(url, (cx, cy_h - 8 * _fscale, cx + badge_w, cy_h + 6 * _fscale), relative=0)
            cx += badge_w + 6

        # 4. Main content start relative to header bottom
        my = HEADER_BOT - 20 * _fscale

        def section_title(t, y):
            _spaced_string(c, MX, y, t.upper(), "Poppins-Bold", 7, getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT), 0.8, force_family=FF)
            c.setStrokeColor(cls.BORDER)
            c.setLineWidth(0.5)
            c.line(MX, y - 5 * _fscale, MX + MW, y - 5 * _fscale)
            return y - 18 * _fscale

        # Summary with scaled offset
        if cv_data.get("summary"):
            my = section_title(f"// {L['summary']}", my)
            # Accent bar sits just below the section title, above the text
            _draw_rect(c, MX - 12, my + 6 * _fscale, MW + 24, 2, fill=cls.ACCENT)
            my -= 8 * _fscale  # gap below the bar before text starts
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 8.5, cls.TEXT_MED, MW, 13, force_family=FF) - 10 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(f"// {L['experience']}", my)
            for exp in cv_data["experiences"]:
                bullets = exp.get("bullets", [])

                # Pre-calculate content height with scaling
                content_h = (13 + 12) * _fscale
                for bullet in bullets:
                    content_h += _multiline_height(c, bullet, "Poppins", 8, MW - 14, 12, force_family=FF) + 2 * _fscale
                
                PAD_TOP, PAD_BOT = 14 * _fscale, 14 * _fscale
                card_h = content_h + PAD_TOP + PAD_BOT
                
                if my - card_h < 40:
                    my = new_page()
                
                _draw_rect(c, MX - 10, my - content_h - PAD_BOT, MW + 20, card_h,
                           fill=cls.SURFACE, stroke=cls.BORDER, radius=6, stroke_width=0.5)
                
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.ACCENT2)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  /  " + exp["location"]
                c.drawString(MX, my, comp)
                my -= 12 * _fscale
                for bullet in bullets:
                    bullet_y = my
                    c.setFont(_f("Poppins-Bold", FF), 8)
                    # Force visibility for bullets using a high-contrast choice if needed
                    # but usually ACCENT2 is the brand color now.
                    c.setFillColor(getattr(cls, 'ACCENT2', cls.ACCENT2))
                    c.drawString(MX + 2, bullet_y + 0.8 * _fscale, ">")
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8, cls.TEXT_MED, MW - 14, 12, force_family=FF) - 2 * _fscale
                my -= (PAD_BOT + PAD_TOP + 12)

        # Education
        if cv_data.get("education"):
            if my < 120: my = new_page()
            my = section_title(f"// {L['education']}", my)
            for edu in cv_data["education"]:
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(cls.TEXT)
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.ACCENT2)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                my -= 14 * _fscale

        # Skills as inline tags
            my = section_title(f"// {L['skills']}", my)
            tx = MX
            for cat in cv_data["skills"]["categories"]:
                for skill in cat.get("items", []):
                    if my < 40: break
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 19
                        if my < 40: break
                    tag_h = 15
                    _draw_rect(c, tx, my - 10, sw_tag, tag_h, fill=cls.SURFACE2, stroke=cls.ACCENT, radius=3, stroke_width=0.5)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(cls.ACCENT)
                    c.drawString(tx + 5, my - 10 + (tag_h - 7) / 2 + 0.5, skill)
                    tx += sw_tag + 5
            my -= 20

        # Languages
        if cv_data.get("languages"):
            if my < 80: my = new_page()
            my = section_title(f"// {L['languages']}", my)
            tx = MX
            for li in cv_data["languages"]:
                if my < 40: break
                lang_text = f"{li.get('lang', '')} ({li.get('level', '')})"
                sw_tag = c.stringWidth(lang_text, _f("Poppins", FF), 7) + 12
                if tx + sw_tag > MX + MW:
                    tx = MX
                    my -= 19
                    if my < 40: break
                tag_h = 15
                _draw_rect(c, tx, my - 10, sw_tag, tag_h, fill=cls.SURFACE2, stroke=cls.ACCENT2, radius=3, stroke_width=0.5)
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.ACCENT2)
                c.drawString(tx + 5, my - 10 + (tag_h - 7) / 2 + 0.5, lang_text)
                tx += sw_tag + 5
            my -= 30

        # Footer
        _draw_rect(c, 0, 0, W, 20, fill=cls.SURFACE)
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(cls.TEXT_MED)
        c.drawCentredString(W / 2, 7, "// " + name + " · CV · 2026")

        c.save()
        return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  THÈME 5 — LUXURY SERIF  (cabinet de conseil, élégance classique)
# ══════════════════════════════════════════════════════════════════
class _LuxurySerif:
    BG          = HexColor("#FFFEF9")
    ACCENT      = HexColor("#8B6914")
    ACCENT2     = HexColor("#C4A35A")
    ACCENT3     = HexColor("#E8D5A3")
    TEXT_DARK   = HexColor("#1A1208")
    TEXT_MED    = HexColor("#4A3F2F")
    TEXT_LIGHT  = HexColor("#9A8F7F")
    DIVIDER     = HexColor("#E8E0D0")
    HEADER_BG   = HexColor("#1A1208")

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 56, W - 112

        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")

        def new_page():
            c.showPage()
            _draw_rect(c, 0, 0, W, H, fill=cls.BG)
            return H - 50

        _draw_rect(c, 0, 0, W, H, fill=cls.BG)

        # Elegant top border (double line)
        _draw_rect(c, 0, H - 3, W, 3, fill=cls.ACCENT)
        _draw_rect(c, 0, H - 6, W, 1, fill=cls.ACCENT2)

        # Header — centered, serif
        name = cv_data.get("name", "")
        # Name wrapping 
        hy = H - 48
        hy = _draw_wrapped_header(c, name, MX, hy, "Lora", 30, getattr(cls, 'NAME_COLOR', cls.TEXT_DARK), MW, 34, centered=True, force_family=FF)
        hy -= 4
        # Title wrapping
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Light", 11, getattr(cls, 'TITLE_COLOR', cls.ACCENT), MW, 14, centered=True, force_family=FF)

        # Ornamental divider — RELATIVE to title bottom
        div_y = hy - 14 * _fscale
        c.setStrokeColor(cls.ACCENT2)
        c.setLineWidth(0.8)
        c.line(MX, div_y, W / 2 - 20 * _fscale, div_y)
        c.setFont(_f("Lora"), 10)
        c.setFillColor(cls.ACCENT2)
        c.drawCentredString(W / 2, div_y - 3 * _fscale, "◆")
        c.line(W / 2 + 20 * _fscale, div_y, MX + MW, div_y)

        # Contact centered — RELATIVE to divider
        my = _draw_wrapped_centred_contact(c, cv_data, W/2, div_y - 24 * _fscale, MW, "Poppins", 7.5, getattr(cls, 'CONTACT_COLOR', cls.TEXT_LIGHT), "  ·  ", force_family=FF)

        # Main body starts below contact
        my -= 20 * _fscale

        def section_title(t, y):
            c.setStrokeColor(cls.ACCENT3)
            c.setLineWidth(0.6)
            c.line(MX, y, MX + MW * 0.3, y)
            c.line(MX + MW * 0.7, y, MX + MW, y)
            _spaced_centred(c, W / 2, y - 2 * _fscale, t.upper(), "Poppins-Bold", 7, getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT), 1.2, force_family=FF)
            return y - 18 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = section_title("Profil", my)
            c.setFont(_f("Lora-Italic", FF), 9.5)
            c.setFillColor(cls.TEXT_MED)
            # Centered italic summary
            words = cv_data["summary"].split()
            lines, current = [], []
            for word in words:
                test = " ".join(current + [word])
                if c.stringWidth(test, _f("Lora-Italic", FF), 9.5) <= MW:
                    current.append(word)
                else:
                    lines.append(" ".join(current))
                    current = [word]
            if current: lines.append(" ".join(current))
            for line in lines:
                c.drawCentredString(W / 2, my, line)
                my -= 13 * _fscale
            my -= 10 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title("Expérience", my)
            for exp in cv_data["experiences"]:
                if my < 80: my = new_page()
                # Role in serif
                c.setFont(_f("Lora"), 11)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  ·  " + exp["location"]
                c.drawString(MX, my, comp)
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 80: my = new_page()
                    c.setFillColor(cls.ACCENT2)
                    c.setFont(_f("Lora"), 9)
                    c.drawString(MX + 2, my + 1.2 * _fscale, "—")
                    my = _draw_multiline(c, bullet, MX + 14, my, "Poppins", 8.2, cls.TEXT_MED, MW - 16, 12, force_family=FF) - 3 * _fscale
                my -= 10 * _fscale
                c.setStrokeColor(cls.DIVIDER)
                c.setLineWidth(0.4)
                c.line(MX + 20, my + 4 * _fscale, MX + MW - 20, my + 4 * _fscale)
                my -= 6 * _fscale

        # Education
        if cv_data.get("education"):
            if my < 120: my = new_page()
            my = section_title("Formation", my)
            for edu in cv_data["education"]:
                c.setFont(_f("Lora"), 10)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                if edu.get("detail"):
                    my -= 11
                    _draw_multiline(c, edu["detail"], MX, my, "Poppins", 7.8, cls.TEXT_LIGHT, MW, 11, force_family=FF)
                    my -= 11
                else:
                    my -= 14

        # Skills — elegant inline
        if cv_data.get("skills", {}).get("categories"):
            if my < 100: my = new_page()
            my = section_title("Compétences", my)
            for cat in cv_data["skills"]["categories"]:
                c.setFont(_f("Poppins-Bold", FF), 7.5)
                c.setFillColor(cls.ACCENT)
                c.drawString(MX, my, cat.get("name", "") + " :")
                label_w = c.stringWidth(cat.get("name", "") + " :", _f("Poppins-Bold", FF), 7.5) + 8
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_MED)
                c.drawString(MX + label_w, my, "  ·  ".join(cat.get("items", [])))
                my -= 14

        # Languages
        if cv_data.get("languages"):
            my -= 4
            my = section_title("Langues", my)
            lang_str = "  ·  ".join([f"{li.get('lang','')} ({li.get('level','')})" for li in cv_data["languages"]])
            c.setFont(_f("Poppins", FF), 8)
            c.setFillColor(cls.TEXT_MED)
            c.drawCentredString(W / 2, my, lang_str)
            my -= 14

        # Bottom double border
        _draw_rect(c, 0, 3, W, 1, fill=cls.ACCENT2)
        _draw_rect(c, 0, 0, W, 3, fill=cls.ACCENT)
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(cls.TEXT_LIGHT)
        c.drawCentredString(W / 2, 8, name + "  ◆  CV")

        c.save()
        return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  FACTORY EXPANSION: 10 NEW INDUSTRY THEMES 
# ══════════════════════════════════════════════════════════════════

class _FinancePro(_NordicClean):
    BG          = HexColor("#FFFFFF")
    HEADER_BG   = HexColor("#1A2530")  # Navy
    ACCENT      = HexColor("#A78B50")  # Gold
    ACCENT2     = HexColor("#627C6C")  # Muted Green
    TEXT_DARK   = HexColor("#111820")
    TEXT_MED    = HexColor("#334155")
    TEXT_LIGHT  = HexColor("#64748B")
    DIVIDER     = HexColor("#E2E8F0")

class _MedicalClean(_CanvaMinimal):
    BG          = HexColor("#F8FAFC")
    ACCENT      = HexColor("#0EA5E9")  # Aqua/Sky
    ACCENT2     = HexColor("#38BDF8")
    TEXT_DARK   = HexColor("#0F172A")
    TEXT_MED    = HexColor("#475569")
    TEXT_LIGHT  = HexColor("#94A3B8")
    TAG_BG      = HexColor("#E0F2FE")
    TAG_BORDER  = HexColor("#BAE6FD")

class _BTPIndustry(_CanvaMinimal):
    BG          = HexColor("#FFFFFF")
    ACCENT      = HexColor("#F97316")  # Safety Orange
    ACCENT2     = HexColor("#475569")  # Steel Gray
    TEXT_DARK   = HexColor("#1E293B")
    TEXT_MED    = HexColor("#334155")
    TEXT_LIGHT  = HexColor("#64748B")
    TAG_BG      = HexColor("#F1F5F9")
    TAG_BORDER  = HexColor("#CBD5E1")
    DIVIDER     = HexColor("#E2E8F0")

class _ApprenticeStarter(_ClassicDark):
    SIDEBAR_BG    = HexColor("#FCD34D") # Vibrant Yellow
    SIDEBAR_BG2   = HexColor("#FBBF24")
    ACCENT        = HexColor("#1E3A8A") # Royal Blue
    ACCENT_LIGHT  = HexColor("#2563EB")
    ACCENT_DARK   = HexColor("#1E40AF")
    WHITE         = HexColor("#111827") # Dark text on sidebar
    BODY_BG       = HexColor("#FFFFFF")
    TEXT_DARK     = HexColor("#111827")
    TEXT_MED      = HexColor("#374151")
    TEXT_LIGHT    = HexColor("#6B7280")
    SIDEBAR_TEXT  = HexColor("#1F2937")
    SIDEBAR_MUTED = HexColor("#4B5563")

class _StartupSaaS(_TechGrid):
    BG          = HexColor("#0F172A")
    SURFACE     = HexColor("#1E293B")
    SURFACE2    = HexColor("#334155")
    ACCENT      = HexColor("#8B5CF6") # Violet
    ACCENT2     = HexColor("#EC4899") # Pink
    ACCENT3     = HexColor("#06B6D4") # Cyan
    TEXT        = HexColor("#F8FAFC")
    TEXT_MED    = HexColor("#94A3B8")
    TEXT_LIGHT  = HexColor("#64748B")
    BORDER      = HexColor("#475569")

class _AcademicLegal(_NordicClean):
    BG          = HexColor("#FFFFFF")
    HEADER_BG   = HexColor("#000000")
    ACCENT      = HexColor("#404040")
    ACCENT2     = HexColor("#737373")
    TEXT_DARK   = HexColor("#171717")
    TEXT_MED    = HexColor("#404040")
    TEXT_LIGHT  = HexColor("#737373")
    DIVIDER     = HexColor("#D4D4D4")
    WHITE       = HexColor("#FFFFFF")
    TAG_BG      = HexColor("#FAFAFA")

class _CreativeAgency(_ClassicDark):
    SIDEBAR_BG    = HexColor("#FFE4E6") # Rose
    SIDEBAR_BG2   = HexColor("#FECDD3")
    ACCENT        = HexColor("#E11D48") # Rose strong
    ACCENT_LIGHT  = HexColor("#F43F5E")
    ACCENT_DARK   = HexColor("#BE123C")
    WHITE         = HexColor("#4C0519") # Dark red text on sidebar
    BODY_BG       = HexColor("#FFFFFF")
    TEXT_DARK     = HexColor("#111827")
    TEXT_MED      = HexColor("#4C0519")
    TEXT_LIGHT    = HexColor("#881337")
    SIDEBAR_TEXT  = HexColor("#881337")
    SIDEBAR_MUTED = HexColor("#9F1239")

class _Logistics(_TechGrid):
    BG          = HexColor("#FFFFFF")
    SURFACE     = HexColor("#F1F5F9")
    SURFACE2    = HexColor("#E2E8F0")
    ACCENT      = HexColor("#1E40AF") # Navy
    ACCENT2     = HexColor("#16A34A") # Green
    ACCENT3     = HexColor("#CA8A04") # Yellow
    TEXT        = HexColor("#0F172A")
    TEXT_MED    = HexColor("#334155")
    TEXT_LIGHT  = HexColor("#64748B")
    BORDER      = HexColor("#CBD5E1")

class _RetailSales(_CanvaMinimal):
    BG          = HexColor("#FFFFFF")
    ACCENT      = HexColor("#DC2626") # Red
    ACCENT2     = HexColor("#111827") # Black
    TEXT_DARK   = HexColor("#111827")
    TEXT_MED    = HexColor("#4B5563")
    TEXT_LIGHT  = HexColor("#6B7280")
    TAG_BG      = HexColor("#FEF2F2")
    TAG_BORDER  = HexColor("#FCA5A5")

class _Executive(_ClassicDark):
    SIDEBAR_BG    = HexColor("#E2E8F0") # Slate
    SIDEBAR_BG2   = HexColor("#CBD5E1")
    ACCENT        = HexColor("#334155") # Deep Slate
    ACCENT_LIGHT  = HexColor("#475569")
    ACCENT_DARK   = HexColor("#1E293B")
    WHITE         = HexColor("#0F172A")
    BODY_BG       = HexColor("#FFFFFF")
    TEXT_DARK     = HexColor("#0F172A")
    TEXT_MED      = HexColor("#334155")
    TEXT_LIGHT    = HexColor("#64748B")
    SIDEBAR_TEXT  = HexColor("#0F172A")
    SIDEBAR_MUTED = HexColor("#475569")

class _SotaLuxury(_CanvaMinimal):
    BG          = HexColor("#FDFDFD")
    ACCENT      = HexColor("#C5B358") # Champagne Gold
    ACCENT2     = HexColor("#D4C3A3")
    TEXT_DARK   = HexColor("#1A1A1A")
    TEXT_MED    = HexColor("#404040")
    TEXT_LIGHT  = HexColor("#808080")
    TAG_BG      = HexColor("#FBF9F0")
    TAG_BORDER  = HexColor("#EAE7D2")
    DIVIDER     = HexColor("#F2F2F2")


# ══════════════════════════════════════════════════════════════════
#  DISPATCHER — point d'entrée unique
# ══════════════════════════════════════════════════════════════════
THEMES = {
    "Classic Dark":   _ClassicDark,
    "Canva Minimal":  _CanvaMinimal,
    "Nordic Clean":   _NordicClean,
    "Tech Grid":      _TechGrid,
    "Luxury Serif":   _LuxurySerif,
    "Finance Pro":    _FinancePro,
    "Medical Clean":  _MedicalClean,
    "BTP Industry":   _BTPIndustry,
    "Apprentice":     _ApprenticeStarter,
    "Startup SaaS":   _StartupSaaS,
    "Academic Legal": _AcademicLegal,
    "Creative Ag.":   _CreativeAgency,
    "Logistics":      _Logistics,
    "Retail Sales":   _RetailSales,
    "Executive C":    _Executive,
    "SOTA Luxury":    _SotaLuxury
}


def generate_cv_pdf(cv_data: dict, theme: str = "Classic Dark") -> bytes:
    cls = THEMES.get(theme, _ClassicDark)
    log.info(f"generate_cv_pdf | theme={theme} | name={cv_data.get('name')}")
    result = cls.generate(cv_data)
    log.info(f"generate_cv_pdf | done | size={len(result)} bytes")
    return result


# ══════════════════════════════════════════════════════════════════
#  COVER LETTER GENERATOR  (thème Classic Dark, inchangé)
# ══════════════════════════════════════════════════════════════════
def generate_cover_letter_pdf(letter_data: dict) -> bytes:
    log.info(f"generate_cover_letter_pdf | name={letter_data.get('name')} company={letter_data.get('company_name')}")
    buf = io.BytesIO()
    W, H = A4
    MX, MXR = 52, W - 52
    MW = MXR - MX

    C, _fscale = _apply_custom_style(_ClassicDark, letter_data)
    c = canvas.Canvas(buf, pagesize=A4)
    if _fscale != 1.0:
        c._old_setFont = c.setFont
        c.setFont = lambda psname, size: c._old_setFont(psname, size * _fscale)
    c.setTitle(letter_data.get("name", "") + " — Lettre de motivation")

    _draw_rect(c, 0, 0, W, H, fill=HexColor("#FAFAFA"))
    _draw_rect(c, 0, 0, 5, H, fill=C.ACCENT)
    # Header Content — calculated first
    name  = letter_data.get("name", "")
    title = letter_data.get("title", "")

    # Name 
    hy = H - 46
    # 2. DRAW Backgrounds FIRST
    _draw_rect(c, 0, HEADER_BOT, W, H - HEADER_BOT, fill=C.SIDEBAR_BG2)
    _draw_rect(c, 0, H - 4, W, 4, fill=C.ACCENT)
    _draw_rect(c, 0, HEADER_BOT, 5, H - HEADER_BOT, fill=C.ACCENT)

    # 3. DRAW Header Content NOW (On top of backgrounds)
    c.setFont(_f("Poppins-Bold", FF), 22)
    c.setFillColor(C.WHITE)
    hy = H - 46
    hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 22, C.WHITE, MW/2, 26)
    hy -= 4
    hy = _draw_wrapped_header(c, title, MX, hy, "Lora-Italic", 11, C.ACCENT_LIGHT, MW/2, 14)

    c.setFont(_f("Poppins", FF), 7.5)
    c.setFillColor(C.SIDEBAR_MUTED)
    
    sep = "  ·  "
    current_x = MXR
    cy_h = H - 50
    for i, (label, url) in enumerate(reversed(contact_items)):
        sw_label = c.stringWidth(label, _f("Poppins", FF), 7.5)
        sw_sep = c.stringWidth(sep, _f("Poppins", FF), 7.5) if i > 0 else 0
        if current_x - sw_label - sw_sep < MX + MW/2 + 20:
             current_x = MXR
             cy_h -= 14 * _fscale
        if i > 0:
            current_x -= sw_sep
            c.drawString(current_x, cy_h, sep)
        current_x -= sw_label
        if url:
            _draw_link(c, current_x, cy_h, label, url, "Poppins", 7.5, C.SIDEBAR_MUTED)
        else:
            c.drawString(current_x, cy_h, label)

    c.setStrokeColor(C.ACCENT_DARK)
    c.setLineWidth(0.6)
    c.line(MX, HEADER_BOT + 12, MXR, HEADER_BOT + 12)

    # Content start
    cy = HEADER_BOT - 25
    c.setFont(_f("Poppins", FF), 8.5)
    c.setFillColor(C.TEXT_MED)
    c.drawRightString(MXR, cy, letter_data.get("date", ""))
    cy -= 28
    c.setFont(_f("Poppins", FF), 8.5)
    c.setFillColor(C.TEXT_MED)
    c.drawRightString(MXR, cy, letter_data.get("date", ""))
    cy -= 28

    company      = letter_data.get("company_name", "")
    company_addr = letter_data.get("company_address", "")
    hiring       = letter_data.get("hiring_manager", "")

    c.setFont(_f("Poppins-Bold", FF), 9)
    c.setFillColor(C.TEXT_DARK)
    c.drawString(MX, cy, company)
    cy -= 13
    if hiring:
        c.setFont(_f("Poppins", FF), 8.5)
        c.setFillColor(C.TEXT_MED)
        c.drawString(MX, cy, "À l'attention de " + hiring)
        cy -= 11
    if company_addr:
        c.setFont(_f("Poppins", FF), 8.5)
        c.setFillColor(C.TEXT_LIGHT)
        c.drawString(MX, cy, company_addr)
        cy -= 11
    cy -= 18

    subject = letter_data.get("subject", "Candidature")
    subj_w  = c.stringWidth("Objet : " + subject, _f("Poppins-Bold", FF), 9) + 24
    _draw_rect(c, MX - 4, cy - 6, min(subj_w, MW + 8), 20,
               fill=HexColor("#F0F2F8"), stroke=HexColor("#E8EAF0"), radius=4, stroke_width=0.5)
    c.setFont(_f("Poppins-Bold", FF), 9)
    c.setFillColor(C.ACCENT_DARK)
    c.drawString(MX + 8, cy + 1, "Objet : ")
    c.setFillColor(C.TEXT_DARK)
    c.drawString(MX + 8 + c.stringWidth("Objet : ", _f("Poppins-Bold", FF), 9), cy + 1, subject)
    cy -= 26

    salutation = "Madame, Monsieur,"
    if hiring:
        last = hiring.split()[-1] if hiring else ""
        salutation = f"Madame, Monsieur {last},"
    c.setFont(_f("Poppins", FF), 9.5)
    c.setFillColor(C.TEXT_DARK)
    c.drawString(MX, cy, salutation)
    cy -= 22

    for i, para in enumerate(letter_data.get("body_paragraphs", [])):
        if cy < 120:
            c.showPage()
            _draw_rect(c, 0, 0, W, H, fill=HexColor("#FAFAFA"))
            _draw_rect(c, 0, 0, 5, H, fill=C.ACCENT)
            cy = H - 50
        if i == 0 and para:
            c.setFont(_f("Lora"), 22)
            c.setFillColor(C.ACCENT)
            c.drawString(MX, cy - 6, para[0])
            drop_w = c.stringWidth(para[0], _f("Lora"), 22) + 4
            c.setFont(_f("Poppins", FF), 9.5)
            c.setFillColor(C.TEXT_DARK)
            words, first_line_words = para[1:].split(), []
            for word in words:
                test = " ".join(first_line_words + [word])
                if c.stringWidth(test, _f("Poppins", FF), 9.5) <= MW - drop_w:
                    first_line_words.append(word)
                else:
                    break
            c.drawString(MX + drop_w, cy, " ".join(first_line_words))
            cy -= 15
            remaining = " ".join(words[len(first_line_words):])
            if remaining:
                cy = _draw_multiline(c, remaining, MX, cy, "Poppins", 9.5, C.TEXT_DARK, MW, 15)
        else:
            cy = _draw_multiline(c, para, MX, cy, "Poppins", 9.5, C.TEXT_DARK, MW, 15)
        cy -= 16

    if cy < 160:
        c.showPage()
        _draw_rect(c, 0, 0, W, H, fill=HexColor("#FAFAFA"))
        _draw_rect(c, 0, 0, 5, H, fill=C.ACCENT)
        cy = H - 50

    cy -= 10
    _draw_multiline(c, "Dans l'attente de vous rencontrer, je vous adresse mes cordiales salutations.",
                    MX, cy, "Poppins", 9.5, C.TEXT_MED, MW, 15)
    cy -= 40

    c.setFont(_f("Poppins-Bold", FF), 11)
    c.setFillColor(C.TEXT_DARK)
    c.drawString(MX, cy, name)
    cy -= 13
    c.setFont(_f("Lora-Italic", FF), 9)
    c.setFillColor(C.ACCENT_DARK)
    c.drawString(MX, cy, title)
    c.setStrokeColor(C.ACCENT)
    c.setLineWidth(1.5)
    c.line(MX, cy - 8, MX + 80, cy - 8)

    _draw_rect(c, 0, 0, W, 28, fill=C.SIDEBAR_BG2)
    
    footer_items = []
    for key in ["email", "phone", "linkedin", "github", "portfolio"]:
        val = letter_data.get(key)
        if val:
            label, url = _parse_link(val)
            footer_items.append((label, url))
            
    c.setFont(_f("Poppins", FF), 6.5)
    c.setFillColor(C.SIDEBAR_MUTED)
    
    # Calculate footer total width
    sep = "  ·  "
    total_w = 0
    for i, (label, url) in enumerate(footer_items):
        total_w += c.stringWidth(label, _f("Poppins", FF), 6.5)
        if i < len(footer_items) - 1:
            total_w += c.stringWidth(sep, _f("Poppins", FF), 6.5)
            
    current_x = W / 2 - total_w / 2
    for i, (label, url) in enumerate(footer_items):
        if url:
            _draw_link(c, current_x, 10, label, url, "Poppins", 6.5, C.SIDEBAR_MUTED)
        else:
            c.drawString(current_x, 10, label)
        current_x += c.stringWidth(label, _f("Poppins", FF), 6.5)
        if i < len(footer_items) - 1:
            c.drawString(current_x, 10, sep)
            current_x += c.stringWidth(sep, _f("Poppins", FF), 6.5)

    c.save()
    log.info(f"generate_cover_letter_pdf | done size={buf.tell()} bytes")
    return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  PHOTO HELPER — Draw profile photos in PDFs
# ══════════════════════════════════════════════════════════════════

def _draw_photo(c, photo_base64, x, y, size, shape='circle', border_color=None, border_width=2):
    """Draw profile photo from base64 string."""
    if not photo_base64: return
    try:
        import base64
        from reportlab.lib.utils import ImageReader
        img_data = base64.b64decode(photo_base64)
        img_reader = ImageReader(io.BytesIO(img_data))
        if border_color is None: border_color = HexColor("#E0E0E0")
        if shape == 'circle':
            c.saveState()
            p = c.beginPath()
            p.circle(x + size/2, y + size/2, size/2)
            c.clipPath(p, stroke=0, fill=0)
            c.drawImage(img_reader, x, y, width=size, height=size, preserveAspectRatio=True, mask='auto')
            c.restoreState()
            c.setStrokeColor(border_color)
            c.setLineWidth(border_width)
            c.circle(x + size/2, y + size/2, size/2, stroke=1, fill=0)
        else:
            c.drawImage(img_reader, x, y, width=size, height=size, preserveAspectRatio=True, mask='auto')
            c.setStrokeColor(border_color)
            c.setLineWidth(border_width)
            c.rect(x, y, size, size, stroke=1, fill=0)
    except Exception as e:
        log.error(f"[_draw_photo] Error: {e}")


# ══════════════════════════════════════════════════════════════════
#  10 NEW PHOTO-ENABLED THEMES
# ══════════════════════════════════════════════════════════════════

class _ExecutivePortrait:
    """Photo ronde en header, layout premium corporate"""
    BG = HexColor("#FFFFFF")
    HEADER_BG = HexColor("#1A2332")
    ACCENT = HexColor("#B8956A")
    ACCENT2 = HexColor("#D4C5A8")
    TEXT_DARK = HexColor("#1A1A1A")
    TEXT_MED = HexColor("#4A4A4A")
    TEXT_LIGHT = HexColor("#8A8A8A")
    DIVIDER = HexColor("#E8E8E8")
    PHOTO_BORDER = HexColor("#B8956A")
    
    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 50, W - 100
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        
        # Header with photo
        HEADER_H = 140 * _fscale
        _draw_rect(c, 0, H - HEADER_H, W, HEADER_H, fill=cls.HEADER_BG)
        
        # Photo (round, top-left)
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 90 * _fscale
        if photo:
            _draw_photo(c, photo, MX, H - HEADER_H + 25 * _fscale, PHOTO_SIZE, 'circle', 
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT), border_width=3 * _fscale)
        
        # Name & Title (right of photo)
        name_x = MX + PHOTO_SIZE + 20 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 24)
        c.setFillColor(getattr(cls, 'NAME_COLOR', HexColor("#FFFFFF")))
        c.drawString(name_x, H - 50 * _fscale, cv_data.get("name", ""))
        
        c.setFont(_f("Poppins-Light", FF), 11)
        c.setFillColor(getattr(cls, 'TITLE_COLOR', cls.ACCENT2))
        c.drawString(name_x, H - 70 * _fscale, cv_data.get("title", ""))
        
        # Contact (below name)
        _draw_wrapped_contact(c, cv_data, name_x, H - 95 * _fscale, W - name_x - 50, "Poppins", 7, getattr(cls, 'CONTACT_COLOR', HexColor("#CCCCCC")), force_family=FF)
        
        # Content
        my = H - HEADER_H - 30 * _fscale
        
        def section_title(t, y):
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.setLineWidth(2)
            c.line(MX, y - 4 * _fscale, MX + 60 * _fscale, y - 4 * _fscale)
            return y - 20 * _fscale
        
        if cv_data.get("summary"):
            my = section_title(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Lora-Italic", 9, cls.TEXT_MED, MW, 13, force_family=FF) - 18 * _fscale
        
        # Experience (standard layout)
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 120: break
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: break
                    bullet_y = my
                    c.setFillColor(cls.ACCENT)
                    c.circle(MX + 3, bullet_y + 2.5 * _fscale, 2 * _fscale, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8, cls.TEXT_MED, MW - 14, 11, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
        
        # Education
        if cv_data.get("education") and my > 100:
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 80: break
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 14 * _fscale
        
        # Languages
        if cv_data.get("languages") and my > 80:
            my = section_title(L["languages"], my)
            for li in cv_data["languages"]:
                if my < 60: break
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, li.get("lang", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawString(MX + 80, my, li.get("level", ""))
                my -= 12 * _fscale
        
        c.save()
        return buf.getvalue()


class _ModernProfile:
    """Grande photo sidebar gauche, style tech moderne"""
    BG = HexColor("#F8F9FA")
    SIDEBAR_BG = HexColor("#2C3E50")
    ACCENT = HexColor("#3498DB")
    ACCENT2 = HexColor("#E74C3C")
    TEXT_DARK = HexColor("#2C3E50")
    TEXT_MED = HexColor("#7F8C8D")
    TEXT_LIGHT = HexColor("#BDC3C7")
    PHOTO_BORDER = HexColor("#3498DB")
    
    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        SIDEBAR_W = 200
        MAIN_X = SIDEBAR_W + 25
        MAIN_W = W - MAIN_X - 20
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        _draw_rect(c, 0, 0, SIDEBAR_W, H, fill=cls.SIDEBAR_BG)
        
        # Large photo at top of sidebar
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 160 * _fscale
        if photo:
            _draw_photo(c, photo, (SIDEBAR_W - PHOTO_SIZE) / 2, H - PHOTO_SIZE - 30 * _fscale, PHOTO_SIZE, 'square',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT), border_width=3 * _fscale)
        
        # Name in sidebar
        sy = H - PHOTO_SIZE - 60 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 16)
        c.setFillColor(getattr(cls, 'NAME_COLOR', HexColor("#FFFFFF")))
        name_lines = cv_data.get("name", "").split()
        for line in name_lines:
            c.drawCentredString(SIDEBAR_W / 2, sy, line)
            sy -= 20 * _fscale
        
        c.setFont(_f("Poppins-Light", FF), 9)
        c.setFillColor(getattr(cls, 'TITLE_COLOR', cls.ACCENT))
        c.drawCentredString(SIDEBAR_W / 2, sy, cv_data.get("title", ""))
        sy -= 25 * _fscale
        
        # ADDED: Vertical Contact Info in Sidebar
        sy = _draw_vertical_contact(c, cv_data, 20, sy, "Poppins", 7, getattr(cls, 'CONTACT_COLOR', HexColor("#BDC3C7")), spacing=10, force_family=FF)
        sy -= 15 * _fscale
        
        # Sidebar content (skills, languages)
        def sidebar_section(title, y):
            c.setFont(_f("Poppins-Bold", FF), 7)
            c.setFillColor(cls.ACCENT)
            c.drawString(25, y, title.upper())
            c.setStrokeColor(cls.ACCENT)
            c.setLineWidth(1.5)
            c.line(25, y - 4 * _fscale, SIDEBAR_W - 25, y - 4 * _fscale)
            return y - 18 * _fscale

        if cv_data.get("skills", {}).get("categories"):
            sy = sidebar_section(L["skills"], sy)
            for cat in cv_data["skills"]["categories"]:
                if sy < 100: break
                c.setFont(_f("Poppins-Bold", FF), 7.5)
                c.setFillColor(cls.ACCENT)
                c.drawString(25, sy, cat.get("name", "").upper())
                sy -= 10 * _fscale
                for skill in cat.get("items", []):
                    if sy < 80: break
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(cls.TEXT_LIGHT)
                    c.drawString(25, sy, "• " + skill)
                    sy -= 9 * _fscale
                sy -= 8 * _fscale

        if cv_data.get("languages"):
            sy = sidebar_section(L["languages"], sy)
            for li in cv_data["languages"]:
                if sy < 70: break
                c.setFont(_f("Poppins-Medium", FF), 7.5)
                c.setFillColor(cls.ACCENT)
                c.drawString(25, sy, li.get("lang", ""))
                c.setFont(_f("Poppins", FF), 6)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawString(25, sy - 8 * _fscale, li.get("level", ""))
                sy -= 18 * _fscale

        # Main content
        my = H - 40 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 26)
        c.setFillColor(getattr(cls, 'NAME_COLOR', cls.TEXT_DARK))
        c.drawString(MAIN_X, my, cv_data.get("name", ""))
        my -= 30 * _fscale
        
        if cv_data.get("summary"):
            my = _draw_multiline(c, cv_data["summary"], MAIN_X, my, "Poppins", 9, cls.TEXT_MED, MAIN_W, 13, force_family=FF) - 20 * _fscale
        
        # Experience
        if cv_data.get("experiences"):
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.drawString(MAIN_X, my, L["experience"].upper())
            my -= 18 * _fscale
            for exp in cv_data["experiences"]:
                if my < 120: break
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MAIN_X, my, exp.get("role", ""))
                my -= 11 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT2))
                exp_line = exp.get("company", "")
                if exp.get("location"): exp_line += "  •  " + exp["location"]
                exp_line += "  •  " + exp.get("period", "")
                c.drawString(MAIN_X, my, exp_line)
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: break
                    bullet_y = my
                    # Draw bullet separately from text for proper alignment/visibility
                    c.setFont(_f("Poppins-Bold", FF), 9)
                    c.setFillColor(getattr(cls, 'ACCENT', cls.ACCENT))
                    c.drawString(MAIN_X + 2, bullet_y + 0.5 * _fscale, "•")
                    # Draw text with indentation
                    my = _draw_multiline(c, bullet, MAIN_X + 14, bullet_y, "Poppins", 8, cls.TEXT_MED, MAIN_W - 14, 11, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
        
        # Education
        if cv_data.get("education") and my > 100:
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.drawString(MAIN_X, my, L["education"].upper())
            my -= 16 * _fscale
            for edu in cv_data["education"]:
                if my < 80: break
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MAIN_X, my, edu.get("degree", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(cls.ACCENT2)
                c.drawString(MAIN_X, my, edu.get("school", "") + " • " + edu.get("year", ""))
                my -= 14 * _fscale

        my -= 10 * _fscale
        
        c.save()
        return buf.getvalue()


class _CreativeVision:
    """Photo artistique avec overlay coloré, créatif"""
    BG = HexColor("#FAFAFA")
    ACCENT = HexColor("#FF6B9D")
    ACCENT2 = HexColor("#C44569")
    ACCENT3 = HexColor("#FFA07A")
    TEXT_DARK = HexColor("#2C2C2C")
    TEXT_MED = HexColor("#666666")
    TEXT_LIGHT = HexColor("#999999")
    PHOTO_BORDER = HexColor("#FFA07A")
    
    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 45, W - 90
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        
        # Diagonal accent bar
        c.setFillColor(cls.ACCENT)
        p = c.beginPath()
        p.moveTo(0, H)
        p.lineTo(W, H)
        p.lineTo(W, H - 120)
        p.lineTo(0, H - 80)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        
        # Photo with creative positioning (top-left, overlapping accent)
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 100
        if photo:
            _draw_photo(c, photo, MX, H - PHOTO_SIZE - 20, PHOTO_SIZE, 'circle',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT3), border_width=3)
            # Add colored ring around photo
            c.setStrokeColor(getattr(cls, 'PHOTO_BORDER', cls.ACCENT3))
            c.setLineWidth(3)
            c.circle(MX + PHOTO_SIZE/2, H - PHOTO_SIZE/2 - 20, PHOTO_SIZE/2 + 5, stroke=1, fill=0)
        
        # Name & Title (right of photo)
        name_x = MX + PHOTO_SIZE + 25
        c.setFont(_f("Poppins-Bold", FF), 26)
        c.setFillColor(getattr(cls, 'NAME_COLOR', HexColor("#FFFFFF")))
        c.drawString(name_x, H - 45, cv_data.get("name", ""))
        
        c.setFont(_f("Poppins-Light", FF), 12)
        c.setFillColor(getattr(cls, 'TITLE_COLOR', HexColor("#FFFFFF")))
        c.drawString(name_x, H - 65, cv_data.get("title", ""))
        
        # Contact
        _draw_wrapped_contact(c, cv_data, name_x, H - 90, W - name_x - 45, "Poppins", 7, getattr(cls, 'CONTACT_COLOR', HexColor("#FFFFFF")))
        
        # Content
        my = H - 150
        
        def creative_section(title, y):
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
            c.drawString(MX, y, title)
            c.setStrokeColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.setLineWidth(3)
            c.line(MX, y - 5, MX + 80, y - 5)
            return y - 20
        
        if cv_data.get("summary"):
            my = creative_section("À PROPOS", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, cls.TEXT_MED, MW, 13, force_family=FF) - 18
        
        # Experience with creative bullets
        if cv_data.get("experiences"):
            my = creative_section("EXPÉRIENCE", my)
            for exp in cv_data["experiences"]:
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                my -= 11
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, my, exp.get("company", "") + " | " + exp.get("period", ""))
                my -= 12
                for bullet in exp.get("bullets", []):
                    bullet_y = my
                    c.setFillColor(cls.ACCENT3)
                    c.rect(MX, bullet_y + 1.5 * _fscale, 4, 4, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 10, bullet_y, "Poppins", 8, cls.TEXT_MED, MW - 12, 11, force_family=FF) - 2
                my -= 10
        
        # Education
        if cv_data.get("education") and my > 100:
            my = creative_section("ÉDUCATION", my)
            for edu in cv_data["education"]:
                if my < 80: break
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                my -= 10
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(cls.ACCENT)
                c.drawString(MX, my, edu.get("school", "") + " | " + edu.get("year", ""))
                my -= 14
        
        # Languages
        if cv_data.get("languages") and my > 80:
            my = creative_section("LANGUES", my)
            for li in cv_data["languages"]:
                if my < 60: break
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(MX, my, li.get("lang", "") + " — " + li.get("level", ""))
                my -= 12
        
        c.save()
        return buf.getvalue()


class _FinanceExecutive(_ExecutivePortrait):
    """Photo formelle, couleurs sobres finance"""
    HEADER_BG = HexColor("#0A1929")
    ACCENT = HexColor("#A78B50")
    ACCENT2 = HexColor("#C4B998")
    PHOTO_BORDER = HexColor("#A78B50")


class _TechLeader(_ModernProfile):
    """Photo moderne, accents tech"""
    SIDEBAR_BG = HexColor("#0D1117")
    ACCENT = HexColor("#58A6FF")
    ACCENT2 = HexColor("#3FB950")
    PHOTO_BORDER = HexColor("#58A6FF")


class _StartupFounder(_CreativeVision):
    """Photo dynamique, layout innovant"""
    ACCENT = HexColor("#8B5CF6")
    ACCENT2 = HexColor("#EC4899")
    ACCENT3 = HexColor("#06B6D4")
    PHOTO_BORDER = HexColor("#06B6D4")


class _ConsultantPremium:
    """Layout 3 colonnes avec photo centrale, ultra-premium"""
    BG = HexColor("#FDFCFA")
    ACCENT = HexColor("#2C5F7C")
    ACCENT2 = HexColor("#8B7355")
    TEXT_DARK = HexColor("#1A1A1A")
    TEXT_MED = HexColor("#4A4A4A")
    TEXT_LIGHT = HexColor("#8A8A8A")
    DIVIDER = HexColor("#E8E4DF")
    PHOTO_BORDER = HexColor("#8B7355")
    
    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        
        # Top border
        _draw_rect(c, 0, H - 2, W, 2, fill=cls.ACCENT)
        
        # Photo centrée en haut
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 85 * _fscale
        photo_x = (W - PHOTO_SIZE) / 2
        if photo:
            _draw_photo(c, photo, photo_x, H - 30 * _fscale - PHOTO_SIZE, PHOTO_SIZE, 'circle',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT2), border_width=3 * _fscale)
        
        # Name centré BIEN EN DESSOUS de la photo (grand espacement)
        my = H - 30 * _fscale - PHOTO_SIZE - 25 * _fscale
        c.setFont(_f("Lora"), 24)
        c.setFillColor(getattr(cls, 'NAME_COLOR', cls.TEXT_DARK))
        c.drawCentredString(W / 2, my, cv_data.get("name", ""))
        my -= 22 * _fscale
        
        c.setFont(_f("Poppins-Light", FF), 10)
        c.setFillColor(getattr(cls, 'TITLE_COLOR', cls.ACCENT))
        c.drawCentredString(W / 2, my, cv_data.get("title", ""))
        my -= 24 * _fscale
        
        # Contact centré
        my = _draw_wrapped_centred_contact(c, cv_data, W/2, my, W - 100, "Poppins", 7, getattr(cls, 'CONTACT_COLOR', cls.TEXT_LIGHT), "  |  ", force_family=FF)
        my -= 25 * _fscale
        
        # Ligne séparatrice
        c.setStrokeColor(cls.DIVIDER)
        c.setLineWidth(0.5)
        c.line(50, my, W - 50, my)
        my -= 20 * _fscale
        
        # Layout 3 colonnes
        COL_W = (W - 120) / 3
        COL1_X = 40
        COL2_X = COL1_X + COL_W + 20
        COL3_X = COL2_X + COL_W + 20
        
        col1_y = my
        col2_y = my
        col3_y = my
        
        def col_title(x, y, t):
            c.setFont(_f("Poppins-Bold", FF), 7)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.drawString(x, y, t.upper())
            c.setStrokeColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
            c.setLineWidth(1.5)
            c.line(x, y - 3 * _fscale, x + COL_W, y - 3 * _fscale)
            return y - 15 * _fscale
        
        # COL1: Summary
        if cv_data.get("summary"):
            col1_y = col_title(COL1_X, col1_y, "Profil")
            col1_y = _draw_multiline(c, cv_data["summary"], COL1_X, col1_y, "Poppins", 7.5, cls.TEXT_MED, COL_W, 10, force_family=FF) - 15 * _fscale
        
        # COL1: Skills
        if cv_data.get("skills", {}).get("categories"):
            col1_y = col_title(COL1_X, col1_y, "Expertise")
            for cat in cv_data["skills"]["categories"]:
                if col1_y < 80: break
                c.setFont(_f("Poppins-Bold", FF), 7)
                c.setFillColor(cls.ACCENT2)
                c.drawString(COL1_X, col1_y, cat.get("name", ""))
                col1_y -= 9 * _fscale
                for skill in cat.get("items", []):
                    if col1_y < 70: break
                    c.setFont(_f("Poppins", FF), 6.5)
                    c.setFillColor(cls.TEXT_MED)
                    c.drawString(COL1_X + 5, col1_y, "• " + skill)
                    col1_y -= 8 * _fscale
                col1_y -= 5 * _fscale
        
        # COL2 & COL3: Experience (split across columns)
        if cv_data.get("experiences"):
            col2_y = col_title(COL2_X, col2_y, "Expérience")
            for i, exp in enumerate(cv_data["experiences"]):
                # Alternate between col2 and col3
                if i % 2 == 0:
                    cx, cy = COL2_X, col2_y
                else:
                    cx, cy = COL3_X, col3_y
                
                if cy < 100: break
                
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(cx, cy, exp.get("role", "")[:25])
                cy -= 10 * _fscale
                c.setFont(_f("Poppins", FF), 6.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(cx, cy, exp.get("company", "")[:25])
                cy -= 8 * _fscale
                c.setFont(_f("Poppins", FF), 6)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawString(cx, cy, exp.get("period", ""))
                cy -= 12 * _fscale
                
                if i % 2 == 0:
                    col2_y = cy
                else:
                    col3_y = cy
        
        # COL1: Languages + Education (if space)
        if cv_data.get("languages") and col1_y > 120:
            col1_y = col_title(COL1_X, col1_y, "Langues")
            for li in cv_data["languages"]:
                if col1_y < 70: break
                c.setFont(_f("Poppins-Medium", FF), 7)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(COL1_X, col1_y, li.get("lang", "") + " - " + li.get("level", ""))
                col1_y -= 10 * _fscale
        
        if cv_data.get("education") and col1_y > 100:
            col1_y = col_title(COL1_X, col1_y, "Formation")
            for edu in cv_data["education"]:
                if col1_y < 60: break
                c.setFont(_f("Poppins-Bold", FF), 7)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(COL1_X, col1_y, edu.get("degree", "")[:20])
                col1_y -= 8 * _fscale
                c.setFont(_f("Poppins", FF), 6)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawString(COL1_X, col1_y, edu.get("school", "")[:20])
                col1_y -= 12 * _fscale
        
        c.save()
        return buf.getvalue()


class _CorporateElite:
    """Layout asymétrique avec photo dans header coloré"""
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
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 50, W - 100
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        
        # Header avec fond personnalisé
        HEADER_H = 110 * _fscale
        _draw_rect(c, 0, H - HEADER_H, W, HEADER_H, fill=getattr(cls, 'HEADER_BG', HexColor("#F8F9FA")))
        
        # Photo ronde DANS le header (gauche)
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 75 * _fscale
        if photo:
            _draw_photo(c, photo, MX, H - HEADER_H + 18 * _fscale, PHOTO_SIZE, 'circle',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT2), border_width=3 * _fscale)
        
        # Name & Title à droite de la photo
        name_x = MX + PHOTO_SIZE + 20 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 20)
        c.setFillColor(getattr(cls, 'NAME_COLOR', cls.TEXT_DARK))
        c.drawString(name_x, H - 40 * _fscale, cv_data.get("name", ""))
        
        c.setFont(_f("Poppins-Light", FF), 10)
        c.setFillColor(getattr(cls, 'TITLE_COLOR', cls.ACCENT))
        c.drawString(name_x, H - 58 * _fscale, cv_data.get("title", ""))
        
        _draw_wrapped_contact(c, cv_data, name_x, H - 80 * _fscale, W - name_x - 50, "Poppins", 7, getattr(cls, 'CONTACT_COLOR', cls.TEXT_LIGHT), " | ")
        
        my = H - HEADER_H - 25 * _fscale
        
        def section_title(t, y):
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
            c.setLineWidth(2)
            c.line(MX, y - 4 * _fscale, MX + 60 * _fscale, y - 4 * _fscale)
            return y - 18 * _fscale
        
        if cv_data.get("summary"):
            my = section_title("À Propos", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, cls.TEXT_MED, MW, 13, force_family=FF) - 18 * _fscale
        
        if cv_data.get("experiences"):
            my = section_title("Expérience", my)
            for exp in cv_data["experiences"]:
                if my < 120: break
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: break
                    bullet_y = my
                    c.setFillColor(cls.ACCENT2)
                    c.circle(MX + 3, bullet_y + 2.5 * _fscale, 2 * _fscale, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8, cls.TEXT_MED, MW - 14, 11, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
        
        # Education
        if cv_data.get("education") and my > 100:
            my = section_title("Éducation", my)
            for edu in cv_data["education"]:
                if my < 80: break
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 14 * _fscale
        
        # Languages
        if cv_data.get("languages") and my > 80:
            my = section_title("Langues", my)
            for li in cv_data["languages"]:
                if my < 60: break
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, li.get("lang", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawString(MX + 80, my, li.get("level", ""))
                my -= 12 * _fscale
        
        c.save()
        return buf.getvalue()


class _MinimalistPro:
    """Design ultra-minimaliste avec photo petite en haut à gauche"""
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
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        MX, MW = 60, W - 120
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        
        # Header CENTRÉ (comme demandé par la description de l'UI)
        name = cv_data.get("name", "")
        my = H - 40 * _fscale
        
        # Nom centré
        c.setFont(_f("Poppins-Bold", FF), 28)
        c.setFillColor(getattr(cls, 'NAME_COLOR', cls.TEXT_DARK))
        c.drawCentredString(W / 2, my, name)
        my -= 32 * _fscale
        
        # Titre centré
        c.setFont(_f("Poppins-Light", FF), 11)
        c.setFillColor(getattr(cls, 'TITLE_COLOR', cls.ACCENT))
        c.drawCentredString(W / 2, my, cv_data.get("title", ""))
        my -= 4 * _fscale
        
        # Petite photo centrée si présente
        photo = cv_data.get("profile_photo")
        if photo:
            PHOTO_SIZE = 55 * _fscale
            _draw_photo(c, photo, (W - PHOTO_SIZE) / 2, my - PHOTO_SIZE - 10 * _fscale, PHOTO_SIZE, 'circle',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT), border_width=1.5 * _fscale)
            my -= (PHOTO_SIZE + 25 * _fscale)
        else:
            my -= 10 * _fscale

        # Diviseur ornemental (Red Dot Divider comme sur le screenshot)
        c.setStrokeColor(cls.DIVIDER)
        c.setLineWidth(0.5 * _fscale)
        c.line(W / 2 - 40 * _fscale, my, W / 2 - 10 * _fscale, my)
        c.line(W / 2 + 10 * _fscale, my, W / 2 + 40 * _fscale, my)
        c.setFillColor(cls.ACCENT) # Le point rouge (ou couleur d'accent)
        c.circle(W / 2, my, 2.5 * _fscale, fill=1, stroke=0)
        my -= 22 * _fscale

        # Contact centré - avec wrapping
        my = _draw_wrapped_centred_contact(c, cv_data, W / 2, my, MW, "Poppins", 7.5, getattr(cls, 'CONTACT_COLOR', cls.TEXT_LIGHT), "     ", force_family=FF)
        my -= 20 * _fscale
        
        # Ligne séparatrice fine footer header
        c.setStrokeColor(cls.DIVIDER)
        c.setLineWidth(0.5 * _fscale)
        c.line(MX, my, W - MX, my)
        my -= 25 * _fscale
        
        def section_title(t, y):
            c.setFont(_f("Poppins-Bold", FF), 7.5)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
            c.setLineWidth(0.3 * _fscale)
            c.line(MX, y - 3 * _fscale, W - MX, y - 3 * _fscale)
            return y - 14 * _fscale
        
        # Summary
        if cv_data.get("summary"):
            my = section_title("Profil", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, cls.TEXT_MED, MW, 13, force_family=FF) - 18 * _fscale
        
        # Experience
        if cv_data.get("experiences"):
            my = section_title("Expérience Professionnelle", my)
            for exp in cv_data["experiences"]:
                if my < 120: break
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 11 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100: break
                    bullet_y = my
                    my = _draw_multiline(c, "— " + bullet, MX, bullet_y, "Poppins", 8, cls.TEXT_MED, MW, 11, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
        
        # Education
        if cv_data.get("education") and my > 100:
            my = section_title("Formation", my)
            for edu in cv_data["education"]:
                if my < 80: break
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 14 * _fscale
        
        # Languages
        if cv_data.get("languages") and my > 80:
            my = section_title("Langues", my)
            for li in cv_data["languages"]:
                if my < 60: break
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MX, my, li.get("lang", "") + " — " + li.get("level", ""))
                my -= 12 * _fscale
        
        c.save()
        return buf.getvalue()


class _InternationalProfile:
    """Sidebar avec photo carrée et barres de progression"""
    BG = HexColor("#FFFFFF")
    SIDEBAR_BG = HexColor("#F5F5F5")
    ACCENT = HexColor("#D32F2F")
    ACCENT2 = HexColor("#1976D2")
    TEXT_DARK = HexColor("#212121")
    TEXT_MED = HexColor("#616161")
    TEXT_LIGHT = HexColor("#9E9E9E")
    PHOTO_BORDER = HexColor("#D32F2F")
    
    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        cls, _fscale = _apply_custom_style(cls, cv_data)
        L = _get_labels(getattr(cls, 'LANG', 'fr'))
        FF = getattr(cls, 'FONT_OVERRIDE', None)
        buf = io.BytesIO()
        W, H = A4
        SIDEBAR_W = 170
        MAIN_X = SIDEBAR_W + 30
        MAIN_W = W - MAIN_X - 25
        
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        
        _draw_rect(c, 0, 0, W, H, fill=cls.BG)
        _draw_rect(c, 0, 0, SIDEBAR_W, H, fill=cls.SIDEBAR_BG)
        _draw_rect(c, SIDEBAR_W - 5, 0, 5, H, fill=cls.ACCENT)
        
        # Photo carrée en haut sidebar
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 130 * _fscale
        if photo:
            _draw_photo(c, photo, (SIDEBAR_W - PHOTO_SIZE) / 2, H - PHOTO_SIZE - 35 * _fscale, PHOTO_SIZE, 'square',
                       border_color=getattr(cls, 'PHOTO_BORDER', cls.ACCENT), border_width=3 * _fscale)
        
        sy = H - PHOTO_SIZE - 55 * _fscale
        
        def sidebar_title(t, y):
            c.setFont(_f("Poppins-Bold", FF), 8)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.drawString(15, y, t.upper())
            c.setStrokeColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
            c.setLineWidth(2)
            c.line(15, y - 4 * _fscale, SIDEBAR_W - 15, y - 4 * _fscale)
            return y - 16 * _fscale
        
        if cv_data.get("skills", {}).get("categories"):
            sy = sidebar_title(L["skills"], sy)
            for cat in cv_data["skills"]["categories"]:
                if sy < 90: break
                for skill in cat.get("items", []):
                    if sy < 80: break
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(cls.TEXT_DARK)
                    c.drawString(15, sy, skill[:18])
                    bar_y = sy - 8 * _fscale
                    bar_w = SIDEBAR_W - 30
                    _draw_rect(c, 15, bar_y, bar_w, 4 * _fscale, fill=HexColor("#E0E0E0"))
                    _draw_rect(c, 15, bar_y, bar_w * 0.85, 4 * _fscale, fill=getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
                    sy -= 18 * _fscale
        
        if cv_data.get("languages"):
            sy -= 8 * _fscale
            sy = sidebar_title(L["languages"], sy)
            for li in cv_data["languages"]:
                if sy < 60: break
                c.setFont(_f("Poppins-Bold"), 7.5)
                c.setFillColor(cls.TEXT_DARK)
                c.drawString(15, sy, li.get("lang", ""))
                c.setFont(_f("Poppins", FF), 6.5)
                c.setFillColor(cls.TEXT_MED)
                c.drawString(15, sy - 9 * _fscale, li.get("level", ""))
                sy -= 22 * _fscale
        
        # Main content
        my = H - 45 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 28)
        c.setFillColor(getattr(cls, 'NAME_COLOR', cls.TEXT_DARK))
        c.drawString(MAIN_X, my, cv_data.get("name", ""))
        my -= 22 * _fscale
        
        c.setFont(_f("Poppins-Light", FF), 12)
        c.setFillColor(getattr(cls, 'TITLE_COLOR', cls.ACCENT))
        c.drawString(MAIN_X, my, cv_data.get("title", ""))
        my -= 18 * _fscale
        
        my = _draw_wrapped_contact(c, cv_data, MAIN_X, my, MAIN_W, "Poppins", 7.5, getattr(cls, 'CONTACT_COLOR', cls.TEXT_LIGHT), "  •  ", force_family=FF)
        my -= 22 * _fscale
        
        if cv_data.get("summary"):
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
            c.drawString(MAIN_X, my, L["summary"].upper())
            my -= 14 * _fscale
            my = _draw_multiline(c, cv_data["summary"], MAIN_X, my, "Poppins", 9, cls.TEXT_MED, MAIN_W, 13, force_family=FF) - 18 * _fscale
        
        if cv_data.get("experiences"):
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
            c.drawString(MAIN_X, my, L["experience"].upper())
            my -= 16 * _fscale
            
            for exp in cv_data["experiences"]:
                if my < 120: break
                c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT))
                c.circle(MAIN_X - 8, my + 4 * _fscale, 4 * _fscale, fill=1, stroke=0)
                
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MAIN_X, my, exp.get("role", ""))
                my -= 12 * _fscale
                
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MAIN_X, my, exp.get("company", "") + "  |  " + exp.get("period", ""))
                my -= 14 * _fscale
                
                for bullet in exp.get("bullets", []):
                    if my < 100: break
                    bullet_y = my
                    my = _draw_multiline(c, "→ " + bullet, MAIN_X, bullet_y, "Poppins", 8, cls.TEXT_MED, MAIN_W, 11, force_family=FF) - 3 * _fscale
                my -= 12 * _fscale
        
        # Education
        if cv_data.get("education") and my > 100:
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(cls, 'SECTION_TITLE_COLOR', cls.ACCENT2))
            c.drawString(MAIN_X, my, L["education"].upper())
            my -= 14 * _fscale
            for edu in cv_data["education"]:
                if my < 80: break
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.TEXT_DARK))
                c.drawString(MAIN_X, my, edu.get("degree", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium"), 8)
                c.setFillColor(getattr(cls, 'ROLE_COLOR', cls.ACCENT))
                c.drawString(MAIN_X, my, edu.get("school", "") + "  |  " + edu.get("year", ""))
                my -= 14 * _fscale
        
        c.save()
        return buf.getvalue()


# Update THEMES dictionary
THEMES.update({
    "Executive Portrait": _ExecutivePortrait,
    "Modern Profile": _ModernProfile,
    "Corporate Elite": _CorporateElite,
    "Creative Vision": _CreativeVision,
    "Minimalist Pro": _MinimalistPro,
    "Finance Executive": _FinanceExecutive,
    "Tech Leader": _TechLeader,
    "Startup Founder": _StartupFounder,
    "Consultant Premium": _ConsultantPremium,
    "International Profile": _InternationalProfile,
})


