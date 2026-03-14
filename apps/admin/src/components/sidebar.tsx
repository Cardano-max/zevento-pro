'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Route,
  MapPin,
  CreditCard,
  Percent,
  Grid3x3,
  Users,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/lib/auth-store';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Vendors', href: '/vendors', icon: Store },
  { label: 'Leads', href: '/leads', icon: Route },
  { label: 'Markets', href: '/markets', icon: MapPin },
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Commissions', href: '/commission-rates', icon: Percent },
  { label: 'Categories', href: '/categories', icon: Grid3x3 },
  { label: 'Users', href: '/users', icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-slate-900">
      <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <span className="text-sm font-bold text-white">Z</span>
        </div>
        <span className="text-lg font-semibold text-white">Zevento Pro</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

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
