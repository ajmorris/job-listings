import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// LinkedIn Jobs Scraper Actor ID on Apify (uses titleSearch for precise filtering)
const LINKEDIN_ACTOR_ID = 'fantastic-jobs~advanced-linkedin-job-search-api'
const INDEED_ACTOR_ID = 'misceres~indeed-scraper'
const MONSTER_ACTOR_ID = 'memo23~monster-scraper'

interface ApifyRunResponse {
    data: {
        id: string
        status: string
    }
}

interface LinkedInJob {
    title: string
    organization?: string
    organizationName?: string
    location: string
    url: string
    description: string
    salaryRange?: string | null
    datePosted?: string
    id: string
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

interface MonsterJob {
    jobTitle: string
    companyName: string
    location: string
    jobUrl: string
    description: string
    salary?: string | null
    jobId: string
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

async function logScrapeStart(supabase: any, source: string, title: string) {
    const { data, error } = await supabase
        .from('scrape_logs')
        .insert({
            source,
            search_title: title,
            started_at: new Date().toISOString()
        })
        .select('id')
        .single()

    if (error) console.error('Error logging scrape start:', error)
    return data?.id
}

async function logScrapeComplete(supabase: any, logId: string, found: number, saved: number, rawResponse: any) {
    if (!logId) return
    const { error } = await supabase
        .from('scrape_logs')
        .update({
            jobs_found: found,
            jobs_saved: saved,
            raw_response: rawResponse,
            completed_at: new Date().toISOString()
        })
        .eq('id', logId)

    if (error) console.error('Error logging scrape completion:', error)
}

async function logScrapeError(supabase: any, logId: string, errorMsg: string) {
    if (!logId) return
    const { error } = await supabase
        .from('scrape_logs')
        .update({
            error: errorMsg,
            completed_at: new Date().toISOString()
        })
        .eq('id', logId)

    if (error) console.error('Error logging scrape error:', error)
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

        const uniqueTitles = [...new Set(allTitles?.map(t => t.title.toLowerCase().trim()) || [])]

        if (uniqueTitles.length === 0) {
            return NextResponse.json({ message: 'No job titles to search for' })
        }

        // Check which titles have been scraped recently (within last 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recentScrapes } = await supabase
            .from('scrape_logs')
            .select('search_title, source')
            .gte('started_at', twentyFourHoursAgo)
            .is('error', null)

        // Create a set of recently scraped title+source combinations
        const recentlyScraped = new Set(
            recentScrapes?.map(s => `${s.source}:${s.search_title.toLowerCase()}`) || []
        )

        console.log(`Found ${uniqueTitles.length} unique titles, ${recentlyScraped.size} already scraped recently`)

        const results = {
            linkedin: 0,
            indeed: 0,
            monster: 0,
            skipped: 0,
            errors: [] as string[],
        }

        // Scrape each title
        for (const title of uniqueTitles) {
            // Scrape LinkedIn (if not recently scraped)
            if (!recentlyScraped.has(`linkedin:${title}`)) {
                const logId = await logScrapeStart(supabase, 'linkedin', title)
                try {
                    const linkedInJobs = await runApifyActor(LINKEDIN_ACTOR_ID, {
                        titleSearch: [title],
                        locationSearch: ['United States'],
                        maxJobs: 25,
                        descriptionType: 'text',
                    }) as LinkedInJob[]

                    let savedCount = 0
                    for (const job of linkedInJobs) {
                        const jobTitleLower = (job.title || '').toLowerCase()
                        const searchTitleLower = title.toLowerCase()
                        if (!jobTitleLower.includes(searchTitleLower) && !searchTitleLower.split(' ').some((word: string) => jobTitleLower.includes(word))) {
                            continue
                        }

                        const { error } = await supabase.from('jobs').upsert(
                            {
                                external_id: `linkedin_${job.id || job.url}`,
                                source: 'linkedin',
                                title: job.title,
                                company: job.organizationName || job.organization,
                                location: job.location,
                                description: job.description?.substring(0, 5000),
                                url: job.url,
                                salary: job.salaryRange,
                                search_title: title,
                            },
                            { onConflict: 'external_id' }
                        )
                        if (!error) savedCount++
                    }
                    results.linkedin += savedCount
                    await logScrapeComplete(supabase, logId, linkedInJobs.length, savedCount, linkedInJobs)
                } catch (err) {
                    results.errors.push(`LinkedIn (${title}): ${err}`)
                    await logScrapeError(supabase, logId, String(err))
                }
            } else {
                results.skipped++
            }

            // Scrape Indeed (if not recently scraped)
            if (!recentlyScraped.has(`indeed:${title}`)) {
                const logId = await logScrapeStart(supabase, 'indeed', title)
                try {
                    const indeedJobs = await runApifyActor(INDEED_ACTOR_ID, {
                        position: title,
                        country: 'US',
                        maxItems: 25,
                    }) as IndeedJob[]

                    let savedCount = 0
                    for (const job of indeedJobs) {
                        const jobTitleLower = (job.positionName || '').toLowerCase()
                        const searchTitleLower = title.toLowerCase()
                        if (!jobTitleLower.includes(searchTitleLower) && !searchTitleLower.split(' ').some((word: string) => jobTitleLower.includes(word))) {
                            continue
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
                        if (!error) savedCount++
                    }
                    results.indeed += savedCount
                    await logScrapeComplete(supabase, logId, indeedJobs.length, savedCount, indeedJobs)
                } catch (err) {
                    results.errors.push(`Indeed (${title}): ${err}`)
                    await logScrapeError(supabase, logId, String(err))
                }
            } else {
                results.skipped++
            }

            // Scrape Monster (if not recently scraped)
            if (!recentlyScraped.has(`monster:${title}`)) {
                const logId = await logScrapeStart(supabase, 'monster', title)
                try {
                    const encodedQuery = encodeURIComponent(title)
                    const encodedLocation = encodeURIComponent('United States')
                    const searchUrl = `https://www.monster.com/jobs/search?q=${encodedQuery}&where=${encodedLocation}&so=m.h.sh`

                    const monsterJobs = await runApifyActor(MONSTER_ACTOR_ID, {
                        startUrls: [searchUrl],
                        maxItems: 25,
                    }) as MonsterJob[]

                    let savedCount = 0
                    for (const job of monsterJobs) {
                        const jobTitleLower = (job.jobTitle || '').toLowerCase()
                        const searchTitleLower = title.toLowerCase()
                        if (!jobTitleLower.includes(searchTitleLower) && !searchTitleLower.split(' ').some((word: string) => jobTitleLower.includes(word))) {
                            continue
                        }

                        const { error } = await supabase.from('jobs').upsert(
                            {
                                external_id: `monster_${job.jobId || job.jobUrl}`,
                                source: 'monster',
                                title: job.jobTitle,
                                company: job.companyName,
                                location: job.location,
                                description: job.description?.substring(0, 5000),
                                url: job.jobUrl,
                                salary: job.salary,
                                search_title: title,
                            },
                            { onConflict: 'external_id' }
                        )
                        if (!error) savedCount++
                    }
                    results.monster += savedCount
                    await logScrapeComplete(supabase, logId, monsterJobs.length, savedCount, monsterJobs)
                } catch (err) {
                    results.errors.push(`Monster (${title}): ${err}`)
                    await logScrapeError(supabase, logId, String(err))
                }
            } else {
                results.skipped++
            }
        }

        return NextResponse.json({
            success: true,
            message: `Scraped ${results.linkedin} LinkedIn, ${results.indeed} Indeed, and ${results.monster} Monster jobs (${results.skipped} sources skipped - recently scraped)`,
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
