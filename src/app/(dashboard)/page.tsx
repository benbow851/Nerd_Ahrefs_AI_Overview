import { redirect } from 'next/navigation'

// (dashboard)/page.tsx handles the bare "/" path — send to /dashboard
export default function DashboardRootPage() {
  redirect('/dashboard')
}
