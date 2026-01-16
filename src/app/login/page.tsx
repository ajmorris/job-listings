'use client'

import dynamic from 'next/dynamic'

const LoginContent = dynamic(() => import('./LoginContent'), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen flex items-center justify-center">
            <div className="spinner"></div>
        </div>
    ),
})

export default function LoginPage() {
    return <LoginContent />
}
