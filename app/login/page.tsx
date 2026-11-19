'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Building2 } from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    label: 'Proprietária',
    salon: 'Luanda Esthétique',
    email: 'dona@luandaesthetique.ao',
    roleDesc: 'Acesso total ao salão, agenda e financeiro',
  },
  {
    label: 'Recepcionista',
    salon: 'Luanda Esthétique',
    email: 'recepcao@luandaesthetique.ao',
    roleDesc: 'Agenda, clientes, recebimentos e caixa',
  },
  {
    label: 'Profissional',
    salon: 'Ana Silva · Luanda Esthétique',
    email: 'ana.silva@luandaesthetique.ao',
    roleDesc: 'Vê apenas os próprios atendimentos (sem financeiro)',
  },
  {
    label: 'Super Admin',
    salon: 'Plataforma Salão+',
    email: 'admin@salaomais.ao',
    roleDesc: 'Gestão de todos os salões e planos',
  },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('+244 9');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Falha ao iniciar sessão.');
        setLoading(false);
        return;
      }
      if (data.user?.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/gestao');
      }
    } catch {
      setError('Erro de ligação ao servidor.');
      setLoading(false);
    }
  }

  async function handleDemoLogin(demoEmail: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: 'Salao@2026' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao entrar.');
        setLoading(false);
        return;
      }
      if (data.user?.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/gestao');
      }
    } catch {
      setError('Erro de ligação.');
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register-salon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonName,
          ownerName,
          email,
          phone,
          password,
          address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível registar o salão.');
        setLoading(false);
        return;
      }
      router.push('/gestao');
    } catch {
      setError('Erro de ligação ao servidor.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafc] flex flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-jakarta)] text-xl font-bold tracking-tight text-zinc-900"
          >
            Salão<span className="text-violet-700">+</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                tab === 'login' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Iniciar Sessão
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                tab === 'register' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Registar Salão
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  E-mail profissional
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dona@luandaesthetique.ao"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Palavra-passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-violet-700 rounded-lg hover:bg-violet-800 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'A validar acesso...' : 'Entrar no painel'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Nome do Salão
                </label>
                <input
                  type="text"
                  required
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  placeholder="Ex.: Espaço Beleza Maianga"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Nome da Proprietária
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Telefone (Angola)
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+244 923 000 000"
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Endereço em Luanda
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Bairro, Rua, Município"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  E-mail de acesso
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="proprietaria@salao.ao"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Palavra-passe (mín. 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-violet-700 rounded-lg hover:bg-violet-800 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                {loading ? 'A criar estabelecimento...' : 'Criar salão e começar'}
              </button>
            </form>
          )}
        </div>

        {/* Acesso rápido para avaliar todos os perfis RBAC */}
        <div className="lg:col-span-6 space-y-4">
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-zinc-900">
              Acesso rápido por perfil de permissão
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              Selecione qualquer perfil para validar o controlo de acessos e o isolamento multi-tenant no servidor.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl bg-white">
            {DEMO_ACCOUNTS.map((acc) => (
              <div key={acc.email} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <span>{acc.label}</span>
                    <span className="text-zinc-300">·</span>
                    <span className="text-xs font-normal text-zinc-500 truncate">{acc.salon}</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">{acc.roleDesc}</p>
                  <p className="font-mono text-[11px] text-zinc-400 mt-1">{acc.email}</p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin(acc.email)}
                  className="px-3.5 py-2 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Entrar
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 bg-white flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">Testar como Cliente (sem login)</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Aceda diretamente à página pública de agendamento do Luanda Esthétique.
              </p>
            </div>
            <Link
              href="/salao/luanda-esthetique"
              className="px-3.5 py-2 text-xs font-medium border border-zinc-200 rounded-lg text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              Abrir Booking
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafafc]" />}>
      <LoginContent />
    </Suspense>
  );
}
