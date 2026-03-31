'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Plus, Settings, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  userEmail: string;
}

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/clients', icon: Users, label: 'Projects' },
  { href: '/clients/new', icon: Plus, label: 'New Project' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="hidden md:flex flex-col w-56 h-screen bg-[var(--bg-card)] border-r border-[var(--border)] shrink-0">
      {/* Brand */}
      <div className="px-5 py-6">
        <h1
          className="text-lg font-semibold text-[var(--text-primary)] tracking-tight"
          style={{ fontFamily: "'Mitr', sans-serif" }}
        >
          NerdOptimize
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          AI Overview · Ahrefs
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            pathname === href ||
            (href === '/clients'
              ? pathname.startsWith('/clients/') && pathname !== '/clients/new'
              : pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--blue)]/20 text-[var(--blue)] border-r-2 border-[var(--blue)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5',
              ].join(' ')}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-[var(--border)]">
        <p
          className="text-xs text-[var(--text-secondary)] truncate mb-3"
          title={userEmail}
        >
          {userEmail}
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </aside>
  );
}
