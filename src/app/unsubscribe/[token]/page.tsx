import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
    params: Promise<{ token: string }>
}

export default async function UnsubscribePage({ params }: Props) {
    const { token } = await params
    const supabase = createAdminClient()

    // Look up user by unsubscribe token
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('email, is_subscribed')
        .eq('unsubscribe_token', token)
        .single()

    if (error || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="glass-card p-8 max-w-md text-center animate-fade-in">
                    <div className="text-5xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold mb-4">Invalid Link</h1>
                    <p className="text-gray-400">
                        This unsubscribe link is invalid or has expired.
                        If you need to unsubscribe, please use the link from your latest email.
                    </p>
                </div>
            </div>
        )
    }

    // Update subscription status
    if (profile.is_subscribed) {
        await supabase
            .from('profiles')
            .update({ is_subscribed: false })
            .eq('unsubscribe_token', token)
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="glass-card p-8 max-w-md text-center animate-fade-in">
                <div className="text-5xl mb-4">👋</div>
                <h1 className="text-2xl font-bold mb-4">You&apos;ve Been Unsubscribed</h1>
                <p className="text-gray-400 mb-6">
                    We&apos;ve removed <strong className="text-foreground">{profile.email}</strong> from our job alert emails.
                    You won&apos;t receive any more daily job updates.
                </p>
                <p className="text-sm text-gray-500">
                    Changed your mind? Log in to your account anytime to resubscribe.
                </p>
            </div>
        </div>
    )
}
