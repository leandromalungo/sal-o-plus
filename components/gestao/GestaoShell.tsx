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
  Menu,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type Salon, type SessionUser } from '@/lib/types/domain';
import { AUTH_LAYERS, SALON_STAFF_LAYERS, type AuthLayer } from '@/lib/auth/layers';

interface GestaoShellProps {
  title: string;
  children: (ctx: { user: SessionUser; salon: Salon | null }) => React.ReactNode;
}

const TAB_LAYER_KEY = 'salaomais_tab_layer';

function isSalonStaffLayer(value: string | null): value is AuthLayer {
  return value !== null && (SALON_STAFF_LAYERS as string[]).includes(value);
}

export default function GestaoShell({ title, children }: GestaoShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeLayer, setActiveLayer] = useState<AuthLayer>('gestao');
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const urlLayer = params.get('layer');
    const storedLayer = window.sessionStorage.getItem(TAB_LAYER_KEY);
    const preferredLayer = isSalonStaffLayer(urlLayer)
      ? urlLayer
      : isSalonStaffLayer(storedLayer)
      ? storedLayer
      : null;

    if (preferredLayer) {
      window.sessionStorage.setItem(TAB_LAYER_KEY, preferredLayer);
    }

    const meUrl = preferredLayer ? `/api/auth/me?layer=${preferredLayer}` : '/api/auth/me';
    fetch(meUrl, {
      headers: preferredLayer ? { 'x-salao-layer': preferredLayer } : undefined,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('unauthorized');
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        const resolvedLayer: AuthLayer = isSalonStaffLayer(json.layer) ? json.layer : 'gestao';
        if (json.user?.role === 'SUPER_ADMIN' && !json.user?.salonId) {
          router.replace('/login/admin');
          return;
        }
        if (json.user?.role === 'PROFESSIONAL') {
          const allowedProPaths = ['/gestao', '/gestao/agenda'];
          if (!allowedProPaths.includes(window.location.pathname)) {
            router.replace('/gestao/agenda');
            return;
          }
        }
        if (json.user?.role === 'RECEPTIONIST' && window.location.pathname === '/gestao/configuracoes') {
          router.replace('/gestao/agenda');
          return;
        }
        window.sessionStorage.setItem(TAB_LAYER_KEY, resolvedLayer);
        setActiveLayer(resolvedLayer);
        setUser(json.user);
        setSalon(json.salon);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        router.replace(preferredLayer ? AUTH_LAYERS[preferredLayer].loginPath : '/login');
      });
    return () => {
      active = false;
    };
  }, [router]);

  // Injeta x-salao-layer em chamadas /api/gestao/* desta aba para manter múltiplas camadas isoladas simultaneamente
  useEffect(() => {
    if (!user) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      if (url.startsWith('/api/gestao') || url.startsWith('/api/auth/')) {
        const nextHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!nextHeaders.has('x-salao-layer')) {
          nextHeaders.set('x-salao-layer', activeLayer);
        }
        return originalFetch(input, { ...init, headers: nextHeaders });
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [user, activeLayer]);

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layer: activeLayer }),
    });
    window.sessionStorage.removeItem(TAB_LAYER_KEY);
    router.push(AUTH_LAYERS[activeLayer].loginPath);
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
