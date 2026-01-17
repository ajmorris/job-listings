import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// LinkedIn Jobs Scraper Actor ID on Apify (no login required)
const LINKEDIN_ACTOR_ID = 'apimaestro~linkedin-jobs-scraper-api'
const INDEED_ACTOR_ID = 'misceres~indeed-scraper'

interface ApifyRunResponse {
    data: {
        id: string
        status: string
    }
}

interface LinkedInJob {
    job_title: string
    company: string
    location: string
    job_url: string
    description: string
    salary?: string | null
    posted_at?: string
    job_id: string
}

interface IndeedJob {
    positionName: string
    company: string
    location: string
    url: string
    description: string
    salary?: string | null
    postedAt?: string
    id: string
}

async function runApifyActor(actorId: string, input: object): Promise<object[]> {
    const token = process.env.APIFY_API_TOKEN
    if (!token) throw new Error('APIFY_API_TOKEN not configured')

    // Start the actor run
    const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        }
    )

    if (!runResponse.ok) {
        throw new Error(`Apify run failed: ${runResponse.statusText}`)
    }

    const runData: ApifyRunResponse = await runResponse.json()
    const runId = runData.data.id

    // Wait for completion (poll every 5 seconds, max 5 minutes)
    let status = runData.data.status
    let attempts = 0
    const maxAttempts = 60

    while (status === 'RUNNING' || status === 'READY') {
        if (attempts >= maxAttempts) {
            throw new Error('Apify run timed out')
        }

        await new Promise(resolve => setTimeout(resolve, 5000))

        const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
        )
        const statusData = await statusResponse.json()
        status = statusData.data.status
        attempts++
    }

    if (status !== 'SUCCEEDED') {
        throw new Error(`Apify run failed with status: ${status}`)
    }

    // Get the dataset items
    const datasetResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}`
    )

    const data = await datasetResponse.json()
    console.log('Apify response:', JSON.stringify(data).substring(0, 1000))
    return data
}

export async function POST(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    try {
        // Get all unique job titles from users
        const { data: allTitles, error: titlesError } = await supabase
            .from('job_titles')
            .select('title')

        if (titlesError) throw titlesError

        const uniqueTitles = [...new Set(allTitles?.map(t => t.title) || [])]

        if (uniqueTitles.length === 0) {
            return NextResponse.json({ message: 'No job titles to search for' })
        }

        console.log(`Scraping jobs for ${uniqueTitles.length} unique titles...`)

        const results = {
            linkedin: 0,
            indeed: 0,
            errors: [] as string[],
        }

        // Scrape LinkedIn for each title
        for (const title of uniqueTitles) {
            try {
                const linkedInJobs = await runApifyActor(LINKEDIN_ACTOR_ID, {
                    keyword: title,
                    rows: 25,
                    location: 'United States',
                }) as LinkedInJob[]

                for (const job of linkedInJobs) {
                    // Filter: only save jobs where title matches search keyword
                    const jobTitleLower = (job.job_title || '').toLowerCase()
                    const searchTitleLower = title.toLowerCase()
                    if (!jobTitleLower.includes(searchTitleLower) && !searchTitleLower.split(' ').some((word: string) => jobTitleLower.includes(word))) {
                        continue // Skip jobs that don't match the search title
                    }

                    const { error } = await supabase.from('jobs').upsert(
                        {
                            external_id: `linkedin_${job.job_id || job.job_url}`,
                            source: 'linkedin',
                            title: job.job_title,
                            company: job.company,
                            location: job.location,
                            description: job.description?.substring(0, 5000),
                            url: job.job_url,
                            salary: job.salary,
                            search_title: title,
                        },
                        { onConflict: 'external_id' }
                    )

                    if (!error) results.linkedin++
                }
            } catch (err) {
                results.errors.push(`LinkedIn (${title}): ${err}`)
            }

            // Scrape Indeed for each title
            try {
                const indeedJobs = await runApifyActor(INDEED_ACTOR_ID, {
                    position: title,
                    country: 'US',
                    maxItems: 25,
                }) as IndeedJob[]

                for (const job of indeedJobs) {
                    // Filter: only save jobs where title matches search keyword
                    const jobTitleLower = (job.positionName || '').toLowerCase()
                    const searchTitleLower = title.toLowerCase()
                    if (!jobTitleLower.includes(searchTitleLower) && !searchTitleLower.split(' ').some((word: string) => jobTitleLower.includes(word))) {
                        continue // Skip jobs that don't match the search title
                    }

                    const { error } = await supabase.from('jobs').upsert(
                        {
                            external_id: `indeed_${job.id}`,
                            source: 'indeed',
                            title: job.positionName,
                            company: job.company,
                            location: job.location,
                            description: job.description?.substring(0, 5000),
                            url: job.url,
                            salary: job.salary,
                            search_title: title,
                        },
                        { onConflict: 'external_id' }
                    )

                    if (!error) results.indeed++
                }
            } catch (err) {
                results.errors.push(`Indeed (${title}): ${err}`)
            }
        }

        return NextResponse.json({
            success: true,
            message: `Scraped ${results.linkedin} LinkedIn jobs and ${results.indeed} Indeed jobs`,
            errors: results.errors,
        })
    } catch (error) {
        console.error('Scraping error:', error)
        return NextResponse.json(
            { error: 'Failed to scrape jobs', details: String(error) },
            { status: 500 }
        )
    }
}

// Also support GET for manual triggering
export async function GET(request: NextRequest) {
    return POST(request)
}
