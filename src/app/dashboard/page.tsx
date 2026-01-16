'use client'

import dynamic from 'next/dynamic'

// Dynamically import the dashboard content to avoid SSR issues
const DashboardContent = dynamic(() => import('./DashboardContent'), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen flex items-center justify-center">
            <div className="spinner"></div>
        </div>
    ),
})

export default function DashboardPage() {
    return <DashboardContent />
}
