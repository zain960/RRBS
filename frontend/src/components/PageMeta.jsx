import { Helmet } from 'react-helmet-async'

/**
 * Per-route document title and description.
 *
 * Every routed screen renders one. Titles read "Page · RRBS" so a browser tab
 * or a bookmark identifies the page before it identifies the product, which is
 * what makes a row of tabs usable (spec §10).
 */
export default function PageMeta({ title, description, noIndex = false }) {
  return (
    <Helmet>
      <title>{title ? `${title} · RRBS` : 'RRBS — Rooms & restaurant'}</title>
      {description && <meta name="description" content={description} />}
      {/* The back office and a guest's own records should never be indexed. */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </Helmet>
  )
}
