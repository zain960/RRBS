import { BedDouble, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { listDurations } from '../api/bookings'
import { errorMessage } from '../api/client'
import { listRoomTypes } from '../api/roomTypes'
import RoomTypeCard, { fromPrice } from '../components/domain/RoomTypeCard'
import PageMeta from '../components/PageMeta'
import {
  Button,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  ErrorState,
  SelectControl,
  SkeletonCard,
  SkeletonGroup,
} from '../components/ui'
import cn from '../lib/cn'
import { money } from '../lib/format'

/**
 * Room browsing.
 *
 * This screen sells room *types*, not individual rooms — a guest picks "Deluxe"
 * and the booking flow assigns a free room of that type against a real time
 * window (SRS §4.3). So there is no live availability here: filtering by date
 * belongs in /book, and promising availability on a page with no date selected
 * would be a promise the system cannot keep.
 *
 * Filters live in the URL so a filtered view can be linked and survives a
 * refresh — the landing page's room cards deep-link straight into it.
 */

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'capacity-desc', label: 'Sleeps most' },
]

const GUEST_OPTIONS = [
  { value: '', label: 'Any number' },
  { value: '2', label: '2 or more' },
  { value: '3', label: '3 or more' },
  { value: '4', label: '4 or more' },
  { value: '6', label: '6 or more' },
]

export default function Rooms() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [roomTypes, setRoomTypes] = useState([])
  const [durations, setDurations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const selectedTypes = useMemo(
    () => new Set((searchParams.get('type') ?? '').split(',').filter(Boolean)),
    [searchParams]
  )
  const minGuests = searchParams.get('guests') ?? ''
  const durationId = searchParams.get('durationId') ?? ''
  const sort = searchParams.get('sort') ?? 'recommended'
  const maxPrice = searchParams.get('maxPrice') ?? ''

  const load = useMemo(
    () => () => {
      setLoading(true)
      setError(null)
      listRoomTypes()
        .then(setRoomTypes)
        .catch((err) => setError(errorMessage(err, 'Could not load our rooms.')))
        .finally(() => setLoading(false))
    },
    []
  )

  useEffect(load, [load])

  useEffect(() => {
    listDurations().then(setDurations).catch(() => setDurations([]))
  }, [])

  function patchParams(patch) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value === null || value === undefined) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  function toggleType(id) {
    const next = new Set(selectedTypes)
    if (next.has(String(id))) next.delete(String(id))
    else next.add(String(id))
    patchParams({ type: [...next].join(',') })
  }

  /**
   * The price a card is filtered and sorted by. When a duration is selected we
   * compare that duration's rate; otherwise the cheapest rate the type offers,
   * which is what the card itself displays as "from".
   */
  function priceFor(roomType) {
    if (durationId) {
      const duration = durations.find((entry) => String(entry.id) === durationId)
      const rateKey = RATE_KEY_BY_HOURS[duration?.name]
      const rate = rateKey ? roomType.rates?.[rateKey] : null
      if (rate !== null && rate !== undefined && rate !== '') return Number(rate)
    }
    return fromPrice(roomType.rates)
  }

  const visible = useMemo(() => {
    let list = roomTypes.filter((roomType) => {
      if (selectedTypes.size > 0 && !selectedTypes.has(String(roomType.id))) return false
      if (minGuests && roomType.capacity < Number(minGuests)) return false
      if (maxPrice) {
        const price = priceFor(roomType)
        if (price !== null && price > Number(maxPrice)) return false
      }
      return true
    })

    list = [...list]
    if (sort === 'price-asc') {
      list.sort((a, b) => (priceFor(a) ?? Infinity) - (priceFor(b) ?? Infinity))
    } else if (sort === 'price-desc') {
      list.sort((a, b) => (priceFor(b) ?? -Infinity) - (priceFor(a) ?? -Infinity))
    } else if (sort === 'capacity-desc') {
      list.sort((a, b) => b.capacity - a.capacity)
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypes, selectedTypes, minGuests, maxPrice, sort, durationId, durations])

  const priceCeiling = useMemo(() => {
    const prices = roomTypes.map((roomType) => fromPrice(roomType.rates)).filter(Boolean)
    return prices.length > 0 ? Math.ceil(Math.max(...prices) / 1000) * 1000 : 0
  }, [roomTypes])

  const activeCount =
    selectedTypes.size + (minGuests ? 1 : 0) + (maxPrice ? 1 : 0) + (durationId ? 1 : 0)

  const filterPanel = (
    <FilterPanel
      roomTypes={roomTypes}
      durations={durations}
      selectedTypes={selectedTypes}
      minGuests={minGuests}
      durationId={durationId}
      maxPrice={maxPrice}
      priceCeiling={priceCeiling}
      onToggleType={toggleType}
      onPatch={patchParams}
      onClear={() => setSearchParams({}, { replace: true })}
      activeCount={activeCount}
    />
  )

  return (
    <>
      <PageMeta
        title="Rooms"
        description="Browse Standard, Deluxe, Suite and Family rooms — priced per duration, from two hours to a full day and night."
      />

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-semibold text-neutral-900">Our rooms</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-500">
            Each type is priced for all seven durations. Pick one to check availability for the
            window you have in mind.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24">{filterPanel}</div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-500" aria-live="polite">
                {loading ? 'Loading rooms…' : `${visible.length} of ${roomTypes.length} room types`}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={SlidersHorizontal}
                  onClick={() => setFiltersOpen(true)}
                  className="lg:hidden"
                >
                  Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                </Button>

                <label htmlFor="sort" className="sr-only">
                  Sort rooms
                </label>
                <SelectControl
                  id="sort"
                  size="sm"
                  className="w-48"
                  value={sort}
                  onChange={(event) => patchParams({ sort: event.target.value })}
                  options={SORTS}
                />
              </div>
            </div>

            {loading ? (
              <SkeletonGroup label="Loading rooms" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </SkeletonGroup>
            ) : error ? (
              <Card>
                <ErrorState message={error} onRetry={load} />
              </Card>
            ) : visible.length === 0 ? (
              <Card>
                <EmptyState
                  icon={BedDouble}
                  title="No rooms match these filters"
                  description="Try widening the guest count or raising the price ceiling."
                  action={
                    <Button variant="secondary" onClick={() => setSearchParams({}, { replace: true })}>
                      Clear filters
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((roomType) => (
                  <RoomTypeCard
                    key={roomType.id}
                    roomType={roomType}
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        to={`/book?roomTypeId=${roomType.id}${
                          durationId ? `&durationId=${durationId}` : ''
                        }`}
                      >
                        Check dates
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Below lg the filters become a bottom sheet (spec §8). */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="bottom"
        title="Filters"
        footer={
          <Button fullWidth onClick={() => setFiltersOpen(false)}>
            Show {visible.length} room {visible.length === 1 ? 'type' : 'types'}
          </Button>
        }
      >
        {filterPanel}
      </Drawer>
    </>
  )
}

/** Duration names map to the fixed rate columns on a room type (SRS §5.1). */
const RATE_KEY_BY_HOURS = {
  '2 Hours': 'rate2hr',
  '4 Hours': 'rate4hr',
  '6 Hours': 'rate6hr',
  '8 Hours': 'rate8hr',
  'Full Day': 'rateFullDay',
  'Full Night': 'rateFullNight',
  'Day & Night': 'rateDayNight',
}

function FilterPanel({
  roomTypes,
  durations,
  selectedTypes,
  minGuests,
  durationId,
  maxPrice,
  priceCeiling,
  onToggleType,
  onPatch,
  onClear,
  activeCount,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Filter</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-neutral-500 transition-colors duration-hover hover:text-neutral-800"
          >
            <X size={13} aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      <FilterGroup label="Room type">
        <div className="space-y-2.5">
          {roomTypes.map((roomType) => (
            <Checkbox
              key={roomType.id}
              label={roomType.typeName}
              description={`Sleeps ${roomType.capacity} · from ${money(fromPrice(roomType.rates))}`}
              checked={selectedTypes.has(String(roomType.id))}
              onChange={() => onToggleType(roomType.id)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Guests">
        <SelectControl
          size="sm"
          value={minGuests}
          onChange={(event) => onPatch({ guests: event.target.value })}
          options={GUEST_OPTIONS}
          aria-label="Minimum guests"
        />
      </FilterGroup>

      <FilterGroup label="Duration">
        <SelectControl
          size="sm"
          value={durationId}
          onChange={(event) => onPatch({ durationId: event.target.value })}
          options={[
            { value: '', label: 'Any duration' },
            ...durations.map((duration) => ({
              value: String(duration.id),
              label: duration.name,
            })),
          ]}
          aria-label="Duration"
        />
        <p className="mt-1.5 text-xs text-neutral-400">
          Prices below reflect the duration you pick.
        </p>
      </FilterGroup>

      {priceCeiling > 0 && (
        <FilterGroup label="Maximum price">
          <input
            type="range"
            min={0}
            max={priceCeiling}
            step={500}
            value={maxPrice || priceCeiling}
            onChange={(event) =>
              onPatch({
                maxPrice:
                  Number(event.target.value) >= priceCeiling ? '' : event.target.value,
              })
            }
            aria-label="Maximum price"
            className="w-full accent-primary-800"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Up to {money(maxPrice || priceCeiling)}
          </p>
        </FilterGroup>
      )}
    </div>
  )
}

function FilterGroup({ label, children, className }) {
  return (
    <div className={cn('border-t border-neutral-200 pt-5 first:border-0 first:pt-0', className)}>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      {children}
    </div>
  )
}
