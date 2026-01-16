#!/usr/bin/env python3
"""
LinkedIn Job Scraper Execution Script

This script uses the Apify LinkedIn Jobs Scraper actor to fetch job listings
for specified job titles, then saves them to Supabase.

Environment Variables Required:
- APIFY_API_TOKEN: Your Apify API token
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for admin access)

Usage:
  python scrape_linkedin.py "Software Engineer" "Product Manager"
"""

import os
import sys
import time
import json
import requests
from datetime import datetime

# Load environment variables from .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

APIFY_API_TOKEN = os.getenv('APIFY_API_TOKEN')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

LINKEDIN_ACTOR_ID = 'bebity/linkedin-jobs-scraper'


def run_apify_actor(job_titles: list[str], limit_per_title: int = 25) -> list[dict]:
    """Run the Apify LinkedIn actor and return the results."""
    if not APIFY_API_TOKEN:
        raise ValueError("APIFY_API_TOKEN environment variable is not set")
    
    results = []
    
    for title in job_titles:
        print(f"Scraping LinkedIn jobs for: {title}")
        
        # Start the actor run
        run_url = f"https://api.apify.com/v2/acts/{LINKEDIN_ACTOR_ID}/runs?token={APIFY_API_TOKEN}"
        
        payload = {
            "searchQueries": [title],
            "limit": limit_per_title,
            "location": "United States",
            "publishedAt": "past24Hours",  # Only recent jobs
        }
        
        response = requests.post(run_url, json=payload)
        response.raise_for_status()
        
        run_data = response.json()
        run_id = run_data['data']['id']
        
        # Poll for completion
        status_url = f"https://api.apify.com/v2/actor-runs/{run_id}?token={APIFY_API_TOKEN}"
        status = run_data['data']['status']
        
        max_wait = 300  # 5 minutes
        waited = 0
        
        while status in ['RUNNING', 'READY'] and waited < max_wait:
            time.sleep(5)
            waited += 5
            
            status_response = requests.get(status_url)
            status_data = status_response.json()
            status = status_data['data']['status']
            print(f"  Status: {status} ({waited}s)")
        
        if status != 'SUCCEEDED':
            print(f"  Warning: Run ended with status {status}")
            continue
        
        # Get dataset items
        dataset_url = f"https://api.apify.com/v2/actor-runs/{run_id}/dataset/items?token={APIFY_API_TOKEN}"
        dataset_response = requests.get(dataset_url)
        jobs = dataset_response.json()
        
        # Add search_title to each job
        for job in jobs:
            job['search_title'] = title
        
        results.extend(jobs)
        print(f"  Found {len(jobs)} jobs")
    
    return results


def save_to_supabase(jobs: list[dict]) -> int:
    """Save jobs to Supabase, upserting to avoid duplicates."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase environment variables not set")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    
    saved_count = 0
    
    for job in jobs:
        # Transform to our database schema
        db_job = {
            "external_id": f"linkedin_{job.get('jobId', job.get('id', ''))}",
            "source": "linkedin",
            "title": job.get('title', ''),
            "company": job.get('company', ''),
            "location": job.get('location', ''),
            "description": (job.get('description', '') or '')[:5000],
            "url": job.get('jobUrl', job.get('url', '')),
            "salary": job.get('salary'),
            "search_title": job.get('search_title', ''),
        }
        
        # Upsert to database
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/jobs",
            headers=headers,
            json=db_job
        )
        
        if response.status_code in [200, 201]:
            saved_count += 1
        elif response.status_code == 409:
            # Duplicate - this is expected
            pass
        else:
            print(f"  Warning: Failed to save job {db_job['external_id']}: {response.text}")
    
    return saved_count


def main():
    print("=" * 50)
    print("LinkedIn Job Scraper")
    print(f"Started at: {datetime.now().isoformat()}")
    print("=" * 50)
    
    # Get job titles from command line or fetch from database
    if len(sys.argv) > 1:
        job_titles = sys.argv[1:]
    else:
        # Fetch unique job titles from database
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("Error: No job titles provided and cannot fetch from database")
            sys.exit(1)
        
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }
        
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/job_titles?select=title",
            headers=headers
        )
        response.raise_for_status()
        
        titles_data = response.json()
        job_titles = list(set(t['title'] for t in titles_data))
    
    if not job_titles:
        print("No job titles to search for")
        return
    
    print(f"Searching for {len(job_titles)} job titles: {job_titles}")
    print("-" * 50)
    
    # Scrape jobs
    try:
        jobs = run_apify_actor(job_titles)
        print(f"\nTotal jobs scraped: {len(jobs)}")
    except Exception as e:
        print(f"Error scraping jobs: {e}")
        sys.exit(1)
    
    # Save to database
    if jobs:
        try:
            saved_count = save_to_supabase(jobs)
            print(f"Jobs saved to database: {saved_count}")
        except Exception as e:
            print(f"Error saving to database: {e}")
            sys.exit(1)
    
    print("-" * 50)
    print(f"Completed at: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
