'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Asterisk,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { AUTH_LAYERS, type AuthLayer } from '@/lib/auth/layers';
import {
  getActiveGoogleTokens,
  googleSignOut,
  signInWithGooglePopup,
} from '@/lib/auth/google-client';

function GoogleOfficialIcon() {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="w-5 h-5 block shrink-0"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

function mapGooglePopupError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';

  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou a janela do Google. Permita pop-ups para continuar.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'A janela de início de sessão Google foi fechada antes de concluir.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este domínio ainda não está autorizado para autenticação Google.';
  }
  return 'Não foi possível concluir a autenticação com a conta Google.';
}

function LayerLoginInner({ layer }: { layer: AuthLayer }) {
  const meta = AUTH_LAYERS[layer];
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
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function finishLoginNavigation(targetLayer: AuthLayer = layer, customRedirectPath?: string) {
    if (targetLayer !== 'admin') {
      window.sessionStorage.setItem('salaomais_tab_layer', targetLayer);
      const basePath = customRedirectPath || meta.redirectPath;
      window.location.assign(`${basePath}?layer=${targetLayer}`);
    } else {
      window.location.assign(customRedirectPath || meta.redirectPath);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, layer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas.');
        setLoading(false);
        return;
      }
      finishLoginNavigation(layer, typeof data.redirectPath === 'string' ? data.redirectPath : undefined);
    } catch {
      setError('Erro de ligação ao servidor.');
      setLoading(false);
    }
  }

  async function submitGoogleBackend(params: {
    accessToken: string | null;
    idToken: string | null;
    includeSalonFields: boolean;
  }) {
    const fullPhone = phone.trim().startsWith('+244') ? phone.trim() : `+244 ${phone.trim()}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (params.accessToken) {
      headers.Authorization = `Bearer ${params.accessToken}`;
    }

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        layer,
        idToken: params.idToken,
        ...(params.includeSalonFields
          ? {
              salonName: salonName.trim(),
              ownerName: ownerName.trim(),
              phone: fullPhone,
              address: address.trim(),
              ...(password ? { password } : {}),
            }
          : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      await googleSignOut();
      setError(data.error || 'Não foi possível autenticar com a conta Google.');
      return;
    }

    if (data.needsSalonSetup && data.googleProfile) {
      setGoogleProfile({
        email: String(data.googleProfile.email),
        name: String(data.googleProfile.name || ''),
      });
      setEmail(String(data.googleProfile.email));
      if (!ownerName.trim() && data.googleProfile.name) {
        setOwnerName(String(data.googleProfile.name));
      }
      if (meta.allowRegistration) {
        setTab('register');
      }
      return;
    }

    finishLoginNavigation(
      typeof data.layer === 'string' ? (data.layer as AuthLayer) : layer,
      typeof data.redirectPath === 'string' ? data.redirectPath : undefined
    );
  }

  async function handleGoogleAuth(includeSalonFields: boolean) {
    setGoogleLoading(true);
    setError(null);
    try {
      const signInResult = await signInWithGooglePopup();
      await submitGoogleBackend({
        accessToken: signInResult.accessToken,
        idToken: signInResult.idToken,
        includeSalonFields,
      });
    } catch (err) {
      setError(mapGooglePopupError(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (googleProfile) {
      try {
        const tokens = await getActiveGoogleTokens();
        if (!tokens.accessToken && !tokens.idToken) {
          const refreshed = await signInWithGooglePopup();
          await submitGoogleBackend({
            accessToken: refreshed.accessToken,
            idToken: refreshed.idToken,
            includeSalonFields: true,
          });
        } else {
          await submitGoogleBackend({
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
            includeSalonFields: true,
          });
        }
      } catch (err) {
        setError(mapGooglePopupError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    const fullPhone = phone.trim().startsWith('+244') ? phone.trim() : `+244 ${phone.trim()}`;
    try {
      const res = await fetch('/api/auth/register-salon', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonName: salonName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          phone: fullPhone,
          password,
          address: address.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível registar o salão.');
        setLoading(false);
        return;
      }
      finishLoginNavigation('gestao', '/gestao');
    } catch {
      setError('Erro de ligação ao servidor.');
      setLoading(false);
    }
  }

  async function clearGoogleOnboarding() {
    await googleSignOut();
    setGoogleProfile(null);
    setEmail('');
    setPassword('');
    setError(null);
  }

  return (
    <div className="min-h-screen bg-[#142318] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-[540px] lg:max-w-[1140px] rounded-[26px] lg:rounded-[30px] bg-white p-4 sm:p-6 lg:p-4 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Painel Esquerdo: Identidade Visual da Camada Atual (oculto em telas menores para exibir apenas o formulário) */}
        <section
          className="hidden lg:flex lg:col-span-5 rounded-[24px] p-8 flex-col justify-between text-white relative overflow-hidden lg:min-h-[640px]"
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

        {/* Painel Direito: Formulário Limpo de Produção + Google Sign-In Oficial */}
        <section className="lg:col-span-7 px-1 sm:px-4 lg:px-12 py-2 sm:py-4 lg:py-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-[#142318] transition-colors shrink-0"
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
                    setPassword('');
                  }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
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
                    setPassword('');
                  }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    tab === 'register' ? 'bg-white text-[#142318] shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  Registar Salão
                </button>
              </div>
            )}
          </div>

          <div className="my-auto py-6 sm:py-8 max-w-md w-full mx-auto">
            <h2 className="font-[family-name:var(--font-jakarta)] text-2xl sm:text-[28px] font-semibold tracking-tight text-[#142318] text-center">
              {tab === 'register'
                ? googleProfile
                  ? 'Concluir Registo com Google'
                  : 'Registar Novo Salão'
                : meta.title}
            </h2>
            <p className="text-xs text-zinc-500 text-center mt-2">
              {tab === 'register'
                ? googleProfile
                  ? 'Indique apenas o nome do salão e o telefone para criar o seu espaço'
                  : 'Crie a conta do seu estabelecimento em Angola'
                : 'Introduza os seus dados ou entre com a sua conta Google'}
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
                    disabled={loading || googleLoading}
                    className="w-full py-3.5 px-5 rounded-full bg-[#A8DF1A] hover:bg-[#b5eb26] text-[#142318] text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Lock className="w-4 h-4" />
                    {loading ? 'A validar acesso...' : 'Continuar'}
                  </button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-zinc-200" />
                    <span className="shrink-0 px-3 text-[11px] font-medium text-zinc-400">ou</span>
                    <div className="flex-grow border-t border-zinc-200" />
                  </div>

                  <button
                    type="button"
                    disabled={loading || googleLoading}
                    onClick={() => handleGoogleAuth(false)}
                    className="w-full py-3 px-5 rounded-full bg-white hover:bg-[#F5F4F1] border border-zinc-200 text-[#142318] text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-3 cursor-pointer shadow-xs"
                  >
                    <GoogleOfficialIcon />
                    <span>{googleLoading ? 'A ligar à conta Google...' : 'Continuar com Google'}</span>
                  </button>

                  {meta.allowRegistration && (
                    <p className="text-xs text-zinc-500 text-center pt-2">
                      Ainda não tem conta?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setTab('register');
                          setError(null);
                          setPassword('');
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
                  {googleProfile && (
                    <div className="p-3 rounded-xl bg-[#A8DF1A]/15 border border-[#A8DF1A]/60 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-[#142318] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#142318] truncate">
                            {googleProfile.name || 'Conta Google'}
                          </p>
                          <p className="text-[11px] text-zinc-600 truncate">{googleProfile.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearGoogleOnboarding}
                        className="text-[11px] font-semibold text-[#142318] underline underline-offset-2 shrink-0 cursor-pointer"
                      >
                        Alterar
                      </button>
                    </div>
                  )}

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
                          readOnly={Boolean(googleProfile)}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nome@empresa.ao"
                          className="w-full text-sm text-[#142318] placeholder:text-zinc-400 bg-transparent outline-none read-only:opacity-75"
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
                      {googleProfile
                        ? 'Palavra-passe (opcional — para entrar também por e-mail)'
                        : 'Palavra-passe'}
                    </label>
                    <div className="flex items-center justify-between bg-[#F5F4F1] rounded-xl px-4 py-2.5 border border-transparent focus-within:border-[#A8DF1A] focus-within:bg-white transition-colors">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={!googleProfile}
                        minLength={googleProfile ? undefined : 6}
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
                    disabled={loading || googleLoading}
                    className="w-full py-3.5 px-5 rounded-full bg-[#A8DF1A] hover:bg-[#b5eb26] text-[#142318] text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    {loading
                      ? 'A criar estabelecimento...'
                      : googleProfile
                      ? 'Concluir Registo com Google'
                      : 'Criar Salão'}
                  </button>

                  {!googleProfile && (
                    <>
                      <div className="relative flex items-center py-0.5">
                        <div className="flex-grow border-t border-zinc-200" />
                        <span className="shrink-0 px-3 text-[11px] font-medium text-zinc-400">ou</span>
                        <div className="flex-grow border-t border-zinc-200" />
                      </div>

                      <button
                        type="button"
                        disabled={loading || googleLoading}
                        onClick={() => handleGoogleAuth(Boolean(salonName.trim() && phone.trim()))}
                        className="w-full py-3 px-5 rounded-full bg-white hover:bg-[#F5F4F1] border border-zinc-200 text-[#142318] text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-3 cursor-pointer shadow-xs"
                      >
                        <GoogleOfficialIcon />
                        <span>
                          {googleLoading ? 'A ligar à conta Google...' : 'Registar com Google'}
                        </span>
                      </button>
                    </>
                  )}

                  <p className="text-xs text-zinc-500 text-center pt-1">
                    Já tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setTab('login');
                        setError(null);
                        setPassword('');
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
