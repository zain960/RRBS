import { Quote } from 'lucide-react'
import { Link } from 'react-router-dom'

import cn from '../../lib/cn'
import { unsplashSrcSet } from '../../lib/images'
import Brand from './Brand'

/**
 * The shell for sign-in, registration and the two error screens.
 *
 * Brand panel on the left, content card on the right (spec §4). Below `lg` the
 * panel collapses entirely rather than stacking — a full-bleed photograph above
 * a login form on a phone is a scroll the user did not ask for.
 *
 * The panel keeps the display face and a warm photograph so the first screen a
 * guest sees still looks like hospitality, not an admin console.
 */
export default function SplitScreen({
  image = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1400&q=70',
  quote,
  attribution,
  children,
  contentClassName,
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="relative hidden w-1/2 max-w-2xl shrink-0 lg:block">
        {/* Half the viewport, and only above lg — never the full-width file. */}
        <img
          src={image}
          srcSet={unsplashSrcSet(image, { maxWidth: 1024 })}
          sizes="(min-width: 1024px) 50vw, 0px"
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-primary-900/75 to-primary-800/60" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Brand tone="light" size="lg" />

          <div className="max-w-md">
            {quote && (
              <>
                <Quote size={28} aria-hidden="true" className="text-accent-300" />
                <p className="mt-4 font-display text-2xl font-medium leading-snug text-white">
                  {quote}
                </p>
                {attribution && <p className="mt-4 text-sm text-white/60">{attribution}</p>}
              </>
            )}
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} RRBS. Rooms and restaurant, one system.
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-5 sm:px-8 lg:hidden">
          <Brand />
          <Link
            to="/"
            className="rounded-sm text-sm font-medium text-neutral-500 transition-colors duration-hover hover:text-neutral-800"
          >
            Back to site
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className={cn('w-full max-w-md', contentClassName)}>{children}</div>
        </div>
      </main>
    </div>
  )
}
