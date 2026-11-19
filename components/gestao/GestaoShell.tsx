'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Asterisk,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Scissors,
  Settings,
  UserCheck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_LABELS, type Salon, type SessionUser } from '@/lib/types/domain';
import { AUTH_LAYERS, SALON_STAFF_LAYERS, type AuthLayer } from '@/lib/auth/layers';
import { googleSignOut } from '@/lib/auth/google-client';

interface GestaoShellProps {
  title: string;
  pendingCount?: number;
  children: (ctx: { user: SessionUser; salon: Salon | null }) => React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
  badge?: number;
}

const TAB_LAYER_KEY = 'salaomais_tab_layer';

function isSalonStaffLayer(value: string | null): value is AuthLayer {
  return value !== null && (SALON_STAFF_LAYERS as string[]).includes(value);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export default function GestaoShell({ title, pendingCount, children }: GestaoShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeLayer, setActiveLayer] = useState<AuthLayer>('gestao');
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
      credentials: 'include',
      cache: 'no-store',
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
        if (
          json.user?.role === 'RECEPTIONIST' &&
          window.location.pathname === '/gestao/configuracoes'
        ) {
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

  useEffect(() => {
    if (!user) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      if (url.startsWith('/api/gestao') || url.startsWith('/api/auth/')) {
        const nextHeaders = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined)
        );
        if (!nextHeaders.has('x-salao-layer')) {
          nextHeaders.set('x-salao-layer', activeLayer);
        }
        return originalFetch(input, {
          credentials: 'include',
          ...init,
          headers: nextHeaders,
        });
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [user, activeLayer]);

  async function handleLogout() {
    await googleSignOut();
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layer: activeLayer }),
    });
    window.sessionStorage.removeItem(TAB_LAYER_KEY);
    router.push(AUTH_LAYERS[activeLayer].loginPath);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#EDF2F3] flex items-center justify-center p-4">
        <div className="bg-white border border-zinc-200/80 rounded-2xl px-6 py-4 shadow-xs text-sm text-zinc-600">
          A validar sessão...
        </div>
      </div>
    );
  }

  const primaryNav: NavItem[] = [
    { href: '/gestao', label: 'Visão Geral', icon: LayoutDashboard, visible: true },
    {
      href: '/gestao/agenda',
      label: 'Agenda',
      icon: CalendarDays,
      visible: true,
      badge: typeof pendingCount === 'number' && pendingCount > 0 ? pendingCount : undefined,
    },
    {
      href: '/gestao/clientes',
      label: 'Clientes',
      icon: Users,
      visible: user.role !== 'PROFESSIONAL',
    },
    {
      href: '/gestao/profissionais',
      label: 'Profissionais',
      icon: UserCheck,
      visible: user.role !== 'PROFESSIONAL',
    },
    {
      href: '/gestao/servicos',
      label: 'Serviços',
      icon: Scissors,
      visible: user.role !== 'PROFESSIONAL',
    },
  ].filter((item) => item.visible);

  const operationsNav: NavItem[] = [
    {
      href: '/gestao/financeiro',
      label: 'Financeiro & Caixa',
      icon: Wallet,
      visible:
        user.role === 'OWNER' || user.role === 'RECEPTIONIST' || user.role === 'SUPER_ADMIN',
    },
    {
      href: '/gestao/configuracoes',
      label: 'Configurações',
      icon: Settings,
      visible: user.role === 'OWNER' || user.role === 'SUPER_ADMIN',
    },
  ].filter((item) => item.visible);

  const activeNavItem = [...primaryNav, ...operationsNav].find((item) => item.href === pathname);
  const ActiveIcon = activeNavItem?.icon || LayoutDashboard;

  return (
    <div
      className="min-h-screen text-zinc-900 flex flex-col lg:flex-row"
      style={{
        background:
          'linear-gradient(155deg, #E8F0F0 0%, #EEF2F3 45%, #F2F3F0 100%)',
      }}
    >
      {/* Barra Lateral Desktop (Estilo Image 1: Névoa Suave + Item Ativo em Cartão Branco) */}
      <aside
        className={`hidden lg:flex lg:flex-col shrink-0 transition-all duration-200 ${
          collapsed ? 'lg:w-[82px]' : 'lg:w-[256px]'
        } p-4 justify-between`}
      >
        <div className="space-y-6">
          {/* Logótipo + Botão de Recolher */}
          <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 min-w-0 whitespace-nowrap shrink-0"
              title="Salão+"
            >
              <span className="w-9 h-9 rounded-xl bg-[#18181B] text-[#A8DF1A] flex items-center justify-center shadow-xs shrink-0">
                <Asterisk className="w-4 h-4" strokeWidth={2.5} />
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-tight text-zinc-900 block leading-none">
                    Salão+
                  </span>
                  <span className="text-[11px] text-zinc-500 truncate block mt-0.5 max-w-[130px]">
                    {salon?.name || 'Estabelecimento'}
                  </span>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-white/60 transition-colors shrink-0 cursor-pointer"
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Menu Principal */}
          <div className="space-y-1.5">
            {!collapsed && (
              <p className="px-3 text-[11px] font-medium text-zinc-400">Menu principal</p>
            )}
            <nav className="space-y-1">
              {primaryNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] rounded-xl transition-all whitespace-nowrap ${
                      active
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 font-medium hover:bg-white/60 hover:text-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!collapsed && item.badge && (
                      <span className="w-5 h-5 rounded-full bg-[#18181B] text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Operações & Configurações */}
          {operationsNav.length > 0 && (
            <div className="space-y-1.5">
              {!collapsed && (
                <p className="px-3 text-[11px] font-medium text-zinc-400">Gestão &amp; controlo</p>
              )}
              <nav className="space-y-1">
                {operationsNav.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-xl transition-all whitespace-nowrap ${
                        active
                          ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                          : 'text-zinc-600 font-medium hover:bg-white/60 hover:text-zinc-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Rodapé da Conta */}
        <div className="space-y-3 pt-4 border-t border-zinc-300/50">
          {salon && !collapsed && (
            <Link
              href={`/salao/${salon.slug}`}
              target="_blank"
              className="flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-700 bg-white/75 hover:bg-white rounded-xl border border-white transition-colors"
            >
              <span className="truncate">Booking Público</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            </Link>
          )}

          {!collapsed && (
            <p className="px-2 text-[11px] font-medium text-zinc-400">Conta</p>
          )}

          <div className="flex items-center justify-between gap-2 px-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#18181B] text-[#A8DF1A] text-xs font-semibold flex items-center justify-center shrink-0">
                {getInitials(user.name)}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{user.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{ROLE_LABELS[user.role]}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Terminar sessão"
              aria-label="Terminar sessão"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-700 hover:bg-white transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Drawer Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/35 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 bg-[#EEF2F3] h-full p-4 flex flex-col justify-between z-50">
            <div className="space-y-5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#18181B] text-[#A8DF1A] flex items-center justify-center">
                    <Asterisk className="w-4 h-4" strokeWidth={2.5} />
                  </span>
                  <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                    Salão+
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {[...primaryNav, ...operationsNav].map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm rounded-xl ${
                        active ? 'bg-white text-zinc-900 font-semibold shadow-xs' : 'text-zinc-700'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge ? (
                        <span className="w-5 h-5 rounded-full bg-[#18181B] text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-300/60">
              <div className="px-2">
                <p className="text-xs font-semibold text-zinc-900">{user.name}</p>
                <p className="text-[11px] text-zinc-500">{ROLE_LABELS[user.role]}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-700 bg-white rounded-xl border border-red-200"
              >
                <LogOut className="w-4 h-4" />
                Terminar sessão
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Área Principal Branca Flutuante (Estilo Image 1) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white lg:my-2.5 lg:mr-2.5 lg:rounded-[26px] border border-zinc-200/75 shadow-xs overflow-hidden">
        <header className="px-4 sm:px-8 py-4 border-b border-zinc-100 flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden min-w-[44px] min-h-[44px] rounded-xl border border-zinc-200 text-zinc-700 flex items-center justify-center shrink-0"
              aria-label="Abrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav
              aria-label="Navegação estrutural"
              className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400 min-w-0"
            >
              <span className="hidden sm:inline truncate max-w-[180px] text-zinc-400">
                {salon?.name || 'Salão+'}
              </span>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 shrink-0 text-zinc-300" />
              <span className="inline-flex items-center gap-2 text-zinc-900 font-semibold truncate">
                <ActiveIcon className="w-4 h-4 shrink-0 text-zinc-700" />
                <h1 className="font-[family-name:var(--font-jakarta)] truncate">{title}</h1>
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {salon && (
              <Link
                href={`/salao/${salon.slug}`}
                target="_blank"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-zinc-200 rounded-full text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>Página Pública</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            {user.role !== 'PROFESSIONAL' && (
              <Link
                href="/gestao/agenda?new=1"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 whitespace-nowrap shrink-0 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Marcação</span>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1320px] w-full mx-auto">
          {children({ user, salon })}
        </main>
      </div>
    </div>
  );
}
