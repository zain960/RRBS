import {
  ArrowRight,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ConciergeBell,
  MessageSquareQuote,
  ReceiptText,
  Search,
  Star,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { listDurations } from '../api/bookings'
import { errorMessage } from '../api/client'
import { fetchMenu } from '../api/foods'
import { getRatingSummary } from '../api/reviews'
import { listRoomTypes } from '../api/roomTypes'
import FoodCard from '../components/domain/FoodCard'
import RoomTypeCard from '../components/domain/RoomTypeCard'
import PageMeta from '../components/PageMeta'
import {
  Button,
  Card,
  EmptyState,
  InlineError,
  SelectControl,
  SkeletonCard,
  SkeletonGroup,
} from '../components/ui'
import { useToast } from '../context/ToastContext'
import cn from '../lib/cn'
import { dateOnly, toLocalInputValue } from '../lib/format'
import { unsplashSrcSet } from '../lib/images'

/** How many menu items the landing page previews in its rail. */
const FEATURED_COUNT = 8

/** A warm hotel exterior at dusk. Width comes from the srcset, not this URL. */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=70'

/**
 * Public landing page.
 *
 * The job of this screen is to answer two questions in the first viewport:
 * can I get a room for the window I have in mind, and what does the kitchen
 * serve. Everything below the hero supports one of those.
 *
 * The search bar does not call the availability endpoint itself — it hands its
 * criteria to /book, which owns the whole booking flow (SRS §4.3) rather than
 * duplicating step one of it.
 */
export default function Landing() {
  const navigate = useNavigate()
  const toast = useToast()

  const [durations, setDurations] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [menu, setMenu] = useState([])
  const [testimonials, setTestimonials] = useState([])

  const [loadingRooms, setLoadingRooms] = useState(true)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [roomsError, setRoomsError] = useState(null)
  const [menuError, setMenuError] = useState(null)

  const [criteria, setCriteria] = useState(() => ({
    checkIn: toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    durationId: '',
    guests: 2,
  }))

  useEffect(() => {
    listDurations()
      .then((list) => {
        setDurations(list)
        setCriteria((current) => ({
          ...current,
          durationId: current.durationId || String(list[0]?.id ?? ''),
        }))
      })
      .catch((error) => toast.error(errorMessage(error, 'Could not load duration options.')))
  }, [toast])

  const loadRoomTypes = useMemo(
    () => () => {
      setLoadingRooms(true)
      setRoomsError(null)
      listRoomTypes()
        .then(setRoomTypes)
        .catch((error) => setRoomsError(errorMessage(error, 'Could not load our rooms.')))
        .finally(() => setLoadingRooms(false))
    },
    []
  )

  const loadMenu = useMemo(
    () => () => {
      setLoadingMenu(true)
      setMenuError(null)
      fetchMenu()
        .then(setMenu)
        .catch((error) => setMenuError(errorMessage(error, 'Could not load the menu.')))
        .finally(() => setLoadingMenu(false))
    },
    []
  )

  useEffect(loadRoomTypes, [loadRoomTypes])
  useEffect(loadMenu, [loadMenu])

  // Guest comments live per room type, so the testimonial rail is assembled
  // from each type's recent reviews. No reviews yet is the normal state for a
  // new property — the section says so rather than inventing quotes.
  useEffect(() => {
    if (roomTypes.length === 0) return
    let cancelled = false

    Promise.all(
      roomTypes.map((roomType) =>
        getRatingSummary({ roomTypeId: roomType.id })
          .then((summary) =>
            (summary.recent ?? []).map((review) => ({ ...review, roomType: roomType.typeName }))
          )
          .catch(() => [])
      )
    ).then((groups) => {
      if (!cancelled) setTestimonials(groups.flat().slice(0, 9))
    })

    return () => {
      cancelled = true
    }
  }, [roomTypes])

  const featured = useMemo(
    () => menu.flatMap((category) => category.items ?? []).slice(0, FEATURED_COUNT),
    [menu]
  )

  function onSearch(event) {
    event.preventDefault()
    const params = new URLSearchParams({
      checkIn: criteria.checkIn,
      durationId: criteria.durationId,
      guests: String(criteria.guests),
    })
    navigate(`/book?${params.toString()}`)
  }

  return (
    <>
      <PageMeta
        title="Rooms by the hour, the day or the night"
        description="Book a room for two hours or a full day and night, and order from the kitchen — dine-in, takeaway, delivery or room service. One bill at checkout."
      />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10">
          {/* The hero is the largest thing on the first screen and the image the
              whole page is judged on, so it loads eagerly at high priority and
              offers the browser a ladder — a phone has no use for the 2000px
              file the desktop needs. */}
          <img
            src={HERO_IMAGE}
            srcSet={unsplashSrcSet(HERO_IMAGE)}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
          {/* Two stacked gradients: one for text contrast at the top-left, one
              to seat the search card against the section below (spec §9 AA). */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/70 to-primary-900/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900/60 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 sm:pb-24 sm:pt-32 lg:px-8 lg:pt-40">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-300">
              Rooms by the hour, the day or the night
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] text-white sm:text-5xl">
              Book a room. Order the food. One bill at checkout.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              Pick from seven fixed durations — from two hours to a full day and night — and add
              room service to your stay. Dine-in, takeaway and delivery are open to everyone.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="accent" size="lg" to="/rooms" iconRight={ArrowRight}>
                Find a room
              </Button>
              <Button
                variant="secondary"
                size="lg"
                to="/menu"
                className="border-white/30 bg-white/10 text-white backdrop-blur hover:border-white/50 hover:bg-white/20"
              >
                Browse the menu
              </Button>
            </div>
          </div>

          {/* ── Quick availability search ─────────────────────────────── */}
          <Card variant="elevated" className="mt-12 p-4 sm:mt-16 sm:p-5">
            <form onSubmit={onSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_.7fr_auto]">
              <div>
                <label
                  htmlFor="hero-checkin"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Check-in
                </label>
                <input
                  id="hero-checkin"
                  type="datetime-local"
                  required
                  value={criteria.checkIn}
                  onChange={(event) =>
                    setCriteria((current) => ({ ...current, checkIn: event.target.value }))
                  }
                  className="h-11 w-full rounded border border-neutral-300 bg-white px-3 text-sm text-neutral-900 transition-colors duration-hover hover:border-neutral-400"
                />
              </div>

              <div>
                <label
                  htmlFor="hero-duration"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Duration
                </label>
                <SelectControl
                  id="hero-duration"
                  size="lg"
                  className="h-11"
                  value={criteria.durationId}
                  onChange={(event) =>
                    setCriteria((current) => ({ ...current, durationId: event.target.value }))
                  }
                  options={durations.map((duration) => ({
                    value: String(duration.id),
                    label: duration.name,
                  }))}
                  placeholder={durations.length === 0 ? 'Loading…' : undefined}
                />
              </div>

              <div>
                <label
                  htmlFor="hero-guests"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Guests
                </label>
                <input
                  id="hero-guests"
                  type="number"
                  min={1}
                  max={20}
                  value={criteria.guests}
                  onChange={(event) =>
                    setCriteria((current) => ({ ...current, guests: event.target.value }))
                  }
                  className="h-11 w-full rounded border border-neutral-300 bg-white px-3 text-sm text-neutral-900 transition-colors duration-hover hover:border-neutral-400"
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" variant="primary" size="lg" iconLeft={Search} fullWidth className="h-11">
                  Search
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </section>

      {/* ── Room types ─────────────────────────────────────────────────── */}
      <Section
        eyebrow="Where you'll stay"
        title="Four ways to stay"
        description="Every room is priced per duration, so a two-hour stop costs what a two-hour stop should."
        action={
          <Button variant="ghost" to="/rooms" iconRight={ArrowRight}>
            All rooms
          </Button>
        }
      >
        {loadingRooms ? (
          <SkeletonGroup label="Loading room types" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </SkeletonGroup>
        ) : roomsError ? (
          <InlineError message={roomsError} onRetry={loadRoomTypes} />
        ) : roomTypes.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="No rooms published yet"
            description="Room types will appear here once the property has been set up."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roomTypes.map((roomType) => (
              <RoomTypeCard
                key={roomType.id}
                roomType={roomType}
                to={`/rooms?type=${roomType.id}`}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── Featured menu ──────────────────────────────────────────────── */}
      <Section
        tinted
        eyebrow="From the kitchen"
        title="Cooked to order, all day"
        description="Dine in, take it away, have it delivered — or charge it to your room while you're staying."
        action={
          <Button variant="ghost" to="/menu" iconRight={ArrowRight}>
            Full menu
          </Button>
        }
      >
        {loadingMenu ? (
          <SkeletonGroup label="Loading the menu" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} aspect="aspect-[4/3]" />
            ))}
          </SkeletonGroup>
        ) : menuError ? (
          <InlineError message={menuError} onRetry={loadMenu} />
        ) : featured.length === 0 ? (
          <EmptyState
            icon={ConciergeBell}
            title="The menu is being prepared"
            description="Dishes will appear here as soon as the kitchen publishes them."
          />
        ) : (
          <ScrollRail label="Featured dishes">
            {featured.map((food) => (
              <div key={food.id} className="w-64 shrink-0 snap-start">
                <FoodCard food={food} />
              </div>
            ))}
          </ScrollRail>
        )}
      </Section>

      {/* ── Why choose us ──────────────────────────────────────────────── */}
      <Section
        eyebrow="Why guests book direct"
        title="Built around how you actually stay"
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <Feature
            icon={Clock3}
            title="Pay for the hours you need"
            description="Seven fixed durations from two hours to a full day and night. No forced overnight minimum, no hourly guesswork."
          />
          <Feature
            icon={ConciergeBell}
            title="Room service while you're in"
            description="Order from the same kitchen the restaurant runs on, and have it billed straight to your room."
          />
          <Feature
            icon={ReceiptText}
            title="One bill at checkout"
            description="Room charges, food and taxes settle together. Coupons apply before tax, exactly as quoted."
          />
        </div>
      </Section>

      {/* ── Guest reviews ──────────────────────────────────────────────── */}
      <Section tinted eyebrow="Guest reviews" title="What guests say">
        {testimonials.length === 0 ? (
          <Card variant="default" className="p-8">
            <EmptyState
              icon={MessageSquareQuote}
              size="sm"
              title="No reviews yet"
              description="Reviews appear here once guests have completed a stay or an order. Yours could be the first."
              action={
                <Button variant="secondary" to="/rooms">
                  Find a room
                </Button>
              }
            />
          </Card>
        ) : (
          <ScrollRail label="Guest reviews">
            {testimonials.map((review) => (
              <div key={review.id} className="w-80 shrink-0 snap-start">
                <Testimonial review={review} />
              </div>
            ))}
          </ScrollRail>
        )}
      </Section>

      {/* ── Closing CTA band ───────────────────────────────────────────── */}
      <section className="bg-primary-800">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-16">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold text-white">
              Your room is two minutes away
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/70">
              Check availability for any window from two hours upwards. No account needed to look —
              only to book.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="accent" size="lg" to="/book" iconRight={ArrowRight}>
              Check availability
            </Button>
            <Button
              variant="secondary"
              size="lg"
              to="/order"
              className="border-white/30 bg-transparent text-white hover:border-white/50 hover:bg-white/10"
            >
              Order food
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

/** Consistent section rhythm: eyebrow, heading, optional action, content. */
function Section({ eyebrow, title, description, action, tinted = false, children }) {
  return (
    <section className={cn(tinted ? 'bg-white' : 'bg-neutral-50')}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-600">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-2 font-display text-3xl font-semibold text-neutral-900">{title}</h2>
            {description && (
              <p className="mt-2 text-base leading-relaxed text-neutral-500">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>

        {children}
      </div>
    </section>
  )
}

function Feature({ icon: Icon, title, description }) {
  return (
    <Card variant="default" padding="lg" className="h-full">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-accent-50 text-accent-600">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">{description}</p>
    </Card>
  )
}

function Testimonial({ review }) {
  return (
    <Card variant="default" padding="lg" className="h-full">
      <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={15}
            aria-hidden="true"
            className={
              index < review.rating ? 'fill-accent-400 text-accent-400' : 'text-neutral-200'
            }
          />
        ))}
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-neutral-700">
        {review.comment || 'Rated without a comment.'}
      </blockquote>
      <footer className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
        <Users size={13} aria-hidden="true" />
        <span>{review.customerName ?? 'Verified guest'}</span>
        {review.roomType && <span>· {review.roomType}</span>}
        {review.createdAt && <span>· {dateOnly(review.createdAt)}</span>}
      </footer>
    </Card>
  )
}

/**
 * Horizontal snap rail with arrow controls on pointer devices.
 *
 * The arrows are supplementary — the rail is natively scrollable and
 * keyboard-reachable via its focusable children — so they are hidden from
 * assistive tech rather than duplicating the same navigation.
 */
function ScrollRail({ label, children }) {
  const railRef = useRef(null)

  function scrollBy(direction) {
    railRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <ul
        ref={railRef}
        aria-label={label}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
        {Array.isArray(children)
          ? children.map((child, index) => <li key={index} className="contents">{child}</li>)
          : children}
      </ul>

      <div className="mt-4 flex justify-end gap-2 sm:mt-0 sm:justify-start">
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => scrollBy(-1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition-colors duration-hover hover:border-neutral-400 hover:text-neutral-900"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => scrollBy(1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition-colors duration-hover hover:border-neutral-400 hover:text-neutral-900"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
