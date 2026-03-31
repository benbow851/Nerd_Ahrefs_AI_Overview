import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getClientsWithLatestSnapshot } from '@/lib/queries'
import Topbar from '@/components/layout/Topbar'
import { SummaryStats } from '@/components/dashboard/SummaryStats'
import ClientListFilter from '@/components/dashboard/ClientListFilter'

export default async function DashboardPage() {
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
      <Topbar title="Dashboard Overview" userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-6">
        {/* Summary KPI cards */}
        <SummaryStats clients={clients} />

        {/* All projects */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              className="text-base font-semibold text-[var(--text-primary)]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              All Projects
            </h2>
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--blue)] hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Plus size={15} strokeWidth={2} />
              New Project
            </Link>
          </div>

          {/* Search filter + table */}
          <ClientListFilter clients={clients} />
        </div>
      </div>
    </>
  )
}
