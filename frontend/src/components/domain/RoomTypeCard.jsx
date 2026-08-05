import { ArrowRight, Users } from 'lucide-react'

import cn from '../../lib/cn'
import { money } from '../../lib/format'
import { Badge, Button, Card, Image } from '../ui'

/**
 * A room type as a saleable card: photo, name, capacity, amenities, from-price.
 *
 * "From" price is the cheapest configured rate across the seven durations, not
 * a nightly rate — this property sells two-hour stays as readily as full nights
 * (SRS §5.1), so quoting one duration's price would mislead.
 *
 * Amenities arrive as a comma-separated string from the API and are shown as
 * chips, capped so a type with ten of them does not out-height its neighbours
 * in a grid.
 */

const MAX_AMENITY_CHIPS = 3

export function fromPrice(rates) {
  const values = Object.values(rates ?? {})
    .filter((rate) => rate !== null && rate !== undefined && rate !== '')
    .map(Number)
    .filter((rate) => Number.isFinite(rate) && rate > 0)

  return values.length > 0 ? Math.min(...values) : null
}

export default function RoomTypeCard({ roomType, to, action, className }) {
  const amenities = (roomType.amenities ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const extra = Math.max(0, amenities.length - MAX_AMENITY_CHIPS)
  const from = fromPrice(roomType.rates)

  return (
    <Card
      variant="default"
      interactive={Boolean(to)}
      className={cn('group flex h-full flex-col overflow-hidden', className)}
    >
      <Image
        src={roomType.imageUrl}
        alt={`${roomType.typeName} room`}
        aspect="aspect-[16/9]"
        rounded="rounded-none"
        // Four across at lg, two at sm, one on a phone.
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        maxWidth={768}
        imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-neutral-900">
            {roomType.typeName}
          </h3>
          <Badge tone="neutral" size="sm" icon={Users} dot={false}>
            {roomType.capacity}
          </Badge>
        </div>

        {amenities.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {amenities.slice(0, MAX_AMENITY_CHIPS).map((amenity) => (
              <li
                key={amenity}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
              >
                {amenity}
              </li>
            ))}
            {extra > 0 && (
              <li className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                +{extra} more
              </li>
            )}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-xs text-neutral-400">From</p>
            <p className="text-lg font-semibold text-neutral-900">
              {from === null ? 'On request' : money(from)}
            </p>
          </div>

          {action ?? (
            <Button variant="secondary" size="sm" to={to} iconRight={ArrowRight}>
              View
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
