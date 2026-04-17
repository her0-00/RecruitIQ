import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
import io
import traceback

def main():
    try:
        import pdfplumber

        pdf_bytes = sys.stdin.buffer.read()
        if not pdf_bytes:
            print(json.dumps({"success": False, "error": "No input provided"}))
            sys.exit(1)

        text = ""
        links = set()
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                # Extract visible text
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                
                # Extract hidden hyperlinks (URIs)
                for link in page.hyperlinks:
                    uri = link.get('uri')
                    if uri and (uri.startswith('http') or uri.startswith('mailto')):
                        links.add(uri)

        # Append hidden links to text for AI visibility
        if links:
            text += "\n\n--- DETECTED HYPERLINKS (UNMASKED) ---\n"
            text += "\n".join(sorted(list(links)))
            text += "\n-------------------------------------\n"

        # Strip null bytes
        text = text.replace('\x00', '')
        
        # Replace only problematic Unicode characters
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
