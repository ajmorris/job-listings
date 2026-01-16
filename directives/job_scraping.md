# Job Scraping Directive

## Goal
Scrape job listings from LinkedIn and Indeed based on user-specified job titles, save them to Supabase, and send daily email digests to subscribers.

## Inputs
- Job titles from all subscribed users (fetched from `job_titles` table)
- Apify API token for scraper access
- Supabase credentials for database operations
- Resend API key for email delivery

## Execution Flow

### 1. Scraping Jobs (Twice Daily - 8 AM & 6 PM UTC)
1. Fetch all unique job titles from `job_titles` table
2. For each title:
   - Run LinkedIn scraper (`bebity/linkedin-jobs-scraper`)
   - Run Indeed scraper (`misceres/indeed-scraper`)
3. Save jobs to `jobs` table with deduplication via `external_id`

**Scripts:**
- `execution/scrape_linkedin.py`
- `execution/scrape_indeed.py`

**API Endpoint:**
- `POST /api/cron/scrape` (with Authorization: Bearer {CRON_SECRET})

### 2. Sending Emails (Once Daily - 9 AM UTC)
1. Fetch all subscribed users from `profiles` table
2. For each user:
   - Get their job title preferences from `job_titles`
   - Find matching jobs not yet sent (check `email_logs`)
   - If jobs found: Send personalized digest email
   - If no jobs: Send "no new jobs" notification
3. Log sent jobs to `email_logs` to prevent duplicates

**Script:**
- `execution/send_daily_emails.py`

**API Endpoint:**
- `POST /api/cron/email` (with Authorization: Bearer {CRON_SECRET})

## Outputs
- Jobs stored in `jobs` table
- Emails sent via Resend
- Email logs in `email_logs` table

## Edge Cases

### Rate Limits
- Apify has usage-based pricing; monitor costs
- Resend free tier: 100 emails/day, 3000/month
- Add delays between scraper runs if hitting limits

### Duplicates
- Jobs are deduplicated by `external_id` (source + job ID)
- Emails are deduplicated by `email_logs` table

### Failed Scrapes
- Log errors but continue with remaining titles
- Retry on next scheduled run

### Unsubscribed Users
- Check `is_subscribed` flag before sending
- Unsubscribe link uses `unsubscribe_token` for security

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APIFY_API_TOKEN=
RESEND_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
```

## Learnings
- Indeed scraper (`misceres/indeed-scraper`) returns different field names than LinkedIn
- Job descriptions should be truncated to 5000 chars to fit DB column
- Always use `onConflict: 'external_id'` for upserts
