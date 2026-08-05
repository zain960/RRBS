import { ArrowLeft, ShieldOff } from 'lucide-react'

import SplitScreen from '../components/layout/SplitScreen'
import PageMeta from '../components/PageMeta'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'

/**
 * 403.
 *
 * Reached when a signed-in user opens a screen their role does not cover. The
 * copy names the role they actually hold, because "access denied" with no
 * explanation reads as a bug to someone who is legitimately signed in.
 *
 * The API enforces the same rule independently; this screen only explains it.
 */
export default function Forbidden() {
  const { role, isAuthenticated } = useAuth()

  return (
    <>
      <PageMeta title="Access denied" noIndex />

      <SplitScreen
        image="https://images.unsplash.com/photo-1621293954908-907159247fc8?auto=format&fit=crop&w=1400&q=70"
        quote="Each role sees the screens it needs, and no more."
        attribution="Role-based access, SRS §3"
      >
        <span className="grid h-14 w-14 place-items-center rounded-xl bg-red-50 text-danger">
          <ShieldOff size={26} aria-hidden="true" />
        </span>

        <h1 className="mt-6 font-display text-3xl font-semibold text-neutral-900">
          You don't have access to this screen
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          {isAuthenticated ? (
            <>
              You're signed in as{' '}
              <span className="font-medium text-neutral-700">{role ?? 'a guest'}</span>, and this
              screen is limited to other roles. If you think that's wrong, ask a Super Admin to
              review your permissions.
            </>
          ) : (
            'Sign in with an account that has permission for this screen.'
          )}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" to={isAuthenticated ? '/admin' : '/login'} iconLeft={ArrowLeft}>
            {isAuthenticated ? 'Back to the back office' : 'Sign in'}
          </Button>
          <Button variant="secondary" size="lg" to="/">
            Guest site
          </Button>
        </div>
      </SplitScreen>
    </>
  )
}
