'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  UserCheck,
  Wallet,
  Settings,
  ExternalLink,
  LogOut,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type Salon, type SessionUser } from '@/lib/types/domain';

interface GestaoShellProps {
  title: string;
  children: (ctx: { user: SessionUser; salon: Salon | null }) => React.ReactNode;
}

export default function GestaoShell({ title, children }: GestaoShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('unauthorized');
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        if (json.user?.role === 'SUPER_ADMIN' && !json.user?.salonId) {
          router.replace('/admin');
          return;
        }
        setUser(json.user);
        setSalon(json.salon);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#fafafc] flex items-center justify-center">
        <p className="text-sm text-zinc-500">A validar sessão...</p>
      </div>
    );
  }

  const navItems = [
    { href: '/gestao', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { href: '/gestao/agenda', label: 'Agenda', icon: CalendarDays, visible: true },
    { href: '/gestao/clientes', label: 'Clientes', icon: Users, visible: user.role !== 'PROFESSIONAL' },
    { href: '/gestao/profissionais', label: 'Profissionais', icon: UserCheck, visible: user.role !== 'PROFESSIONAL' },
    { href: '/gestao/servicos', label: 'Serviços', icon: Scissors, visible: user.role !== 'PROFESSIONAL' },
    {
      href: '/gestao/financeiro',
      label: 'Financeiro & Caixa',
      icon: Wallet,
      visible: user.role === 'OWNER' || user.role === 'RECEPTIONIST' || user.role === 'SUPER_ADMIN',
    },
    {
      href: '/gestao/configuracoes',
      label: 'Configurações',
      icon: Settings,
      visible: user.role === 'OWNER' || user.role === 'SUPER_ADMIN',
    },
    {
      href: '/admin',
      label: 'Admin Plataforma',
      icon: Shield,
      visible: user.role === 'SUPER_ADMIN',
    },
  ].filter((item) => item.visible);

  return (
    <div className="min-h-screen bg-[#fafafc] text-zinc-900 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-zinc-200 bg-white shrink-0">
        <div className="p-5 border-b border-zinc-200">
          <Link href="/" className="font-[family-name:var(--font-jakarta)] text-lg font-bold tracking-tight text-zinc-900">
            Salão<span className="text-violet-700">+</span>
          </Link>
          <p className="text-xs text-zinc-500 mt-1 truncate">{salon?.name || 'Gestão'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-violet-50 text-violet-800'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 space-y-3">
          {salon && (
            <Link
              href={`/salao/${salon.slug}`}
              target="_blank"
              className="flex items-center justify-between px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50/70 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <span className="truncate">Página Pública</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </Link>
          )}
          <div className="px-1">
            <p className="text-xs font-semibold text-zinc-900 truncate">{user.name}</p>
            <p className="text-[11px] text-zinc-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* Drawer Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white h-full border-r border-zinc-200 flex flex-col z-50">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
              <span className="font-[family-name:var(--font-jakarta)] text-lg font-bold">
                Salão<span className="text-violet-700">+</span>
              </span>
              <button type="button" onClick={() => setMobileOpen(false)} className="p-1 text-zinc-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg ${
                      active ? 'bg-violet-50 text-violet-800' : 'text-zinc-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-zinc-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                Terminar sessão
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-zinc-200 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-zinc-200 text-zinc-700"
              aria-label="Abrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm text-zinc-500 flex items-center gap-2 truncate">
              <span className="hidden sm:inline">{salon?.name || 'Salão+'}</span>
              <span className="hidden sm:inline text-zinc-300">/</span>
              <h1 className="font-[family-name:var(--font-jakarta)] font-semibold text-zinc-900 truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {salon && (
              <Link
                href={`/salao/${salon.slug}`}
                target="_blank"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
              >
                Ver Booking Público
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <Link
              href="/gestao/agenda"
              className="px-3.5 py-1.5 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800 whitespace-nowrap"
            >
              Nova Marcação
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children({ user, salon })}</main>
      </div>
    </div>
  );
}
