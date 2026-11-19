'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpRight,
  Asterisk,
  CalendarCheck,
  ChevronDown,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';

interface HeroSlide {
  id: string;
  num: string;
  tabLabel: string;
  line1: string;
  line2: string;
  ctaLabel: string;
  ctaHref: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'parceiro',
    num: '01',
    tabLabel: 'PARCEIRO DE CONFIANÇA',
    line1: 'O Seu Parceiro',
    line2: 'de Gestão para Salões',
    ctaLabel: 'Testar Agendamento',
    ctaHref: '/salao/luanda-esthetique',
  },
  {
    id: 'motor',
    num: '02',
    tabLabel: 'MOTOR ANTI-CONFLITO',
    line1: 'Agenda Inteligente',
    line2: 'Sem Reservas Duplicadas',
    ctaLabel: 'Ver Vagas em Luanda',
    ctaHref: '/salao/luanda-esthetique',
  },
  {
    id: 'financeiro',
    num: '03',
    tabLabel: 'CAIXA & COMISSÕES KZ',
    line1: 'Controlo Financeiro',
    line2: 'em Kwanzas em Tempo Real',
    ctaLabel: 'Aceder à Gestão',
    ctaHref: '/login',
  },
];

export default function LandingShowcaseClient() {
  const router = useRouter();
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lookupInput, setLookupInput] = useState('');
  const [lookupError, setLookupError] = useState('');

  const slide = HERO_SLIDES[activeSlideIdx];

  function handleQuickLookup(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = lookupInput.trim();
    if (!cleaned) {
      setLookupError('Introduza o nome de um salão ou código (ex.: luanda-esthetique).');
      return;
    }
    setLookupError('');
    setSearchOpen(false);
    const normalized = cleaned.toLowerCase();
    if (normalized.includes('kizomba')) {
      router.push('/salao/kizomba-beauty');
      return;
    }
    if (normalized.startsWith('slm-')) {
      router.push(`/salao/luanda-esthetique?codigo=${encodeURIComponent(cleaned.toUpperCase())}`);
      return;
    }
    router.push('/salao/luanda-esthetique');
  }

  return (
    <div className="min-h-screen bg-white text-[#142318]">
      {/* Secção 1: Hero Full-Bleed Arredondado com Navegação e Tabs Inferiores */}
      <div className="max-w-[1380px] mx-auto px-3 sm:px-6 pt-3 sm:pt-5">
        <section className="relative rounded-[26px] overflow-hidden min-h-[580px] lg:min-h-[640px] flex flex-col justify-between bg-[#1b1712]">
          {/* Imagem de Fundo + Scrim Medido */}
          <img
            src="/images/hero_salon_luanda_1795068461488.jpg"
            alt="Ambiente contemporâneo de salão de beleza em Luanda"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#17120d]/85 via-[#17120d]/45 to-[#17120d]/25"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 to-transparent"
          />

          {/* Top Bar dentro do Hero (Marca | Navegação | Pesquisa + CTA Lima) */}
          <header className="relative z-20 px-5 sm:px-9 pt-5 sm:pt-7 flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <span className="w-9 h-9 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center">
                <Asterisk className="w-5 h-5" strokeWidth={2.4} />
              </span>
              <span className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-tight text-white">
                Salão+
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-white/90">
              <a
                href="#topo"
                className="inline-flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Início <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </a>
              <a
                href="#motor"
                className="inline-flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Motor <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </a>
              <a
                href="#servicos"
                className="inline-flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Portais <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </a>
              <a
                href="#planos"
                className="inline-flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Planos <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </a>
              <Link
                href="/salao/luanda-esthetique"
                className="px-4 py-1.5 rounded-full bg-white text-[#142318] text-xs font-semibold hover:bg-white/90 transition-colors whitespace-nowrap shrink-0"
              >
                Booking
              </Link>
            </nav>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Procurar salão ou código de marcação"
                className="w-10 h-10 rounded-full bg-white text-[#142318] flex items-center justify-center hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-full bg-[#A8DF1A] text-[#142318] text-xs sm:text-sm font-semibold hover:bg-[#b7ed28] transition-colors whitespace-nowrap shrink-0"
              >
                Aceder à Gestão
              </Link>
            </div>
          </header>

          {/* Barra de Pesquisa Rápida quando acionada */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="relative z-30 mx-5 sm:mx-9 mt-2 bg-white rounded-2xl p-4 shadow-lg max-w-xl self-end w-full"
              >
                <form onSubmit={handleQuickLookup} className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="Pesquisar salão (Luanda Esthétique, Kizomba) ou código SLM-..."
                    className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none bg-transparent"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-full bg-[#A8DF1A] text-[#142318] text-xs font-semibold hover:bg-[#b7ed28] cursor-pointer whitespace-nowrap"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    aria-label="Fechar pesquisa"
                    className="p-1.5 rounded-full text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>
                {lookupError && <p className="text-xs text-rose-600 mt-1.5">{lookupError}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conteúdo Central do Hero + Indicador Lateral 01-03 */}
          <div id="topo" className="relative z-10 px-5 sm:px-9 my-auto py-10 flex items-center justify-between gap-6">
            <div className="max-w-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="font-[family-name:var(--font-jakarta)] text-[clamp(2.15rem,4.3vw,3.65rem)] font-normal leading-[1.09] tracking-tight text-white [text-wrap:balance]">
                    <span className="inline-flex items-center flex-wrap gap-x-4">
                      <span>{slide.line1}</span>
                      <span
                        aria-hidden="true"
                        className="hidden sm:inline-block h-px w-24 bg-[#A8DF1A]/75"
                      />
                    </span>
                    <br />
                    <span>{slide.line2}</span>
                  </h1>

                  <div className="mt-7 flex items-center gap-2">
                    <Link
                      href={slide.ctaHref}
                      className="px-6 py-3 rounded-full bg-[#A8DF1A] text-[#142318] text-sm font-medium hover:bg-[#b7ed28] transition-colors whitespace-nowrap"
                    >
                      {slide.ctaLabel}
                    </Link>
                    <Link
                      href={slide.ctaHref}
                      aria-label={slide.ctaLabel}
                      className="w-11 h-11 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center hover:bg-[#b7ed28] transition-colors shrink-0"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Indicador Vertical 01 - 03 na Direita */}
            <div className="hidden sm:flex flex-col items-center gap-2.5 text-[11px] font-mono text-white/80 tabular-nums shrink-0">
              <span>{slide.num}</span>
              <div className="w-[2px] h-20 bg-white/25 rounded-full relative overflow-hidden">
                <motion.div
                  className="w-full bg-[#A8DF1A] rounded-full absolute left-0"
                  animate={{
                    top: `${activeSlideIdx * 33.33}%`,
                    height: '33.33%',
                  }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <span>03</span>
            </div>
          </div>

          {/* Barra Inferior com 3 Tabs Translúcidas */}
          <div className="relative z-10 px-5 sm:px-9 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {HERO_SLIDES.map((item, idx) => {
                const isActive = idx === activeSlideIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSlideIdx(idx)}
                    className={`text-left px-5 py-3.5 rounded-xl text-[11px] font-semibold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap truncate ${
                      isActive
                        ? 'bg-white text-[#142318] shadow-sm'
                        : 'bg-white/25 backdrop-blur-md text-white hover:bg-white/35'
                    }`}
                  >
                    {item.tabLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Secção 2: Três Cards de Destaque (Cinza Suave | Lima Vibrante Geométrico | Cinza Suave) */}
      <section id="motor" className="max-w-[1380px] mx-auto px-3 sm:px-6 mt-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Esquerda (Warm Stone #F5F4F1) */}
          <article className="rounded-[24px] bg-[#F5F4F1] p-6 flex flex-col justify-between min-h-[430px]">
            <div>
              <div className="flex items-center justify-between gap-4">
                <span className="px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-zinc-600">
                  MOTOR DE RESERVAS
                </span>
                <Link
                  href="/salao/luanda-esthetique"
                  aria-label="Testar motor de reservas"
                  className="w-10 h-10 rounded-full bg-white text-[#142318] flex items-center justify-center hover:bg-zinc-100 transition-colors shrink-0"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-xl sm:text-[22px] font-medium leading-[1.28] text-[#142318] mt-5">
                Plataforma líder em agendamento transacional sem conflitos em Luanda
              </h2>
            </div>

            <Link
              href="/salao/luanda-esthetique"
              className="mt-6 block rounded-[18px] overflow-hidden aspect-[4/3] bg-zinc-200 group"
            >
              <img
                src="/images/salon_studio_cover_1795068461036.jpg"
                alt="Espaço e equipa do salão Luanda Esthétique"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>
          </article>

          {/* Card 2: Centro (Assinatura Lima #A8DF1A com Recortes Geométricos sobre Foto) */}
          <article className="rounded-[24px] bg-[#A8DF1A] overflow-hidden flex flex-col justify-between min-h-[430px] relative">
            {/* Área Fotográfica Superior com Formas Geométricas Lima Sobrepostas */}
            <div className="relative h-64 sm:h-72 overflow-hidden">
              <img
                src="/images/pro_avatar_one_1795068461594.jpg"
                alt="Especialista de beleza a atender cliente"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
              {/* Recortes geométricos #A8DF1A replicando a máscara diagonal do design de referência */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#A8DF1A]"
                style={{
                  clipPath: 'polygon(0 45%, 36% 74%, 0 100%)',
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#A8DF1A]"
                style={{
                  clipPath: 'polygon(100% 8%, 72% 42%, 100% 68%)',
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#A8DF1A]"
                style={{
                  clipPath: 'polygon(42% 84%, 100% 56%, 100% 100%, 0 100%)',
                }}
              />
            </div>

            <div className="p-6 pt-2 flex flex-col justify-end relative z-10">
              <span className="self-start px-3 py-1 rounded-full bg-white/30 text-[#142318] text-[10px] font-semibold tracking-wider uppercase mb-3">
                DESTAQUE AO VIVO
              </span>
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-medium leading-[1.25] text-[#142318]">
                  Luanda Esthétique aceita reservas online 24/7 sem colisões
                </h2>
                <Link
                  href="/salao/luanda-esthetique"
                  aria-label="Abrir página pública do Luanda Esthétique"
                  className="w-11 h-11 rounded-full bg-white text-[#142318] flex items-center justify-center hover:bg-zinc-100 transition-colors shrink-0"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </article>

          {/* Card 3: Direita (Warm Stone #F5F4F1) */}
          <article className="rounded-[24px] bg-[#F5F4F1] p-6 flex flex-col justify-between min-h-[430px]">
            <div>
              <div className="flex items-center justify-between gap-4">
                <span className="px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-zinc-600">
                  FINANCEIRO KZ
                </span>
                <Link
                  href="/login"
                  aria-label="Consultar painel financeiro"
                  className="w-10 h-10 rounded-full bg-white text-[#142318] flex items-center justify-center hover:bg-zinc-100 transition-colors shrink-0"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-xl sm:text-[22px] font-medium leading-[1.28] text-[#142318] mt-5">
                Caixa diário em Kwanzas, pagamentos parciais e cálculo de comissões
              </h2>
            </div>

            <Link
              href="/login"
              className="mt-6 block rounded-[18px] overflow-hidden aspect-[4/3] bg-zinc-200 group"
            >
              <img
                src="/images/pro_avatar_two_1795068461143.jpg"
                alt="Gestão profissional do atendimento no salão"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>
          </article>
        </div>
      </section>

      {/* Secção 3: Contentor Arredondado com Título Centralizado e 4 Cartões Fotográficos */}
      <section id="servicos" className="max-w-[1380px] mx-auto px-3 sm:px-6 mt-5">
        <div className="rounded-[28px] bg-[#F5F4F1] px-5 sm:px-10 py-12 lg:py-16">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block px-3.5 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-zinc-600">
              PORTAIS &amp; FUNCIONALIDADES
            </span>
            <h2 className="font-[family-name:var(--font-jakarta)] text-3xl sm:text-4xl lg:text-[42px] font-normal leading-[1.14] tracking-tight text-[#142318] mt-4 [text-wrap:balance]">
              Impulsionamos Salões Modernos para Operações Extraordinárias
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Link
              href="/salao/luanda-esthetique"
              className="group relative rounded-[20px] overflow-hidden aspect-[3/4] bg-zinc-900 flex flex-col justify-between p-5"
            >
              <img
                src="/images/hero_salon_luanda_1795068461488.jpg"
                alt="Agendamento Público Salão+ Booking"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15"
              />
              <span className="relative z-10 w-10 h-10 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </span>
              <div className="relative z-10 text-white">
                <p className="font-[family-name:var(--font-jakarta)] text-lg font-medium">
                  Salão+ Booking
                </p>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Vagas reais por duração, intervalo de preparação e reagendamento autónomo.
                </p>
              </div>
            </Link>

            <Link
              href="/login"
              className="group relative rounded-[20px] overflow-hidden aspect-[3/4] bg-zinc-900 flex flex-col justify-between p-5"
            >
              <img
                src="/images/pro_avatar_one_1795068461594.jpg"
                alt="Gestão de Equipa e Profissionais"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15"
              />
              <span className="relative z-10 w-10 h-10 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </span>
              <div className="relative z-10 text-white">
                <p className="font-[family-name:var(--font-jakarta)] text-lg font-medium">
                  Equipa &amp; Agenda
                </p>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Turnos individuais, pausas de almoço, folgas e bloqueios por profissional.
                </p>
              </div>
            </Link>

            <Link
              href="/login"
              className="group relative rounded-[20px] overflow-hidden aspect-[3/4] bg-zinc-900 flex flex-col justify-between p-5"
            >
              <img
                src="/images/salon_studio_cover_1795068461036.jpg"
                alt="Controlo Financeiro e Caixa em Kwanzas"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15"
              />
              <span className="relative z-10 w-10 h-10 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </span>
              <div className="relative z-10 text-white">
                <p className="font-[family-name:var(--font-jakarta)] text-lg font-medium">
                  Caixa &amp; Comissões Kz
                </p>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Multicaixa Express, TPA, numerário, despesas e fecho diário auditado.
                </p>
              </div>
            </Link>

            <Link
              href="#planos"
              className="group relative rounded-[20px] overflow-hidden aspect-[3/4] bg-zinc-900 flex flex-col justify-between p-5"
            >
              <img
                src="/images/pro_avatar_two_1795068461143.jpg"
                alt="Administração Multi-Tenant Salão+"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15"
              />
              <span className="relative z-10 w-10 h-10 rounded-full bg-[#A8DF1A] text-[#142318] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div className="relative z-10 text-white">
                <p className="font-[family-name:var(--font-jakarta)] text-lg font-medium">
                  Salão+ Admin
                </p>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Isolamento estrito entre salões, subscrições em Kz e auditoria RBAC.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Secção 4: Planos em Kwanzas (Alinhada com a mesma estética #FFFFFF / #F5F4F1 / #A8DF1A) */}
      <section id="planos" className="max-w-[1380px] mx-auto px-3 sm:px-6 mt-12 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 px-2">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
              Subscrição Mensal · Angola
            </span>
            <h2 className="font-[family-name:var(--font-jakarta)] text-2xl sm:text-3xl font-normal tracking-tight text-[#142318] mt-1">
              Planos pensados para salões em Luanda
            </h2>
          </div>
          <Link
            href="/login/gestao?tab=register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#142318] text-white text-xs font-medium hover:bg-zinc-800 transition-colors self-start md:self-auto"
          >
            Registar o Meu Salão <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-[24px] bg-[#F5F4F1] p-7 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500">Para estúdios independentes</p>
              <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-medium text-[#142318] mt-1">
                Essencial
              </h3>
              <p className="font-mono text-2xl font-semibold text-[#142318] tabular-nums mt-4">
                25.000 Kz <span className="text-xs font-sans font-normal text-zinc-500">/ mês</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-600">
                <li>· Até 3 profissionais ativas</li>
                <li>· Página pública de marcações</li>
                <li>· Proteção anti-conflito de horários</li>
                <li>· Ficha de clientes sem duplicados</li>
              </ul>
            </div>
            <Link
              href="/login/gestao?tab=register"
              className="mt-7 block text-center py-2.5 px-4 rounded-full bg-white text-[#142318] text-sm font-medium hover:bg-zinc-100 transition-colors"
            >
              Criar conta do salão
            </Link>
          </div>

          <div className="rounded-[24px] bg-[#A8DF1A] p-7 flex flex-col justify-between text-[#142318]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#142318]/75">
                Mais escolhido em Luanda
              </p>
              <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold mt-1">
                Profissional
              </h3>
              <p className="font-mono text-2xl font-semibold tabular-nums mt-4">
                45.000 Kz <span className="text-xs font-sans font-normal text-[#142318]/75">/ mês</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#142318]/85">
                <li>· Até 12 profissionais com agenda própria</li>
                <li>· Caixa diário, pagamentos parciais e despesas</li>
                <li>· Cálculo automático de comissões</li>
                <li>· Pré-reservas com expiração automática</li>
              </ul>
            </div>
            <Link
              href="/login/gestao?tab=register"
              className="mt-7 block text-center py-2.5 px-4 rounded-full bg-[#142318] text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              Registar salão agora
            </Link>
          </div>

          <div className="rounded-[24px] bg-[#F5F4F1] p-7 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500">Para redes e espaços multi-equipa</p>
              <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-medium text-[#142318] mt-1">
                Empresarial
              </h3>
              <p className="font-mono text-2xl font-semibold text-[#142318] tabular-nums mt-4">
                85.000 Kz <span className="text-xs font-sans font-normal text-zinc-500">/ mês</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-600">
                <li>· Profissionais ilimitadas</li>
                <li>· Múltiplas sessões de caixa e auditoria</li>
                <li>· Regras personalizadas por serviço</li>
                <li>· Suporte prioritário em Luanda</li>
              </ul>
            </div>
            <Link
              href="/login/gestao?tab=register"
              className="mt-7 block text-center py-2.5 px-4 rounded-full bg-white text-[#142318] text-sm font-medium hover:bg-zinc-100 transition-colors"
            >
              Começar com Empresarial
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200/80 py-8">
        <div className="max-w-[1380px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>Salão+ · Gestão e Agendamentos para Salões de Beleza em Angola (Africa/Luanda · AOA/Kz)</p>
          <div className="flex items-center gap-6">
            <Link href="/salao/luanda-esthetique" className="hover:text-[#142318]">
              Luanda Esthétique
            </Link>
            <Link href="/salao/kizomba-beauty" className="hover:text-[#142318]">
              Kizomba Beauty Studio
            </Link>
            <Link href="/login" className="hover:text-[#142318]">
              Aceder à Gestão
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
