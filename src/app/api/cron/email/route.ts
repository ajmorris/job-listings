import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

// Lazy initialization to avoid build-time errors
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }
  return new Resend(apiKey)
}

interface UserWithJobs {
  userId: string
  email: string
  unsubscribeToken: string
  jobs: Array<{
    id: string
    title: string
    company: string | null
    location: string | null
    url: string
    salary: string | null
    source: string
  }>
}

function generateEmailHtml(user: UserWithJobs, appUrl: string): string {
  const jobsHtml = user.jobs.map(job => `
    <tr>
      <td style="padding: 20px; border-bottom: 1px solid #2d2d44;">
        <div style="margin-bottom: 8px;">
          <a href="${job.url}" style="color: #6366f1; font-size: 18px; font-weight: 600; text-decoration: none;">
            ${job.title}
          </a>
        </div>
        <div style="color: #f8f8f2; margin-bottom: 4px;">
          🏢 ${job.company || 'Company not listed'}
        </div>
        <div style="color: #a0a0a0; margin-bottom: 4px;">
          📍 ${job.location || 'Location not specified'}
        </div>
        ${job.salary ? `<div style="color: #22c55e;">💰 ${job.salary}</div>` : ''}
        <div style="margin-top: 8px;">
          <span style="background: ${job.source === 'linkedin' ? '#0077b5' : '#2164f3'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            ${job.source === 'linkedin' ? 'LinkedIn' : 'Indeed'}
          </span>
        </div>
      </td>
    </tr>
  `).join('')

  return `
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
              Hey there! 👋 We found <strong>${user.jobs.length} new job${user.jobs.length === 1 ? '' : 's'}</strong> matching your preferences.
            </p>
          </td>
        </tr>
        ${jobsHtml}
        <tr>
          <td style="padding: 24px; text-align: center; border-top: 1px solid #2d2d44;">
            <p style="color: #a0a0a0; font-size: 14px; margin: 0 0 16px 0;">
              Happy job hunting! 🚀
            </p>
            <p style="color: #666; font-size: 12px; margin: 0;">
              <a href="${appUrl}/unsubscribe/${user.unsubscribeToken}" style="color: #666;">Unsubscribe</a>
              &nbsp;•&nbsp;
              <a href="${appUrl}/dashboard" style="color: #666;">Manage Preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

function generateNoJobsEmailHtml(email: string, unsubscribeToken: string, appUrl: string): string {
  return `
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
              We searched LinkedIn and Indeed but didn't find any new jobs matching your preferences today.
              We'll keep looking and let you know as soon as we find something!
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px; text-align: center; border-top: 1px solid #2d2d44;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              <a href="${appUrl}/unsubscribe/${unsubscribeToken}" style="color: #666;">Unsubscribe</a>
              &nbsp;•&nbsp;
              <a href="${appUrl}/dashboard" style="color: #666;">Manage Preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const resend = getResendClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // Get all subscribed users with their job titles
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, unsubscribe_token')
      .eq('is_subscribed', true)

    if (usersError) throw usersError
    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No subscribed users' })
    }

    const results = {
      emailsSent: 0,
      noJobsEmails: 0,
      errors: [] as string[],
    }

    for (const user of users) {
      try {
        // Get user's job titles
        const { data: titles } = await supabase
          .from('job_titles')
          .select('title')
          .eq('user_id', user.id)

        if (!titles || titles.length === 0) continue

        const userTitles = titles.map(t => t.title)

        // Find jobs matching user's titles that haven't been sent yet
        // First get all jobs matching titles
        const { data: allJobs } = await supabase
          .from('jobs')
          .select('id, title, company, location, url, salary, source, search_title')
          .in('search_title', userTitles)
          .order('scraped_at', { ascending: false })
          .limit(50)

        console.log(`Found ${allJobs?.length || 0} jobs for user ${user.email}`)

        // Get already sent job IDs for this user
        const { data: sentLogs } = await supabase
          .from('email_logs')
          .select('job_id')
          .eq('user_id', user.id)

        const sentJobIds = new Set(sentLogs?.map(l => l.job_id) || [])

        // Filter to only unsent jobs
        const jobs = (allJobs || []).filter(job => !sentJobIds.has(job.id)).slice(0, 20)

        // Send appropriate email
        if (!jobs || jobs.length === 0) {
          // Send "no new jobs" email
          await resend.emails.send({
            from: 'JobFlow <noreply@jobflow.app>',
            to: user.email,
            subject: '📭 No new jobs today - JobFlow',
            html: generateNoJobsEmailHtml(user.email, user.unsubscribe_token, appUrl),
          })
          results.noJobsEmails++
        } else {
          // Send jobs email
          await resend.emails.send({
            from: 'JobFlow <noreply@jobflow.app>',
            to: user.email,
            subject: `🎯 ${jobs.length} new job${jobs.length === 1 ? '' : 's'} for you - JobFlow`,
            html: generateEmailHtml({
              userId: user.id,
              email: user.email,
              unsubscribeToken: user.unsubscribe_token,
              jobs,
            }, appUrl),
          })

          // Log sent jobs to prevent duplicates
          const emailLogs = jobs.map(job => ({
            user_id: user.id,
            job_id: job.id,
          }))

          await supabase.from('email_logs').insert(emailLogs)
          results.emailsSent++
        }
      } catch (err) {
        results.errors.push(`User ${user.email}: ${err}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${results.emailsSent} job emails and ${results.noJobsEmails} "no jobs" emails`,
      errors: results.errors,
    })
  } catch (error) {
    console.error('Email sending error:', error)
    return NextResponse.json(
      { error: 'Failed to send emails', details: String(error) },
      { status: 500 }
    )
  }
}

// Also support GET for manual triggering
export async function GET(request: NextRequest) {
  return POST(request)
}
