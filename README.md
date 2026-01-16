# JobFlow - Daily Job Alerts Service

A serverless job aggregation service that scrapes LinkedIn and Indeed for jobs matching your preferences and sends personalized daily email digests.

## Features

- 🎯 **Personalized Alerts**: Track up to 5 job titles
- 📬 **Daily Digests**: One email per day with new job postings
- 🔗 **Multi-Source**: Scrapes LinkedIn and Indeed
- 🚫 **No Duplicates**: Each job is only sent once
- 📭 **Unsubscribe Anytime**: One-click unsubscribe in every email

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom dark theme
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Job Scraping**: Apify (LinkedIn + Indeed actors)
- **Email**: Resend
- **Deployment**: Vercel
- **Scheduling**: GitHub Actions

## Getting Started

### Prerequisites

1. [Supabase](https://supabase.com) account
2. [Apify](https://apify.com) account
3. [Resend](https://resend.com) account
4. [Vercel](https://vercel.com) account
5. Node.js 18+

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/job-listings.git
   cd job-listings
   npm install
   ```

2. **Create Supabase project**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Create a new project
   - Run the SQL migration from `supabase/migration.sql` in the SQL Editor

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your API keys:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
   - `APIFY_API_TOKEN`: Apify API token
   - `RESEND_API_KEY`: Resend API key
   - `CRON_SECRET`: Generate a UUID for cron auth
   - `NEXT_PUBLIC_APP_URL`: Your deployment URL

4. **Run locally**
   ```bash
   npm run dev
   ```

### Deployment

1. **Deploy to Vercel**
   - Connect your GitHub repository
   - Add environment variables in Vercel dashboard
   - Deploy

2. **Configure GitHub Actions secrets**
   - Go to repository Settings → Secrets and variables → Actions
   - Add secrets:
     - `APP_URL`: Your Vercel deployment URL
     - `CRON_SECRET`: Same as in Vercel env vars

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── login/page.tsx        # Login page
│   │   ├── signup/page.tsx       # Signup page
│   │   ├── dashboard/page.tsx    # Job title management
│   │   ├── unsubscribe/[token]/  # Unsubscribe handler
│   │   ├── auth/callback/        # Auth callback
│   │   └── api/cron/
│   │       ├── scrape/route.ts   # Scraping endpoint
│   │       └── email/route.ts    # Email endpoint
│   ├── lib/supabase/             # Supabase clients
│   └── types/                    # TypeScript types
├── execution/                    # Python scripts
│   ├── scrape_linkedin.py
│   ├── scrape_indeed.py
│   └── send_daily_emails.py
├── directives/                   # SOP documents
├── supabase/migration.sql        # Database schema
└── .github/workflows/            # Cron jobs
    ├── scrape-jobs.yml           # 8 AM & 6 PM UTC
    └── send-emails.yml           # 9 AM UTC
```

## API Endpoints

### Cron Endpoints (Protected)

- `POST /api/cron/scrape` - Trigger job scraping
- `POST /api/cron/email` - Send daily emails

Both require `Authorization: Bearer {CRON_SECRET}` header.

## Database Schema

- `profiles` - User profiles with subscription status
- `job_titles` - Job titles tracked by users (max 5 per user)
- `jobs` - Scraped job listings
- `email_logs` - Track which jobs were sent to which users

## License

MIT
