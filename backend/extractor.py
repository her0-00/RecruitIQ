import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
import io
import traceback

def main():
    try:
        from pdfminer.high_level import extract_text

        pdf_bytes = sys.stdin.buffer.read()
        if not pdf_bytes:
            print(json.dumps({"success": False, "error": "No input provided"}))
            sys.exit(1)

        text = extract_text(io.BytesIO(pdf_bytes))
        # Strip null bytes left by unmapped glyph icons
        text = text.replace('\x00', '')
        
        # Replace only problematic Unicode characters (keep French accents)
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

        print(json.dumps({"success": True, "text": text}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    main()
