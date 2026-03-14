'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Navigation,
  MapPin,
  CreditCard,
  Percent,
  LayoutGrid,
  Users,
  LogOut,
  MessageSquare,
  Flag,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/lib/auth-store';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Users', href: '/users', icon: Users },
      { label: 'Vendors', href: '/vendors', icon: Store },
      { label: 'Leads', href: '/leads', icon: Navigation },
      { label: 'Bookings', href: '/bookings', icon: CalendarDays },
      { label: 'Markets', href: '/markets', icon: MapPin },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Feed Moderation', href: '/feed', icon: MessageSquare },
      { label: 'Reports', href: '/reports', icon: Flag },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payments', href: '/payments', icon: CreditCard },
      { label: 'Commissions', href: '/commission-rates', icon: Percent },
      { label: 'Categories', href: '/categories', icon: LayoutGrid },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return (pathname ?? '').startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <span className="text-sm font-bold text-white">Z</span>
        </div>
        <span className="text-lg font-semibold text-white">Zevento Pro</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section, sectionIdx) => (
          <div key={section.title} className={cn('space-y-1', sectionIdx > 0 && 'mt-6')}>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}
