import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <Topbar title="Settings" userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-6 max-w-2xl">
        <div>
          <h1
            className="text-xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Manage API connections and platform configuration.
          </p>
        </div>

        <SettingsClient />
      </div>
    </>
  )
}
