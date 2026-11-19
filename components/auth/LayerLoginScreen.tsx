'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Asterisk,
  Building2,
  Check,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { AUTH_LAYERS, type AuthLayer } from '@/lib/auth/layers';

function LayerLoginInner({ layer }: { layer: AuthLayer }) {
  const meta = AUTH_LAYERS[layer];
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab =
    meta.allowRegistration && searchParams.get('tab') === 'register' ? 'register' : 'login';

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

  function finishLoginNavigation() {
    if (layer !== 'admin') {
      window.sessionStorage.setItem('salaomais_tab_layer', layer);
      router.push(`${meta.redirectPath}?layer=${layer}`);
    } else {
      router.push(meta.redirectPath);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, layer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas.');
        setLoading(false);
        return;
      }
      finishLoginNavigation();
    } catch {
      setError('Erro de ligação ao servidor.');
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
      window.sessionStorage.setItem('salaomais_tab_layer', 'gestao');
      router.push('/gestao?layer=gestao');
    } catch {
      setError('Erro de ligação ao servidor.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#142318] flex items-center justify-center p-3 sm:p-6 lg:p-10">
      <div className="w-full max-w-[1140px] rounded-[30px] bg-white p-3 sm:p-4 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Painel Esquerdo: Identidade Visual da Camada Atual (sem expor outras camadas) */}
        <section
          className="lg:col-span-5 rounded-[24px] p-6 sm:p-8 flex flex-col justify-between text-white relative overflow-hidden min-h-[500px] lg:min-h-[640px]"
          style={{
            background:
              'radial-gradient(circle at 82% 24%, rgba(168, 223, 26, 0.36) 0%, rgba(28, 63, 37, 0.92) 45%, #142318 100%)',
          }}
        >
          <div className="relative z-10 flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <span className="w-8 h-8 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center">
                <Asterisk className="w-4 h-4" strokeWidth={2.5} />
              </span>
              <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-tight text-white">
                Salão+
              </span>
            </Link>
          </div>

          <div className="relative z-10 my-5 flex items-center justify-center">
            <div className="relative w-full max-w-[290px] h-40">
              <div className="absolute left-2 top-2 w-36 h-28 rounded-2xl overflow-hidden border-2 border-white/90 shadow-lg -rotate-3 bg-[#142318]">
                <img
                  src="/images/salon_studio_cover_1795068461036.jpg"
                  alt="Ambiente do salão"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute right-2 bottom-1 w-36 h-28 rounded-2xl overflow-hidden border-2 border-white/90 shadow-lg rotate-3 bg-[#142318]">
                <img
                  src={
                    layer === 'profissional'
                      ? '/images/pro_avatar_two_1795068461143.jpg'
                      : '/images/pro_avatar_one_1795068461594.jpg'
                  }
                  alt={meta.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <span className="absolute right-4 top-0 px-3 py-1 rounded-full bg-[#A8DF1A] text-[#142318] text-[10px] font-semibold tracking-wide shadow-sm rotate-2">
                Luanda · Angola
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <span className="inline-block px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium text-white/95 mb-3">
              {meta.badge}
            </span>

            <h1 className="font-[family-name:var(--font-jakarta)] text-3xl sm:text-[34px] font-medium leading-[1.12] tracking-tight text-white">
              {meta.headlinePrefix}{' '}
              <span className="inline-block bg-[#A8DF1A] text-[#142318] px-2.5 py-0.5 rounded-lg font-semibold">
                {meta.headlineHighlight}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-white/75 mt-2.5 leading-relaxed">{meta.subtitle}</p>

            <div className="grid grid-cols-3 gap-2.5 mt-6">
              {meta.steps.map((stepText, idx) => {
                const stepNum = idx + 1;
                const isSelected = activeStep === stepNum;
                return (
                  <button
                    key={stepNum}
                    type="button"
                    onClick={() => setActiveStep(stepNum)}
                    className={`text-left rounded-2xl p-3 sm:p-3.5 transition-colors flex flex-col justify-between min-h-[104px] cursor-pointer ${
                      isSelected
                        ? 'bg-white text-[#142318] shadow-md'
                        : 'bg-white/15 backdrop-blur-md text-white/90 hover:bg-white/25 border border-white/10'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center tabular-nums ${
                        isSelected ? 'bg-[#A8DF1A] text-[#142318]' : 'bg-white/20 text-white'
                      }`}
                    >
                      {stepNum}
                    </span>
                    <span className="text-[11px] sm:text-xs font-medium leading-snug mt-3">
                      {stepText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Painel Direito: Formulário Limpo de Produção (sem credenciais ou links expostos) */}
        <section className="lg:col-span-7 px-3 sm:px-8 lg:px-12 py-4 sm:py-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-[#142318] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao início
            </Link>

            {meta.allowRegistration && (
              <div className="inline-flex items-center p-1 rounded-full bg-[#F5F4F1]">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError(null);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    tab === 'login' ? 'bg-white text-[#142318] shadow-xs' : 'text-zinc-600'
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
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    tab === 'register' ? 'bg-white text-[#142318] shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  Registar Salão
                </button>
              </div>
            )}
          </div>

          <div className="my-auto py-8 max-w-md w-full mx-auto">
            <h2 className="font-[family-name:var(--font-jakarta)] text-2xl sm:text-[28px] font-semibold tracking-tight text-[#142318] text-center">
              {tab === 'register' ? 'Registar Novo Salão' : meta.title}
            </h2>
            <p className="text-xs text-zinc-500 text-center mt-2">
              {tab === 'register'
                ? 'Crie a conta do seu estabelecimento em Angola'
                : 'Introduza o seu e-mail e palavra-passe para continuar'}
            </p>

            {error && (
              <div className="mt-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                <motion.form
                  key={`login-${layer}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  onSubmit={handleLogin}
                  className="mt-7 space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-[#142318] mb-1.5">
                      E-mail de acesso
                    </label>
                    <div className="flex items-center justify-between bg-[#F5F4F1] rounded-xl px-4 py-3 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@empresa.ao"
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
                        autoComplete="current-password"
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
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-5 rounded-full bg-[#A8DF1A] hover:bg-[#b5eb26] text-[#142318] text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Lock className="w-4 h-4" />
                    {loading ? 'A validar acesso...' : 'Continuar'}
                  </button>

                  {meta.allowRegistration && (
                    <p className="text-xs text-zinc-500 text-center pt-2">
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
                    </p>
                  )}
                </motion.form>
              ) : (
                <motion.form
                  key="register-gestao"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  onSubmit={handleRegister}
                  className="mt-6 space-y-3.5"
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
                          placeholder="Seu nome completo"
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
                          placeholder="Nome do estabelecimento"
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
                          placeholder="nome@empresa.ao"
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
                          placeholder="Bairro, Município"
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
                        placeholder="Mínimo 6 caracteres"
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
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-5 rounded-full bg-[#A8DF1A] hover:bg-[#b5eb26] text-[#142318] text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    {loading ? 'A criar estabelecimento...' : 'Criar Salão'}
                  </button>

                  <p className="text-xs text-zinc-500 text-center pt-1">
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
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <p className="text-[11px] text-zinc-400 text-center leading-relaxed max-w-sm mx-auto">
            {layer === 'admin'
              ? 'Acesso restrito e monitorizado por auditoria.'
              : 'Sessão protegida com isolamento multi-tenant.'}
          </p>
        </section>
      </div>
    </div>
  );
}

export default function LayerLoginScreen({ layer }: { layer: AuthLayer }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#142318]" />}>
      <LayerLoginInner layer={layer} />
    </Suspense>
  );
}
