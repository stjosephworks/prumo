import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Replace this with one sentence that tells a search result what this app is.',
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-4xl font-semibold tracking-tight">Home</h1>
      <p className="text-lg text-muted-foreground">
        This page is rendered once, at build time, and served as static HTML. Everything behind the
        sign-in runs in the browser.
      </p>
      <Link href="/account" className={buttonVariants({ className: 'self-start' })}>
        Sign in
      </Link>
    </main>
  )
}
