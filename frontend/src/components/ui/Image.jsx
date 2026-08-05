import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import cn from '../../lib/cn'
import { unsplashSrcSet } from '../../lib/images'

/**
 * Image with a skeleton while it loads and a graceful fallback when it breaks.
 *
 * Every photo in the app is a remote Unsplash URL, so both failure modes are
 * real: a slow load leaves a hole in the layout, and a dead URL leaves a broken
 * icon. The wrapper reserves the aspect ratio up front, so neither one shifts
 * the page (spec §7).
 *
 * `sizes` is how wide the image actually renders, in CSS terms — pass it
 * whenever the image is not full viewport width, or the browser assumes `100vw`
 * and fetches a far larger file than the slot needs. `maxWidth` caps the
 * `srcset` ladder for a thumbnail that could never use a large file.
 *
 * `priority` is for an image that is the largest thing on the first screen (the
 * landing hero): it loads eagerly at high fetch priority, because lazy-loading
 * the one image the page is judged on only delays it.
 *
 * `alt` is required by convention. Pass `alt=""` for a purely decorative image
 * — an empty alt tells a screen reader to skip it, which is right for a
 * background, and wrong for a room photo.
 */
export default function Image({
  src,
  alt = '',
  aspect = 'aspect-[16/9]',
  rounded = 'rounded-lg',
  sizes,
  maxWidth,
  priority = false,
  className,
  imgClassName,
  fallbackIcon: FallbackIcon = ImageOff,
  ...props
}) {
  const [status, setStatus] = useState(src ? 'loading' : 'error')

  // A card that swaps its data (menu filter, pagination) keeps the same DOM
  // node, so the status has to follow the src or the new image stays hidden
  // behind the old one's "loaded" state.
  useEffect(() => {
    setStatus(src ? 'loading' : 'error')
  }, [src])

  return (
    <div className={cn('relative overflow-hidden bg-neutral-100', aspect, rounded, className)}>
      {status === 'loading' && <span className="skeleton absolute inset-0" aria-hidden="true" />}

      {status === 'error' ? (
        <span className="absolute inset-0 grid place-items-center text-neutral-300">
          <FallbackIcon size={28} aria-hidden="true" />
        </span>
      ) : (
        <img
          src={src}
          srcSet={unsplashSrcSet(src, { maxWidth })}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-state',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName
          )}
          {...props}
        />
      )}
    </div>
  )
}
