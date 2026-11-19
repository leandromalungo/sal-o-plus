'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowUpRight,
  Asterisk,
  Check,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    label: 'Proprietária',
    salon: 'Luanda Esthétique',
    email: 'dona@luandaesthetique.ao',
    primary: true,
  },
  {
    label: 'Rececionista',
    salon: 'Luanda Esthétique',
    email: 'recepcao@luandaesthetique.ao',
    primary: false,
  },
  {
    label: 'Profissional',
    salon: 'Ana Silva',
    email: 'ana.silva@luandaesthetique.ao',
    primary: false,
  },
  {
    label: 'Super Admin',
    salon: 'Plataforma',
    email: 'admin@salaomais.ao',
    primary: false,
  },
];

const JOURNEY_STEPS = [
  {
    num: 1,
    loginTitle: 'Aceda à sua conta',
    registerTitle: 'Registe o seu salão',
  },
  {
    num: 2,
    loginTitle: 'Gerencie agenda e caixa',
    registerTitle: 'Configure serviços e equipa',
  },
  {
    num: 3,
    loginTitle: 'Acompanhe comissões em Kz',
    registerTitle: 'Receba marcações 24/7',
  },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [activeStep, setActiveStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('923 000 000');
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
    const fullPhone = phone.trim().startsWith('+244') ? phone.trim() : `+244 ${phone.trim()}`;
    try {
      const res = await fetch('/api/auth/register-salon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonName,
          ownerName,
          email,
          phone: fullPhone,
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
    <div className="min-h-screen bg-[#142318] flex items-center justify-center p-3 sm:p-6 lg:p-10">
      {/* Cartão Split Principal Idêntico ao Layout de Referência com Cores Salão+ */}
      <div className="w-full max-w-[1140px] rounded-[30px] bg-white p-3 sm:p-4 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Painel Esquerdo: Gradiente Floresta & Lima + Colagem Editorial + 3 Passos */}
        <section
          className="lg:col-span-5 rounded-[24px] p-6 sm:p-8 flex flex-col justify-between text-white relative overflow-hidden min-h-[520px] lg:min-h-[650px]"
          style={{
            background:
              'radial-gradient(circle at 82% 24%, rgba(168, 223, 26, 0.36) 0%, rgba(28, 63, 37, 0.92) 45%, #142318 100%)',
          }}
        >
          {/* Topo: Marca Salão+ */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <span className="w-8 h-8 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center">
                <Asterisk className="w-4 h-4" strokeWidth={2.5} />
              </span>
              <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-tight text-white">
                Salão+
              </span>
            </Link>

            <Link
              href="/salao/luanda-esthetique"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-medium text-white hover:bg-white/25 transition-colors whitespace-nowrap"
            >
              Portal Público <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Destaque Visual em Colagem (Inspirado na Imagem 2 com as cores da Landing Page) */}
          <div className="relative z-10 my-6 flex items-center justify-center">
            <div className="relative w-full max-w-[290px] h-40">
              <div className="absolute left-2 top-2 w-36 h-28 rounded-2xl overflow-hidden border-2 border-white/90 shadow-lg -rotate-3 bg-[#142318]">
                <img
                  src="/images/salon_studio_cover_1795068461036.jpg"
                  alt="Ambiente do salão em Luanda"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute right-2 bottom-1 w-36 h-28 rounded-2xl overflow-hidden border-2 border-white/90 shadow-lg rotate-3 bg-[#142318]">
                <img
                  src="/images/pro_avatar_one_1795068461594.jpg"
                  alt="Profissional de beleza"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <span className="absolute right-5 top-0 px-3 py-1 rounded-full bg-[#A8DF1A] text-[#142318] text-[10px] font-semibold tracking-wide shadow-sm rotate-2">
                Luanda · AOA/Kz
              </span>
            </div>
          </div>

          {/* Título + 3 Cartões de Passos na Base (Inspirado na Imagem 1) */}
          <div className="relative z-10">
            <span className="inline-block px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium text-white/95 mb-3">
              {tab === 'register' ? 'Registe o seu salão' : 'Acesso da equipa'}
            </span>

            <h1 className="font-[family-name:var(--font-jakarta)] text-3xl sm:text-[34px] font-medium leading-[1.12] tracking-tight text-white">
              {tab === 'register' ? (
                <>
                  Comece a Sua{' '}
                  <span className="inline-block bg-[#A8DF1A] text-[#142318] px-2.5 py-0.5 rounded-lg font-semibold">
                    Jornada
                  </span>
                </>
              ) : (
                <>
                  A Sua Gestão{' '}
                  <span className="inline-block bg-[#A8DF1A] text-[#142318] px-2.5 py-0.5 rounded-lg font-semibold">
                    Aqui
                  </span>
                </>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-white/75 mt-2 leading-relaxed">
              {tab === 'register'
                ? 'Siga estes passos simples para configurar o seu estabelecimento.'
                : 'Entre para gerir marcações sem conflitos e o caixa em Kwanzas.'}
            </p>

            {/* 3 Cartões de Progresso */}
            <div className="grid grid-cols-3 gap-2.5 mt-6">
              {JOURNEY_STEPS.map((step) => {
                const isSelected = activeStep === step.num;
                const label = tab === 'register' ? step.registerTitle : step.loginTitle;
                return (
                  <button
                    key={step.num}
                    type="button"
                    onClick={() => setActiveStep(step.num)}
                    className={`text-left rounded-2xl p-3 sm:p-3.5 transition-colors flex flex-col justify-between min-h-[104px] cursor-pointer ${
                      isSelected
                        ? 'bg-white text-[#142318] shadow-md'
                        : 'bg-white/15 backdrop-blur-md text-white/90 hover:bg-white/25 border border-white/10'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center tabular-nums ${
                        isSelected
                          ? 'bg-[#A8DF1A] text-[#142318]'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {step.num}
                    </span>
                    <span className="text-[11px] sm:text-xs font-medium leading-snug mt-3">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Painel Direito: Formulário Limpo com Campos em Warm Stone (#F5F4F1) e Botões Lima/Escuro */}
        <section className="lg:col-span-7 px-3 sm:px-8 lg:px-12 py-4 sm:py-6 flex flex-col justify-between">
          {/* Topo discreto com voltar e alternador Entrar / Registar */}
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-[#142318] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao início
            </Link>

            <div className="inline-flex items-center p-1 rounded-full bg-[#F5F4F1]">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                  setActiveStep(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'login'
                    ? 'bg-white text-[#142318] shadow-xs'
                    : 'text-zinc-600 hover:text-[#142318]'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                  setActiveStep(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'register'
                    ? 'bg-white text-[#142318] shadow-xs'
                    : 'text-zinc-600 hover:text-[#142318]'
                }`}
              >
                Registar Salão
              </button>
            </div>
          </div>

          {/* Área Central do Formulário */}
          <div className="my-auto py-5 max-w-md w-full mx-auto">
            <h2 className="font-[family-name:var(--font-jakarta)] text-2xl sm:text-[26px] font-semibold tracking-tight text-[#142318] text-center">
              {tab === 'login' ? 'Iniciar Sessão' : 'Junte-se a Nós'}
            </h2>
            <p className="text-xs text-zinc-500 text-center mt-1.5">
              {tab === 'login'
                ? 'Introduza as credenciais da sua equipa ou proprietária'
                : 'Crie a conta do seu salão em Angola em menos de 1 minuto'}
            </p>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                <motion.form
                  key="login-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  onSubmit={handleLogin}
                  className="mt-6 space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-[#142318] mb-1.5">
                      E-mail profissional
                    </label>
                    <div className="flex items-center justify-between bg-[#F5F4F1] rounded-xl px-4 py-3 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="dona@luandaesthetique.ao"
                        className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none"
                      />
                      {email.includes('@') && (
                        <Check className="w-4 h-4 text-[#142318] shrink-0 ml-2" />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#142318] mb-1.5">
                      Palavra-passe
                    </label>
                    <div className="flex items-center justify-between bg-[#F5F4F1] rounded-xl px-4 py-3 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                        className="text-zinc-400 hover:text-[#142318] ml-2 shrink-0 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1.5">
                      Sessão protegida com cookies HTTP-only e controlo de acessos RBAC.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-5 rounded-full bg-[#A8DF1A] hover:bg-[#b5eb26] text-[#142318] text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    {loading ? 'A validar acesso...' : 'Continuar'}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="register-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  onSubmit={handleRegister}
                  className="mt-5 space-y-3.5"
                >
                  <div>
                    <label className="block text-xs font-medium text-[#142318] mb-1.5">
                      Número de telefone
                    </label>
                    <div className="flex items-center gap-2.5 bg-[#F5F4F1] rounded-xl px-4 py-2.5 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                      <span className="px-2 py-0.5 rounded-md bg-[#142318] text-[#A8DF1A] text-[10px] font-semibold tracking-wider shrink-0">
                        AO +244
                      </span>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="923 000 000"
                        className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#142318] mb-1.5">
                        Nome Completo
                      </label>
                      <div className="flex items-center bg-[#F5F4F1] rounded-xl px-3.5 py-2.5 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                        <input
                          type="text"
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="Miriam Baptista"
                          className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#142318] mb-1.5">
                        Nome do Salão
                      </label>
                      <div className="flex items-center justify-between bg-[#F5F4F1] rounded-xl px-3.5 py-2.5 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                        <input
                          type="text"
                          required
                          value={salonName}
                          onChange={(e) => setSalonName(e.target.value)}
                          placeholder="Espaço Maianga"
                          className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none"
                        />
                        {salonName.trim().length >= 3 && (
                          <Check className="w-4 h-4 text-[#142318] shrink-0 ml-1.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#142318] mb-1.5">
                        E-mail profissional
                      </label>
                      <div className="flex items-center bg-[#F5F4F1] rounded-xl px-3.5 py-2.5 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="dona@salao.ao"
                          className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#142318] mb-1.5">
                        Endereço (Luanda)
                      </label>
                      <div className="flex items-center bg-[#F5F4F1] rounded-xl px-3.5 py-2.5 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Talatona, Luanda"
                          className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#142318] mb-1.5">
                      Palavra-passe
                    </label>
                    <div className="flex items-center justify-between bg-[#F5F4F1] rounded-xl px-4 py-2.5 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                        className="text-zinc-400 hover:text-[#142318] ml-2 shrink-0 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Mínimo 6 caracteres. Página pública criada automaticamente em /salao/seu-salao.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-5 rounded-full bg-[#A8DF1A] hover:bg-[#b5eb26] text-[#142318] text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'A criar estabelecimento...' : 'Continuar'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Link de Alternância entre Login e Registo */}
            <p className="text-xs text-zinc-500 text-center mt-4">
              {tab === 'login' ? (
                <>
                  Ainda não tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('register');
                      setError(null);
                    }}
                    className="font-semibold text-[#142318] underline underline-offset-2 hover:opacity-80 cursor-pointer"
                  >
                    Registar Salão
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setError(null);
                    }}
                    className="font-semibold text-[#142318] underline underline-offset-2 hover:opacity-80 cursor-pointer"
                  >
                    Iniciar Sessão
                  </button>
                </>
              )}
            </p>

            {/* Separador "Ou" + Botões de Acesso Rápido por Perfil (Estilo pílula das Imagens 1 e 2) */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-xs text-zinc-400">Ou acesso demonstração</span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.slice(0, 1).map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin(acc.email)}
                  className="w-full py-3 px-4 rounded-full bg-[#142318] hover:bg-[#1e3522] text-white text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4 text-[#A8DF1A]" />
                  <span>Entrar como {acc.label} ({acc.salon})</span>
                </button>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.slice(1).map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoLogin(acc.email)}
                    className="py-2.5 px-3 rounded-full border border-zinc-200 bg-white hover:bg-[#F5F4F1] text-[#142318] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {acc.label === 'Super Admin' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-[#142318]" />
                    ) : (
                      <Users className="w-3.5 h-3.5 text-[#142318]" />
                    )}
                    <span>{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nota Discreta Inferior */}
          <p className="text-[11px] text-zinc-400 text-center leading-relaxed max-w-sm mx-auto">
            Ao continuar concorda com as regras multi-tenant do Salão+.{' '}
            <Link href="/salao/luanda-esthetique" className="text-[#142318] underline underline-offset-2">
              Testar agendamento sem conta
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#142318]" />}>
      <LoginContent />
    </Suspense>
  );
}
