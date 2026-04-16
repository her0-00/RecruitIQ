FROM node:20-slim

# Install Python + system deps for ReportLab and Playwright Chromium
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    gcc libffi-dev \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Make python3 available as python
RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Copy Python requirements first (for caching)
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Install Playwright Chromium with deps
RUN python3 -m playwright install chromium

# Copy package files for Node (for caching)
COPY web/package*.json ./web/
WORKDIR /app/web
RUN npm ci

# Copy rest of the application
WORKDIR /app
COPY . .

# Build Next.js
WORKDIR /app/web
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]