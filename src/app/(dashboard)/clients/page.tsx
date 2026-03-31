import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getClientsWithLatestSnapshot } from '@/lib/queries'
import Topbar from '@/components/layout/Topbar'
import ClientListFilter from '@/components/dashboard/ClientListFilter'

export default async function ClientsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const clients = await getClientsWithLatestSnapshot(supabase).catch(() => [])

  return (
    <>
      <Topbar title="Projects" userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold text-[var(--text-primary)]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            All Projects
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
              ({clients.length})
            </span>
          </h2>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--blue)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Plus size={15} strokeWidth={2} />
            New Project
          </Link>
        </div>

        <ClientListFilter clients={clients} />
      </div>
    </>
  )
}
