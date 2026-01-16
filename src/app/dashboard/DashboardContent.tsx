'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { JobTitle } from '@/types/database'

export default function DashboardContent() {
    const [user, setUser] = useState<{ email: string } | null>(null)
    const [jobTitles, setJobTitles] = useState<JobTitle[]>([])
    const [newTitle, setNewTitle] = useState('')
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/login')
                return
            }

            setUser({ email: user.email || '' })

            // Load job titles
            const { data: titles, error: titlesError } = await supabase
                .from('job_titles')
                .select('*')
                .order('created_at', { ascending: true })

            if (titlesError) {
                console.error('Error loading job titles:', titlesError)
            } else {
                setJobTitles(titles || [])
            }

            setLoading(false)
        }

        loadData()
    }, [supabase, router])

    const handleAddTitle = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        const trimmedTitle = newTitle.trim()
        if (!trimmedTitle) return

        if (jobTitles.length >= 5) {
            setError('You can only add up to 5 job titles')
            return
        }

        if (jobTitles.some(jt => jt.title.toLowerCase() === trimmedTitle.toLowerCase())) {
            setError('This job title already exists')
            return
        }

        setAdding(true)

        const { data: { user } } = await supabase.auth.getUser()

        const { data, error: insertError } = await supabase
            .from('job_titles')
            .insert({ user_id: user?.id, title: trimmedTitle })
            .select()
            .single()

        if (insertError) {
            setError(insertError.message)
        } else if (data) {
            setJobTitles([...jobTitles, data])
            setNewTitle('')
            setSuccess('Job title added! You\'ll receive alerts for matching jobs.')
        }

        setAdding(false)
    }

    const handleRemoveTitle = async (id: string) => {
        setError(null)
        setSuccess(null)

        const { error: deleteError } = await supabase
            .from('job_titles')
            .delete()
            .eq('id', id)

        if (deleteError) {
            setError(deleteError.message)
        } else {
            setJobTitles(jobTitles.filter(jt => jt.id !== id))
            setSuccess('Job title removed')
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="p-6 border-b border-border">
                <nav className="max-w-4xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold gradient-text">JobFlow</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-400">{user?.email}</span>
                        <button onClick={handleLogout} className="btn-secondary text-sm">
                            Log Out
                        </button>
                    </div>
                </nav>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto p-6">
                <div className="animate-fade-in">
                    <h2 className="text-3xl font-bold mb-2">Your Job Alerts</h2>
                    <p className="text-gray-400 mb-8">
                        Add job titles you&apos;re interested in. We&apos;ll send you daily email updates with new matching jobs from LinkedIn and Indeed.
                    </p>

                    {/* Add Job Title Form */}
                    <div className="glass-card p-6 mb-8">
                        <h3 className="text-xl font-semibold mb-4">Add a Job Title</h3>

                        {error && <div className="alert alert-error">{error}</div>}
                        {success && <div className="alert alert-success">{success}</div>}

                        <form onSubmit={handleAddTitle} className="flex gap-4">
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="input-field flex-1"
                                placeholder="e.g., Software Engineer, Product Manager, Data Scientist"
                                disabled={jobTitles.length >= 5}
                            />
                            <button
                                type="submit"
                                disabled={adding || jobTitles.length >= 5 || !newTitle.trim()}
                                className="btn-primary whitespace-nowrap"
                            >
                                {adding ? 'Adding...' : 'Add Title'}
                            </button>
                        </form>

                        <p className="text-sm text-gray-500 mt-3">
                            {5 - jobTitles.length} of 5 job titles remaining
                        </p>
                    </div>

                    {/* Current Job Titles */}
                    <div className="glass-card p-6">
                        <h3 className="text-xl font-semibold mb-4">Your Tracked Job Titles</h3>

                        {jobTitles.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <p className="text-4xl mb-4">📭</p>
                                <p>No job titles yet. Add one above to start receiving alerts!</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {jobTitles.map((jt) => (
                                    <div key={jt.id} className="tag">
                                        <span>{jt.title}</span>
                                        <button
                                            onClick={() => handleRemoveTitle(jt.id)}
                                            className="tag-remove text-lg leading-none"
                                            title="Remove this job title"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="glass-card p-6 mt-8">
                        <h3 className="text-xl font-semibold mb-4">📬 How it Works</h3>
                        <ul className="space-y-3 text-gray-400">
                            <li className="flex items-start gap-3">
                                <span className="text-accent">1.</span>
                                <span>We scrape LinkedIn and Indeed twice daily for jobs matching your titles</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-accent">2.</span>
                                <span>Every morning, you&apos;ll receive an email with new job postings</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-accent">3.</span>
                                <span>Each email only contains jobs you haven&apos;t seen before - no duplicates!</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-accent">4.</span>
                                <span>You can unsubscribe anytime via the link in each email</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    )
}
