"""
RecruitIQ — Photo Profile Processor
Intelligent face detection, cropping, and optimization for CV photos
"""

import io
import base64
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import cv2
import numpy as np

def detect_face_center(image_bytes):
    """
    Detect face using OpenCV Haar Cascade and return center coordinates.
    Returns (center_x, center_y, face_width, face_height) or None if no face detected.
    """
    try:
        # Load Haar Cascade for face detection
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        if len(faces) == 0:
            return None
        
        # Use the largest face detected
        largest_face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = largest_face
        
        center_x = x + w // 2
        center_y = y + h // 2
        
        return (center_x, center_y, w, h)
    except Exception as e:
        print(f"[photo_processor] Face detection error: {e}")
        return None


def process_profile_photo(image_bytes, target_size=300, quality=95):
    """
    Process profile photo with intelligent face centering.
    Always returns square image - PDF engine handles shape rendering.
    
    Args:
        image_bytes: Raw image bytes
        target_size: Output size in pixels (width/height)
        quality: JPEG quality (1-100)
    
    Returns:
        base64 encoded image string
    """
    try:
        # Open image
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Detect face
        face_data = detect_face_center(image_bytes)
        
        if face_data:
            center_x, center_y, face_w, face_h = face_data
            
            # Calculate crop box with face centered
            # Add 40% padding around face for better framing
            crop_size = int(max(face_w, face_h) * 1.8)
            
            left = max(0, center_x - crop_size // 2)
            top = max(0, center_y - crop_size // 2)
            right = min(img.width, center_x + crop_size // 2)
            bottom = min(img.height, center_y + crop_size // 2)
            
            # Adjust if crop goes out of bounds
            if right - left < crop_size:
                if left == 0:
                    right = min(img.width, left + crop_size)
                else:
                    left = max(0, right - crop_size)
            
            if bottom - top < crop_size:
                if top == 0:
                    bottom = min(img.height, top + crop_size)
                else:
                    top = max(0, bottom - crop_size)
            
            img = img.crop((left, top, right, bottom))
        else:
            # No face detected - use center crop
            width, height = img.size
            crop_size = min(width, height)
            left = (width - crop_size) // 2
            top = (height - crop_size) // 2
            img = img.crop((left, top, left + crop_size, top + crop_size))
        
        # Resize to target size
        img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
        
        # Apply subtle sharpening
        img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=3))
        
        # Always keep square - PDF engine handles circle/square rendering via clipping
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return img_base64
    
    except Exception as e:
        print(f"[photo_processor] Processing error: {e}")
        raise


def validate_photo(image_bytes, max_size_mb=10):
    """
    Validate photo before processing.
    
    Returns:
        (is_valid, error_message)
    """
    try:
        # Check file size
        size_mb = len(image_bytes) / (1024 * 1024)
        if size_mb > max_size_mb:
            return (False, f"File too large: {size_mb:.1f}MB (max {max_size_mb}MB)")
        
        # Try to open image
        img = Image.open(io.BytesIO(image_bytes))
        
        # Check dimensions
        width, height = img.size
        if width < 150 or height < 150:
            return (False, f"Image too small: {width}x{height}px (min 150x150px)")
        
        # Check format
        if img.format not in ['JPEG', 'PNG', 'JPG', 'WEBP']:
            return (False, f"Unsupported format: {img.format} (use JPEG, PNG, or WEBP)")
        
        return (True, None)
    
    except Exception as e:
        return (False, f"Invalid image file: {str(e)}")
