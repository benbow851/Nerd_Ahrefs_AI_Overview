import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getClientBySlug, getClientUrls } from '@/lib/queries'
import Topbar from '@/components/layout/Topbar'
import UrlManagerClient from '@/components/client-detail/UrlManagerClient'

interface ManageUrlsPageProps {
  params: { clientSlug: string }
}

export default async function ManageUrlsPage({ params }: ManageUrlsPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const client = await getClientBySlug(supabase, params.clientSlug).catch(() => null)
  if (!client) notFound()

  const clientUrls = await getClientUrls(supabase, client.id).catch(() => [])

  return (
    <>
      <Topbar title={`${client.name} — URLs`} userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-5">
        {/* Back link */}
        <Link
          href={`/clients/${client.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          Back to {client.name}
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-bold text-[var(--text-primary)]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Manage URLs
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {clientUrls.length} URL{clientUrls.length !== 1 ? 's' : ''} configured for{' '}
              <span className="text-[var(--text-primary)]">{client.domain}</span>
            </p>
          </div>
        </div>

        {/* Client component handles add/edit form and table */}
        <UrlManagerClient client={client} initialUrls={clientUrls} />
      </div>
    </>
  )
}
