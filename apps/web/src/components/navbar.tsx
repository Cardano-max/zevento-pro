'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Sparkles, User, LogOut, ChevronDown, Users, Heart } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/vendors', label: 'Browse Vendors' },
  { href: '/plan', label: 'AI Planner', badge: 'AI' },
  { href: '/feed', label: 'Community', icon: Users },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const { isLoggedIn, user, logout, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [initialize]);

  const isHome = pathname === '/';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || !isHome
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-rose-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-700 to-rose-400 flex items-center justify-center shadow-md group-hover:shadow-rose-300 transition-shadow">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span
              className={`text-xl font-bold tracking-tight transition-colors ${
                scrolled || !isHome ? 'text-rose-800' : 'text-white'
              }`}
            >
              Zevento
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              const Icon = (link as any).icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-rose-700 text-white shadow-md'
                      : scrolled || !isHome
                      ? 'text-gray-700 hover:bg-rose-50 hover:text-rose-700'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {link.label}
                  {link.badge && (
                    <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full leading-none">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            {isLoggedIn && (
              <Link
                href="/favorites"
                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  pathname === '/favorites'
                    ? 'bg-rose-700 text-white shadow-md'
                    : scrolled || !isHome
                    ? 'text-gray-700 hover:bg-rose-50 hover:text-rose-700'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                Saved
              </Link>
            )}
          </div>

          {/* Auth Button */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(!userMenu)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    scrolled || !isHome
                      ? 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <span className="max-w-24 truncate">{user?.name || 'My Account'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {userMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-rose-100 py-2 animate-scale-in">
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <User className="w-4 h-4" />
                      My Dashboard
                    </Link>
                    <hr className="my-1 border-rose-50" />
                    <button
                      onClick={() => { logout(); setUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-rose-700 to-rose-500 text-white shadow-md hover:shadow-rose-300 hover:scale-105 transition-all"
              >
                Get Started
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setOpen(!open)}
            className={`md:hidden p-2 rounded-xl transition-colors ${
              scrolled || !isHome
                ? 'text-gray-700 hover:bg-rose-50'
                : 'text-white hover:bg-white/10'
            }`}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-rose-100 shadow-xl animate-fade-in">
          <div className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = (link as any).icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-rose-700 text-white'
                      : 'text-gray-700 hover:bg-rose-50'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {link.label}
                  {link.badge && (
                    <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            {isLoggedIn && (
              <Link
                href="/favorites"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  pathname === '/favorites'
                    ? 'bg-rose-700 text-white'
                    : 'text-gray-700 hover:bg-rose-50'
                }`}
              >
                <Heart className="w-4 h-4" />
                Saved Vendors
              </Link>
            )}
            <hr className="my-2 border-rose-100" />
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-rose-50"
                >
                  <User className="w-4 h-4" />
                  My Dashboard
                </Link>
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mx-0 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-700 to-rose-500 text-white text-center"
              >
                Get Started Free
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
