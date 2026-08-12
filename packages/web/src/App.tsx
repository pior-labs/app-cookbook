import { useEffect, useState } from 'react';

export function App() {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('API health check failed');
        return response.json();
      })
      .then(() => setApiStatus('healthy'))
      .catch(() => setApiStatus('unavailable'));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full space-y-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-60">Pior Labs</p>
        <h1 className="text-4xl font-semibold tracking-tight">New web application</h1>
        <p className="max-w-2xl text-lg opacity-75">
          Replace this starter screen with the product. The shared platform, design system,
          database pattern, deployment scaffold, and health checks are already in place.
        </p>
        <div className="rounded-lg border p-4 text-sm">
          API status: <strong>{apiStatus}</strong>
        </div>
      </section>
    </main>
  );
}
