import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { LanguageSwitcher } from '@/features/i18n/language-switcher'
import type { RouterContext } from '@/router'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <LanguageSwitcher />
      <Outlet />
    </main>
  ),
})
