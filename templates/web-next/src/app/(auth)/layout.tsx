// Sign-in and its neighbours carry nothing a search result should show.
export const metadata = { robots: { index: false } }

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      {children}
    </main>
  )
}
