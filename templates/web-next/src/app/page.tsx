import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Site',
  description: 'Replace this with one sentence that tells a search result what this site is.',
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-4xl font-semibold tracking-tight">Site</h1>
      <p className="text-lg text-muted-foreground">
        This page is rendered once, at build time, and served as static HTML.
      </p>
    </main>
  )
}
