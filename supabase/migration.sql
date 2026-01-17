-- Supabase SQL Migration for Job Scraping Service
-- Run this in the Supabase SQL Editor

-- Users table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  unsubscribe_token uuid default gen_random_uuid() unique,
  is_subscribed boolean default true,
  created_at timestamp with time zone default now()
);

-- Job titles that users want to track (max 5 per user)
create table if not exists public.job_titles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default now(),
  unique(user_id, title)
);

-- Scraped jobs from LinkedIn and Indeed
create table if not exists public.jobs (
  id uuid default gen_random_uuid() primary key,
  external_id text unique not null,
  source text not null check (source in ('linkedin', 'indeed')),
  title text not null,
  company text,
  location text,
  description text,
  url text not null,
  salary text,
  posted_date timestamp with time zone,
  scraped_at timestamp with time zone default now(),
  search_title text not null
);

-- Track which jobs have been emailed to which users
create table if not exists public.email_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  job_id uuid references public.jobs on delete cascade not null,
  sent_at timestamp with time zone default now(),
  unique(user_id, job_id)
);

-- Track scraper run history for debugging and auditing
create table if not exists public.scrape_logs (
  id uuid default gen_random_uuid() primary key,
  source text not null check (source in ('linkedin', 'indeed')),
  search_title text not null,
  jobs_found integer default 0,
  jobs_saved integer default 0,
  raw_response jsonb,
  error text,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- Indexes for performance
create index if not exists idx_job_titles_user_id on public.job_titles(user_id);
create index if not exists idx_jobs_search_title on public.jobs(search_title);
create index if not exists idx_jobs_scraped_at on public.jobs(scraped_at);
create index if not exists idx_email_logs_user_job on public.email_logs(user_id, job_id);
create index if not exists idx_scrape_logs_search_title on public.scrape_logs(search_title);
create index if not exists idx_scrape_logs_started_at on public.scrape_logs(started_at);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.job_titles enable row level security;
alter table public.jobs enable row level security;
alter table public.email_logs enable row level security;

-- Profiles RLS policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Job titles RLS policies
create policy "Users can view own job titles" on public.job_titles
  for select using (auth.uid() = user_id);

create policy "Users can insert own job titles" on public.job_titles
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own job titles" on public.job_titles
  for delete using (auth.uid() = user_id);

-- Jobs are public (for cron access)
create policy "Jobs are viewable by everyone" on public.jobs
  for select using (true);

create policy "Service role can insert jobs" on public.jobs
  for insert with check (true);

-- Email logs RLS policies
create policy "Users can view own email logs" on public.email_logs
  for select using (auth.uid() = user_id);

create policy "Service role can insert email logs" on public.email_logs
  for insert with check (true);

-- Function to automatically create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to enforce max 5 job titles per user
create or replace function public.check_job_title_limit()
returns trigger as $$
declare
  title_count integer;
begin
  select count(*) into title_count
  from public.job_titles
  where user_id = new.user_id;
  
  if title_count >= 5 then
    raise exception 'Maximum of 5 job titles allowed per user';
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger to enforce job title limit
drop trigger if exists check_job_title_limit_trigger on public.job_titles;
create trigger check_job_title_limit_trigger
  before insert on public.job_titles
  for each row execute procedure public.check_job_title_limit();
