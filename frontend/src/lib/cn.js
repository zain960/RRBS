/**
 * Conditional class names.
 *
 * Deliberately tiny — the component library only ever needs to drop falsey
 * branches and flatten, not resolve Tailwind conflicts. Components put their
 * own classes first and spread `className` last, so a caller's override wins by
 * source order.
 */
export default function cn(...parts) {
  return parts
    .flat(Infinity)
    .filter(Boolean)
    .join(' ')
    .trim()
}
