/**
 * Responsive image sources.
 *
 * Every photo in the app is an Unsplash CDN URL carrying an explicit `w=`
 * parameter, and the seed picks one width per image — 1200px for a room, 800px
 * for a dish. That width is wrong almost everywhere it is used: the same room
 * photo is a 300px card on the public grid and a 64px thumbnail in the admin
 * table, so the browser was downloading up to nineteen times the pixels it
 * needed and the page felt slow on a cold load.
 *
 * Rewriting `w=` across a ladder of widths lets the browser pick, which is what
 * `srcset` is for. It also covers high-DPR screens for free: a 64px thumbnail on
 * a 2x display asks for the 128px entry rather than a blurry upscale.
 *
 * Only Unsplash URLs are touched. Anything else — a future uploaded photo on our
 * own storage — passes through untouched and keeps working.
 */

/** The ladder offered to the browser. Small steps at the bottom: most images in the back office are thumbnails. */
const WIDTHS = [64, 128, 256, 384, 512, 768, 1024, 1400, 2000]

/**
 * A `srcset` for an Unsplash URL, or `undefined` for anything else.
 *
 * `maxWidth` caps the ladder where a larger file could never be used — there is
 * no point offering 2000px for a thumbnail.
 */
export function unsplashSrcSet(src, { maxWidth = 2000 } = {}) {
  if (!src) return undefined

  let url
  try {
    url = new URL(src)
  } catch {
    return undefined
  }

  if (url.hostname !== 'images.unsplash.com') return undefined

  return WIDTHS.filter((width) => width <= maxWidth)
    .map((width) => {
      const variant = new URL(url)
      variant.searchParams.set('w', String(width))
      return `${variant.toString()} ${width}w`
    })
    .join(', ')
}
