#!/usr/bin/env python3
"""
CLI wrapper for photo_processor module
Called by Node.js API route
"""

import sys
import json
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.photo_processor import process_profile_photo, validate_photo

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: photo_processor_cli.py <input_file> <output_file> <target_size>"}))
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    target_size = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    
    try:
        # Read input file
        with open(input_file, 'rb') as f:
            image_bytes = f.read()
        
        # Validate
        is_valid, error_msg = validate_photo(image_bytes)
        if not is_valid:
            result = {"success": False, "error": error_msg}
            with open(output_file, 'w') as f:
                json.dump(result, f)
            sys.exit(0)
        
        # Process (shape removed - PDF engine handles it)
        photo_base64 = process_profile_photo(image_bytes, target_size=target_size)
        
        result = {
            "success": True,
            "photo_base64": photo_base64
        }
        
        with open(output_file, 'w') as f:
            json.dump(result, f)
        
        sys.exit(0)
        
    except Exception as e:
        result = {"success": False, "error": str(e)}
        with open(output_file, 'w') as f:
            json.dump(result, f)
        sys.exit(1)

if __name__ == "__main__":
    main()
