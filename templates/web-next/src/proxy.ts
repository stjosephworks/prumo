import { type NextRequest, NextResponse } from 'next/server'
import {
  isLocale,
  localeOfSegment,
  negotiateLocale,
  parseAcceptLanguage,
  segmentOf,
} from '@/i18n/locales'

// The cookie the switcher writes (i18n.tsx): a language chosen here wins over the browser's.
const CHOSEN_COOKIE = 'locale'

// Every page lives under its language. An address without one, as the API's links back and a typed `/sign-in`, is sent
// to the same address in the language chosen here, else the first of the browser's the project speaks, else the base.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (localeOfSegment(pathname.split('/')[1] ?? '') !== undefined) {
    return NextResponse.next()
  }

  const chosen = request.cookies.get(CHOSEN_COOKIE)?.value
  const locale =
    chosen !== undefined && isLocale(chosen)
      ? chosen
      : negotiateLocale(parseAcceptLanguage(request.headers.get('accept-language')))
  const url = request.nextUrl.clone()

  url.pathname = `/${segmentOf(locale)}${pathname === '/' ? '' : pathname}`

  return NextResponse.redirect(url)
}

export const config = {
  // Not Next's own files, nor a file of public/: anything with an extension.
  matcher: ['/((?!_next/static|_next/image|.*\\.[^/]+$).*)'],
}
