#!/usr/bin/env python3
"""Scraper universel intelligent qui s'adapte à n'importe quel site"""
import sys
import json
import asyncio
from playwright.async_api import async_playwright
import urllib.parse
import re

async def smart_scrape(url, keywords, location, source_name):
    """Scraper universel qui détecte automatiquement la structure"""
    jobs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, timeout=10000, wait_until='domcontentloaded')
            await page.wait_for_timeout(3000)
            
            # Stratégie 1: Chercher des conteneurs de jobs (patterns communs)
            container_selectors = [
                'li[data-testid*="job"], li[data-testid*="search"]',
                'article', 'div[class*="job-card"]', 'div[class*="jobCard"]',
                'div[class*="offer"]', 'div[class*="position"]',
                'li[class*="job"]', 'li[class*="result"]',
                'div[role="listitem"]', 'div[itemtype*="JobPosting"]'
            ]
            
            cards = []
            for selector in container_selectors:
                cards = await page.query_selector_all(selector)
                if len(cards) > 3:  # Si on trouve au moins 3 éléments, c'est probablement bon
                    print(f"{source_name}: Found {len(cards)} cards with selector '{selector}'", file=sys.stderr)
                    break
            
            if not cards:
                print(f"{source_name}: No job cards found", file=sys.stderr)
                return []
            
            # Stratégie 2: Extraire intelligemment les infos de chaque card
            for idx, card in enumerate(cards[:20]):
                try:
                    # Debug: afficher le HTML de la première card
                    if idx == 0:
                        html = await card.inner_html()
                        print(f"{source_name} FIRST CARD HTML (truncated): {html[:500]}", file=sys.stderr)
                    
                    # Titre: chercher h1-h4, ou class*="title"
                    title = None
                    for sel in ['h2', 'h3', 'h4', 'h1', '[class*="title"]', '[class*="Title"]', 'a[class*="job"]', 'a']:
                        el = await card.query_selector(sel)
                        if el:
                            text = await el.inner_text()
                            if text and len(text.strip()) > 5 and len(text.strip()) < 200:
                                title = text
                                if idx == 0:
                                    print(f"{source_name} Found title with '{sel}': {title[:50]}", file=sys.stderr)
                                break
                    
                    if not title:
                        if idx == 0:
                            print(f"{source_name} No title found in first card", file=sys.stderr)
                        continue
                    
                    # Entreprise: chercher class*="company" ou patterns
                    company = None
                    for sel in ['[class*="company"]', '[class*="Company"]', '[class*="employer"]', '[data-testid*="company"]', 'span', 'div']:
                        el = await card.query_selector(sel)
                        if el:
                            text = await el.inner_text()
                            if text and len(text.strip()) > 1 and len(text.strip()) < 100 and text.strip() != title.strip():
                                company = text
                                if idx == 0:
                                    print(f"{source_name} Found company with '{sel}': {company[:50]}", file=sys.stderr)
                                break
                    
                    # Location: chercher class*="location" ou icône 📍
                    loc = location
                    for sel in ['[class*="location"]', '[class*="Location"]', '[data-testid*="location"]', 'span']:
                        el = await card.query_selector(sel)
                        if el:
                            text = await el.inner_text()
                            if text and len(text.strip()) > 1 and len(text.strip()) < 100:
                                loc = text
                                if idx == 0:
                                    print(f"{source_name} Found location with '{sel}': {loc[:50]}", file=sys.stderr)
                                break
                    
                    # Link: premier <a> dans la card
                    link = ''
                    link_el = await card.query_selector('a')
                    if link_el:
                        link = await link_el.get_attribute('href')
                        if link and not link.startswith('http'):
                            base = f"{url.split('/')[0]}//{url.split('/')[2]}"
                            link = f"{base}{link}"
                    
                    jobs.append({
                        'title': title.strip(),
                        'company': company.strip() if company else 'N/A',
                        'location': loc.strip(),
                        'link': link,
                        'source': source_name
                    })
                    
                    if idx == 0:
                        print(f"{source_name} FIRST JOB EXTRACTED: {title[:50]} @ {company if company else 'N/A'}", file=sys.stderr)
                    
                except Exception as e:
                    print(f"{source_name} card error: {e}", file=sys.stderr)
                    continue
                    
        except Exception as e:
            print(f"{source_name} error: {e}", file=sys.stderr)
        finally:
            await browser.close()
    
    return jobs

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Missing arguments'}))
        sys.exit(1)
    
    keywords = sys.argv[1]
    location = sys.argv[2]
    
    # Liste de sites à scraper (universels + entreprises)
    sites = [
        {
            'name': 'WTTJ',
            'url': f"https://www.welcometothejungle.com/fr/jobs?query={urllib.parse.quote(keywords)}&aroundQuery={urllib.parse.quote(location)}"
        },
        {
            'name': 'HelloWork',
            'url': f"https://www.hellowork.com/fr-fr/emplois.html?k={urllib.parse.quote(keywords)}"
        },
        {
            'name': 'Indeed',
            'url': f"https://fr.indeed.com/jobs?q={urllib.parse.quote(keywords)}&l={urllib.parse.quote(location)}"
        },
        {
            'name': 'LinkedIn',
            'url': f"https://www.linkedin.com/jobs/search/?keywords={urllib.parse.quote(keywords)}&location={urllib.parse.quote(location)}"
        },
        {
            'name': 'Bouygues',
            'url': 'https://joining.bouygues.com/global/fr/search-results'
        },
        {
            'name': 'Alstom',
            'url': 'https://jobsearch.alstom.com/search/'
        },
        {
            'name': 'Schneider',
            'url': 'https://careers.se.com/jobs'
        }
    ]
    
    all_jobs = []
    
    # Scraper tous les sites en parallèle
    print(f"Scraping {len(sites)} sites...", file=sys.stderr)
    tasks = [smart_scrape(site['url'], keywords, location, site['name']) for site in sites]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for result in results:
        if isinstance(result, list):
            all_jobs.extend(result)
    
    # Dédupliquer
    seen = set()
    unique_jobs = []
    for job in all_jobs:
        key = f"{job['title'].lower()}_{job['company'].lower()}"
        if key not in seen and len(job['title']) > 5:
            seen.add(key)
            unique_jobs.append(job)
    
    print(f"Total unique jobs: {len(unique_jobs)}", file=sys.stderr)
    print(json.dumps({'jobs': unique_jobs, 'total': len(unique_jobs)}))

if __name__ == '__main__':
    asyncio.run(main())
