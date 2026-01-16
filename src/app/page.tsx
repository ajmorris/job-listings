import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-6">
        <nav className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold gradient-text">JobFlow</h1>
          <div className="flex gap-4">
            <Link href="/login" className="btn-secondary">
              Log In
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign Up Free
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="mb-6">
            <span className="tag">🚀 Free Job Alerts</span>
          </div>

          <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Get Your Dream Job
            <br />
            <span className="gradient-text">Delivered Daily</span>
          </h2>

          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Stop endless scrolling. We scrape LinkedIn and Indeed for jobs matching your preferences
            and deliver fresh opportunities straight to your inbox every day.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/signup" className="btn-primary text-lg px-8 py-4 pulse-glow">
              Start Getting Jobs →
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="glass-card p-6 text-left">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Personalized Alerts</h3>
              <p className="text-gray-400">
                Add up to 5 job titles you&apos;re interested in. We&apos;ll find matching positions just for you.
              </p>
            </div>

            <div className="glass-card p-6 text-left">
              <div className="text-3xl mb-4">📬</div>
              <h3 className="text-xl font-semibold mb-2">Daily Digest</h3>
              <p className="text-gray-400">
                One email per day with all new job postings. No spam, no duplicates, only fresh opportunities.
              </p>
            </div>

            <div className="glass-card p-6 text-left">
              <div className="text-3xl mb-4">🔗</div>
              <h3 className="text-xl font-semibold mb-2">LinkedIn & Indeed</h3>
              <p className="text-gray-400">
                We search across major job platforms so you don&apos;t have to. All jobs in one place.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-500">
        <p>© 2025 JobFlow. Your career, delivered.</p>
      </footer>
    </div>
  )
}
