#!/bin/bash
set -e

echo "=== Installing Python dependencies ==="
pip install -r requirements.txt

echo "=== Installing Node dependencies ==="
cd web
npm ci

echo "=== Building Next.js ==="
npm run build

echo "=== Build complete ==="
