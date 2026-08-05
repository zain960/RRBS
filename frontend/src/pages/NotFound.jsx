import { ArrowLeft, BedDouble, UtensilsCrossed } from 'lucide-react'

import SplitScreen from '../components/layout/SplitScreen'
import PageMeta from '../components/PageMeta'
import { Button } from '../components/ui'

/**
 * 404.
 *
 * Previously an unknown URL silently redirected to the landing page, which read
 * as the app having lost its place. Naming the problem and offering the two
 * things a visitor is most likely looking for is more useful than a bounce.
 */
export default function NotFound() {
  return (
    <>
      <PageMeta title="Page not found" noIndex />

      <SplitScreen
        image="https://images.unsplash.com/photo-1590073242678-70ee3fc28e8e?auto=format&fit=crop&w=1400&q=70"
        quote="Every corridor leads somewhere. This one doesn't."
        attribution="RRBS"
      >
        <p className="font-display text-6xl font-semibold text-accent-500">404</p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-neutral-900">
          We couldn't find that page
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          The link may be out of date, or the page may have moved. Nothing has happened to your
          bookings or orders.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" to="/" iconLeft={ArrowLeft}>
            Back to home
          </Button>
          <Button variant="secondary" size="lg" to="/rooms" iconLeft={BedDouble}>
            Find a room
          </Button>
        </div>

        <div className="mt-10 border-t border-neutral-200 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Popular pages
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              <Button variant="link" to="/menu" iconLeft={UtensilsCrossed}>
                Browse the menu
              </Button>
            </li>
            <li>
              <Button variant="link" to="/my-bookings">
                My bookings
              </Button>
            </li>
          </ul>
        </div>
      </SplitScreen>
    </>
  )
}
