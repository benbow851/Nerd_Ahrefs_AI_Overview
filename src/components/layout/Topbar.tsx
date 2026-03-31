'use client';

interface TopbarProps {
  title: string;
  userEmail: string;
}

function getCurrentMonthLabel(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function Topbar({ title, userEmail }: TopbarProps) {
  const monthLabel = getCurrentMonthLabel();
  const avatarLetter = userEmail.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
      {/* Page title */}
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Month badge */}
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--blue)]/10 text-[var(--blue)]">
          {monthLabel}
        </span>

        {/* User avatar */}
        <div
          className="w-8 h-8 rounded-full bg-[var(--blue)] flex items-center justify-center text-white text-xs font-semibold shrink-0"
          title={userEmail}
        >
          {avatarLetter}
        </div>
      </div>
    </header>
  );
}
