'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  CreditCard,
  Star,
  UserCircle,
  Package,
  Crown,
  LogOut,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/lib/auth-store';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Inbox', href: '/inbox', icon: Inbox },
  { label: 'Services', href: '/services', icon: Layers },
  { label: 'Bookings', href: '/bookings', icon: CreditCard },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'Reviews', href: '/reviews', icon: Star },
  { label: 'Profile', href: '/profile', icon: UserCircle },
  { label: 'Products', href: '/products', icon: Package, supplierOnly: true },
  { label: 'Subscription', href: '/subscription', icon: Crown },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.role);

  const filtered = navItems.filter(
    (item) => !('supplierOnly' in item && item.supplierOnly) || role === 'SUPPLIER'
  );

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-slate-900">
      <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
          <span className="text-sm font-bold text-white">Z</span>
        </div>
        <div>
          <span className="text-lg font-semibold text-white">Zevento</span>
          <span className="ml-1 rounded bg-emerald-600/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            {role === 'SUPPLIER' ? 'Supplier' : 'Planner'}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filtered.map((item) => {
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
                  ? 'bg-emerald-600 text-white'
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
