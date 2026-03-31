import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getClientBySlug } from '@/lib/queries'
import Topbar from '@/components/layout/Topbar'
import ProjectSettingsForm from '@/components/client-detail/ProjectSettingsForm'

interface EditClientPageProps {
  params: { clientSlug: string }
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const client = await getClientBySlug(supabase, params.clientSlug).catch(() => null)
  if (!client) notFound()

  return (
    <>
      <Topbar title={`Edit — ${client.name}`} userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        <Link
          href={`/clients/${client.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          Back to project
        </Link>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Pencil size={20} className="text-[var(--blue)]" strokeWidth={1.75} />
            <h1
              className="text-xl font-bold text-[var(--text-primary)]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Project settings
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            ชื่อโปรเจกต์ โดเมน และ KPI เป้าหมาย — แก้ไม่บ่อย; ค่า KPI ถูกเก็บไว้ใช้คำนวณบน Dashboard
            โดยไม่ต้อง Pull snapshot ใหม่
          </p>
        </div>

        <div className="card-nerd p-6">
          <ProjectSettingsForm
            clientSlug={client.slug}
            initial={{
              name: client.name,
              domain: client.domain,
              kpi_keyword_target: client.kpi_keyword_target ?? 30,
            }}
          />
        </div>
      </div>
    </>
  )
}
