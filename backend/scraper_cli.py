#!/usr/bin/env python3
"""Scraper complet avec sites universels + sites carrières entreprises"""
import sys
import json
import asyncio
from playwright.async_api import async_playwright
import urllib.parse

# Sites universels
async def scrape_wttj(keywords, location):
    jobs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            url = f"https://www.welcometothejungle.com/fr/jobs?query={urllib.parse.quote(keywords)}&aroundQuery={urllib.parse.quote(location)}"
            await page.goto(url, timeout=10000, wait_until='domcontentloaded')
            await page.wait_for_timeout(3000)
            
            cards = await page.query_selector_all('li[data-testid="search-results-list-item-wrapper"]')
            print(f"WTTJ found {len(cards)} cards", file=sys.stderr)
            
            for card in cards[:15]:
                try:
                    title_el = await card.query_selector('h2, h3, [class*="title"]')
                    company_el = await card.query_selector('[data-testid="company-name"], [class*="company"]')
                    location_el = await card.query_selector('[data-testid="job-location"], [class*="location"]')
                    link_el = await card.query_selector('a')
                    
                    if title_el:
                        title = await title_el.inner_text()
                        company = await company_el.inner_text() if company_el else 'N/A'
                        loc = await location_el.inner_text() if location_el else location
                        link = await link_el.get_attribute('href') if link_el else ''
                        if link and not link.startswith('http'):
                            link = f"https://www.welcometothejungle.com{link}"
                        
                        jobs.append({
                            'title': title.strip(),
                            'company': company.strip(),
                            'location': loc.strip(),
                            'link': link,
                            'source': 'WTTJ'
                        })
                except Exception as e:
                    print(f"WTTJ card error: {e}", file=sys.stderr)
                    continue
        except Exception as e:
            print(f"WTTJ error: {e}", file=sys.stderr)
        finally:
            await browser.close()
    return jobs

async def scrape_hellowork(keywords, location):
    jobs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            url = f"https://www.hellowork.com/fr-fr/emplois.html?k={urllib.parse.quote(keywords)}"
            await page.goto(url, timeout=10000, wait_until='domcontentloaded')
            await page.wait_for_timeout(3000)
            
            cards = await page.query_selector_all('article, div[class*="job"], li[class*="job"]')
            print(f"HelloWork found {len(cards)} cards", file=sys.stderr)
            
            for card in cards[:15]:
                try:
                    title_el = await card.query_selector('h2, h3, [class*="title"]')
                    company_el = await card.query_selector('[class*="company"], [class*="employer"]')
                    link_el = await card.query_selector('a')
                    
                    if title_el:
                        title = await title_el.inner_text()
                        company = await company_el.inner_text() if company_el else 'N/A'
                        link = await link_el.get_attribute('href') if link_el else ''
                        if link and not link.startswith('http'):
                            link = f"https://www.hellowork.com{link}"
                        
                        jobs.append({
                            'title': title.strip(),
                            'company': company.strip(),
                            'location': location,
                            'link': link,
                            'source': 'HelloWork'
                        })
                except Exception as e:
                    print(f"HelloWork card error: {e}", file=sys.stderr)
                    continue
        except Exception as e:
            print(f"HelloWork error: {e}", file=sys.stderr)
        finally:
            await browser.close()
    return jobs

# Sites carrières entreprises
async def scrape_company_site(url, company_name, keywords):
    jobs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, timeout=15000, wait_until='networkidle')
            await page.wait_for_timeout(2000)
            
            # Sélecteurs génériques pour sites carrières
            cards = await page.query_selector_all('div[class*="job"], article, li[class*="position"], div[class*="offer"]')
            
            for card in cards[:5]:  # Max 5 par entreprise
                try:
                    title_el = await card.query_selector('h2, h3, h4, a[class*="title"]')
                    link_el = await card.query_selector('a')
                    
                    if title_el:
                        title = await title_el.inner_text()
                        link = await link_el.get_attribute('href') if link_el else ''
                        
                        # Filtrer par keywords
                        if any(kw.lower() in title.lower() for kw in keywords.split()):
                            if link and not link.startswith('http'):
                                link = f"{url.split('/')[0]}//{url.split('/')[2]}{link}"
                            
                            jobs.append({
                                'title': title.strip(),
                                'company': company_name,
                                'location': 'France',
                                'link': link,
                                'source': company_name
                            })
                except:
                    continue
        except Exception as e:
            print(f"{company_name} error: {e}", file=sys.stderr)
        finally:
            await browser.close()
    return jobs

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Missing arguments'}))
        sys.exit(1)
    
    keywords = sys.argv[1]
    location = sys.argv[2]
    
    all_jobs = []
    
    # 1. Sites universels (parallèle)
    print("Scraping sites universels...", file=sys.stderr)
    universal_tasks = [
        scrape_wttj(keywords, location),
        scrape_hellowork(keywords, location)
    ]
    universal_results = await asyncio.gather(*universal_tasks, return_exceptions=True)
    
    for result in universal_results:
        if isinstance(result, list):
            all_jobs.extend(result)
    
    print(f"Total from universal sites: {len(all_jobs)}", file=sys.stderr)
    
    # Dédupliquer
    seen = set()
    unique_jobs = []
    for job in all_jobs:
        key = f"{job['title']}_{job['company']}"
        if key not in seen:
            seen.add(key)
            unique_jobs.append(job)
    
    print(json.dumps({'jobs': unique_jobs, 'total': len(unique_jobs)}))

if __name__ == '__main__':
    asyncio.run(main())
