#!/usr/bin/env python3
"""
Daily Email Sender Execution Script

This script sends daily job digest emails to all subscribed users.
It queries Supabase for new jobs matching each user's preferences
and sends personalized emails via Resend.

Environment Variables Required:
- RESEND_API_KEY: Your Resend API key
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
- APP_URL: Your application URL (for unsubscribe links)

Usage:
  python send_daily_emails.py
"""

import os
import sys
import requests
from datetime import datetime

# Load environment variables from .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

RESEND_API_KEY = os.getenv('RESEND_API_KEY')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
APP_URL = os.getenv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')


def generate_jobs_email_html(user_email: str, jobs: list[dict], unsubscribe_token: str) -> str:
    """Generate HTML email content for job listings."""
    jobs_html = ""
    for job in jobs:
        jobs_html += f"""
        <tr>
          <td style="padding: 20px; border-bottom: 1px solid #2d2d44;">
            <div style="margin-bottom: 8px;">
              <a href="{job['url']}" style="color: #6366f1; font-size: 18px; font-weight: 600; text-decoration: none;">
                {job['title']}
              </a>
            </div>
            <div style="color: #f8f8f2; margin-bottom: 4px;">
              🏢 {job.get('company') or 'Company not listed'}
            </div>
            <div style="color: #a0a0a0; margin-bottom: 4px;">
              📍 {job.get('location') or 'Location not specified'}
            </div>
            {f"<div style='color: #22c55e;'>💰 {job['salary']}</div>" if job.get('salary') else ''}
            <div style="margin-top: 8px;">
              <span style="background: {'#0077b5' if job['source'] == 'linkedin' else '#2557a7' if job['source'] == 'indeed' else '#6d28d9'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                {job['source'].title()}
              </span>
            </div>
          </td>
        </tr>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #1a1a2e;">
        <tr>
          <td style="padding: 32px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);">
            <h1 style="margin: 0; color: white; font-size: 28px;">JobFlow</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9);">Your Daily Job Digest</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <p style="color: #f8f8f2; font-size: 16px; margin: 0 0 16px 0;">
              Hey there! 👋 We found <strong>{len(jobs)} new job{'s' if len(jobs) != 1 else ''}</strong> matching your preferences.
            </p>
          </td>
        </tr>
        {jobs_html}
        <tr>
          <td style="padding: 24px; text-align: center; border-top: 1px solid #2d2d44;">
            <p style="color: #a0a0a0; font-size: 14px; margin: 0 0 16px 0;">
              Happy job hunting! 🚀
            </p>
            <p style="color: #666; font-size: 12px; margin: 0;">
              <a href="{APP_URL}/unsubscribe/{unsubscribe_token}" style="color: #666;">Unsubscribe</a>
              &nbsp;•&nbsp;
              <a href="{APP_URL}/dashboard" style="color: #666;">Manage Preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


def generate_no_jobs_email_html(user_email: str, unsubscribe_token: str) -> str:
    """Generate HTML email content when no new jobs are found."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #1a1a2e;">
        <tr>
          <td style="padding: 32px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);">
            <h1 style="margin: 0; color: white; font-size: 28px;">JobFlow</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9);">Daily Update</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 48px 24px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
            <h2 style="color: #f8f8f2; margin: 0 0 16px 0;">No New Jobs Today</h2>
            <p style="color: #a0a0a0; font-size: 16px; margin: 0;">
              We searched LinkedIn, Indeed, and Monster but didn't find any new jobs matching your preferences today.
              We'll keep looking and let you know as soon as we find something!
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px; text-align: center; border-top: 1px solid #2d2d44;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              <a href="{APP_URL}/unsubscribe/{unsubscribe_token}" style="color: #666;">Unsubscribe</a>
              &nbsp;•&nbsp;
              <a href="{APP_URL}/dashboard" style="color: #666;">Manage Preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend API."""
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY environment variable is not set")
    
    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": "JobFlow <no-reply@jobs.ajmorris.me>",
            "to": to,
            "subject": subject,
            "html": html,
        }
    )
    
    if response.status_code != 200:
        print(f"  Error sending to {to}: {response.status_code} - {response.text}")
    
    return response.status_code == 200


def main():
    print("=" * 50)
    print("Daily Email Sender")
    print(f"Started at: {datetime.now().isoformat()}")
    print("=" * 50)
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Supabase environment variables not set")
        sys.exit(1)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    
    # Get all subscribed users
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/profiles?is_subscribed=eq.true&select=id,email,unsubscribe_token",
        headers=headers
    )
    response.raise_for_status()
    users = response.json()
    
    print(f"Found {len(users)} subscribed users")
    
    emails_sent = 0
    no_jobs_emails = 0
    errors = []
    
    for user in users:
        try:
            # Get user's job titles
            titles_response = requests.get(
                f"{SUPABASE_URL}/rest/v1/job_titles?user_id=eq.{user['id']}&select=title",
                headers=headers
            )
            titles = [t['title'] for t in titles_response.json()]
            
            if not titles:
                print(f"  {user['email']}: No job titles configured")
                continue
            
            # Get jobs matching user's titles that haven't been sent
            # First, get job IDs already sent to this user
            sent_response = requests.get(
                f"{SUPABASE_URL}/rest/v1/email_logs?user_id=eq.{user['id']}&select=job_id",
                headers=headers
            )
            sent_job_ids = [l['job_id'] for l in sent_response.json()]
            
            # Get matching jobs not yet sent
            # Build the filter for search_title
            title_filters = ','.join([f'"{t}"' for t in titles])
            jobs_url = f"{SUPABASE_URL}/rest/v1/jobs?search_title=in.({title_filters})&order=scraped_at.desc&limit=20"
            
            jobs_response = requests.get(jobs_url, headers=headers)
            all_jobs = jobs_response.json()
            
            # Filter out already sent jobs
            new_jobs = [j for j in all_jobs if j['id'] not in sent_job_ids]
            
            # Send email
            if new_jobs:
                html = generate_jobs_email_html(user['email'], new_jobs, user['unsubscribe_token'])
                subject = f"🎯 {len(new_jobs)} new job{'s' if len(new_jobs) != 1 else ''} for you - JobFlow"
                
                if send_email(user['email'], subject, html):
                    # Log sent jobs
                    for job in new_jobs:
                        requests.post(
                            f"{SUPABASE_URL}/rest/v1/email_logs",
                            headers=headers,
                            json={"user_id": user['id'], "job_id": job['id']}
                        )
                    
                    emails_sent += 1
                    print(f"  {user['email']}: Sent {len(new_jobs)} jobs")
                else:
                    errors.append(f"{user['email']}: Failed to send email")
            else:
                html = generate_no_jobs_email_html(user['email'], user['unsubscribe_token'])
                subject = "📭 No new jobs today - JobFlow"
                
                if send_email(user['email'], subject, html):
                    no_jobs_emails += 1
                    print(f"  {user['email']}: Sent 'no jobs' email")
                else:
                    errors.append(f"{user['email']}: Failed to send email")
                    
        except Exception as e:
            errors.append(f"{user['email']}: {str(e)}")
            print(f"  Error processing {user['email']}: {e}")
    
    print("-" * 50)
    print(f"Emails sent with jobs: {emails_sent}")
    print(f"Emails sent with no jobs: {no_jobs_emails}")
    if errors:
        print(f"Errors: {len(errors)}")
        for err in errors:
            print(f"  - {err}")
    print(f"Completed at: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
