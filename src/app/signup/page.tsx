'use client'

import dynamic from 'next/dynamic'

const SignupContent = dynamic(() => import('./SignupContent'), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen flex items-center justify-center">
            <div className="spinner"></div>
        </div>
    ),
})

export default function SignupPage() {
    return <SignupContent />
}
