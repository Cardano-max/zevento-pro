'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useAuthStore } from '@/lib/auth-store';

export function VendorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const initialize = useAuthStore((s) => s.initialize);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    initialize();
    setChecked(true);
  }, [initialize]);

  useEffect(() => {
    if (checked && !isLoggedIn) {
      router.replace('/login');
    }
  }, [checked, isLoggedIn, router]);

  if (!checked || !isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 min-h-screen p-6">{children}</main>
    </div>
  );
}
