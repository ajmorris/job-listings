export interface Profile {
    id: string
    email: string
    unsubscribe_token: string
    is_subscribed: boolean
    created_at: string
}

export interface JobTitle {
    id: string
    user_id: string
    title: string
    created_at: string
}

export interface Job {
    id: string
    external_id: string
    source: 'linkedin' | 'indeed'
    title: string
    company: string | null
    location: string | null
    description: string | null
    url: string
    salary: string | null
    posted_date: string | null
    scraped_at: string
    search_title: string
}

export interface EmailLog {
    id: string
    user_id: string
    job_id: string
    sent_at: string
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile
                Insert: Omit<Profile, 'created_at'>
                Update: Partial<Omit<Profile, 'id' | 'created_at'>>
            }
            job_titles: {
                Row: JobTitle
                Insert: Omit<JobTitle, 'id' | 'created_at'>
                Update: Partial<Omit<JobTitle, 'id' | 'created_at'>>
            }
            jobs: {
                Row: Job
                Insert: Omit<Job, 'id' | 'scraped_at'>
                Update: Partial<Omit<Job, 'id' | 'scraped_at'>>
            }
            email_logs: {
                Row: EmailLog
                Insert: Omit<EmailLog, 'id' | 'sent_at'>
                Update: Partial<Omit<EmailLog, 'id' | 'sent_at'>>
            }
        }
    }
}
