import { Check, Minus, Plus, UtensilsCrossed } from 'lucide-react'

import cn from '../../lib/cn'
import { money } from '../../lib/format'
import { Badge, Button, Card, Image } from '../ui'

/**
 * A menu item.
 *
 * Two modes. Without `onAdd` it is a display card for the landing rail and the
 * public menu. With `onAdd` it grows a quantity stepper — and once `quantity`
 * is above zero the "Add" button is replaced in place rather than sitting
 * beside a separate counter, so the card never changes height mid-order.
 *
 * An unavailable item still renders (it may appear in a historical order) but
 * cannot be added, which is the rule from SRS §5.2 expressed in the UI.
 */
export default function FoodCard({
  food,
  quantity = 0,
  onAdd,
  onRemove,
  layout = 'vertical',
  className,
}) {
  const unavailable = food.availabilityStatus === 'UNAVAILABLE'
  const horizontal = layout === 'horizontal'

  return (
    <Card
      variant="default"
      className={cn(
        'group flex overflow-hidden',
        horizontal ? 'flex-row' : 'h-full flex-col',
        unavailable && 'opacity-70',
        className
      )}
    >
      <Image
        src={food.imageUrl}
        alt={food.name}
        aspect={horizontal ? 'aspect-square' : 'aspect-[4/3]'}
        rounded="rounded-none"
        className={horizontal ? 'w-28 shrink-0 sm:w-32' : 'w-full'}
        // Horizontal is a fixed 112/128px strip; vertical is a grid cell.
        sizes={horizontal ? '128px' : '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'}
        maxWidth={horizontal ? 384 : 768}
        fallbackIcon={UtensilsCrossed}
        imgClassName={cn(
          'transition-transform duration-500 ease-out',
          !unavailable && 'group-hover:scale-[1.03]'
        )}
      />

      <div className={cn('flex flex-1 flex-col p-4', horizontal && 'min-w-0')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-neutral-900">{food.name}</h3>
          {unavailable && (
            <Badge tone="neutral" size="sm" dot={false}>
              Sold out
            </Badge>
          )}
        </div>

        {food.description && (
          <p
            className={cn(
              'mt-1 text-sm leading-relaxed text-neutral-500',
              horizontal ? 'line-clamp-2' : 'line-clamp-2'
            )}
          >
            {food.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="font-semibold text-neutral-900">{money(food.price)}</p>

          {onAdd &&
            (quantity > 0 ? (
              <div className="flex items-center gap-1 rounded border border-neutral-300 p-0.5">
                <button
                  type="button"
                  onClick={() => onRemove(food)}
                  aria-label={`Remove one ${food.name}`}
                  className="grid h-7 w-7 place-items-center rounded-sm text-neutral-600 transition-colors duration-hover hover:bg-neutral-100"
                >
                  <Minus size={15} aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  className="min-w-6 text-center text-sm font-semibold text-neutral-900"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onAdd(food)}
                  aria-label={`Add one more ${food.name}`}
                  className="grid h-7 w-7 place-items-center rounded-sm text-neutral-600 transition-colors duration-hover hover:bg-neutral-100"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={unavailable ? Check : Plus}
                disabled={unavailable}
                onClick={() => onAdd(food)}
              >
                {unavailable ? 'Unavailable' : 'Add'}
              </Button>
            ))}
        </div>
      </div>
    </Card>
  )
}
