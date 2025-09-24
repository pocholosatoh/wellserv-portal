'use client'
import { useEffect, useState } from 'react'

export default function ResultsPage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const pid = document.cookie
      .split('; ')
      .find((row) => row.startsWith('patient_id='))
      ?.split('=')[1]

    if (!pid) return

    fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: pid }),
    })
      .then((res) => res.json())
      .then((data) => setResults(data.results || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <div className="container" style={{ padding: 20 }}>
      <h1>My Lab Results</h1>
      {results.length === 0 && <p>No results found.</p>}
      <ul>
        {results.map((r) => (
          <li key={r.id}>
            {r.analyte}: {r.value} {r.units}
          </li>
        ))}
      </ul>
    </div>
  )
}
