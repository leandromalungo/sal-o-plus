// Camadas de autenticação isoladas por tipo de utilizador e portal dedicado

import type { UserRole } from '../types/domain.ts';

export type AuthLayer = 'gestao' | 'recepcao' | 'profissional' | 'admin';

export interface AuthLayerMeta {
  id: AuthLayer;
  cookieName: string;
  loginPath: string;
  redirectPath: string;
  allowedRoles: readonly UserRole[];
  badge: string;
  title: string;
  headlinePrefix: string;
  headlineHighlight: string;
  subtitle: string;
  steps: readonly [string, string, string];
  allowRegistration: boolean;
}

export const AUTH_LAYERS: Record<AuthLayer, AuthLayerMeta> = {
  gestao: {
    id: 'gestao',
    cookieName: 'salaomais_session_gestao',
    loginPath: '/login/gestao',
    redirectPath: '/gestao',
    allowedRoles: ['OWNER'],
    badge: 'Camada Proprietária & Gerência',
    title: 'Portal da Proprietária',
    headlinePrefix: 'Direção do',
    headlineHighlight: 'Salão',
    subtitle: 'Controlo integral da equipa, serviços, regras de agenda e finanças em Kwanzas.',
    steps: [
      'Aceda ou registe o seu salão',
      'Configure equipa, serviços e regras',
      'Acompanhe caixa, lucros e comissões',
    ],
    allowRegistration: true,
  },
  recepcao: {
    id: 'recepcao',
    cookieName: 'salaomais_session_recepcao',
    loginPath: '/login/recepcao',
    redirectPath: '/gestao/agenda',
    allowedRoles: ['RECEPTIONIST'],
    badge: 'Camada Receção & Balcão',
    title: 'Portal da Receção',
    headlinePrefix: 'Balcão e',
    headlineHighlight: 'Agenda',
    subtitle: 'Atendimento presencial, check-in de clientes, pagamentos e fecho de caixa do turno.',
    steps: [
      'Entre com credenciais da receção',
      'Confirme chegadas e novas marcações',
      'Registe pagamentos e feche o caixa',
    ],
    allowRegistration: false,
  },
  profissional: {
    id: 'profissional',
    cookieName: 'salaomais_session_profissional',
    loginPath: '/login/profissional',
    redirectPath: '/gestao/agenda',
    allowedRoles: ['PROFESSIONAL'],
    badge: 'Camada Profissional',
    title: 'Portal da Profissional',
    headlinePrefix: 'A Sua',
    headlineHighlight: 'Agenda',
    subtitle: 'Consulte os seus atendimentos do dia, horários livres e estados em tempo real.',
    steps: [
      'Aceda com o seu perfil individual',
      'Veja apenas os seus atendimentos',
      'Inicie e conclua cada serviço',
    ],
    allowRegistration: false,
  },
  admin: {
    id: 'admin',
    cookieName: 'salaomais_session_admin',
    loginPath: '/login/admin',
    redirectPath: '/admin',
    allowedRoles: ['SUPER_ADMIN'],
    badge: 'Camada Super Admin',
    title: 'Consola da Plataforma',
    headlinePrefix: 'Governação',
    headlineHighlight: 'Salão+',
    subtitle: 'Ativação de estabelecimentos, planos em Kwanzas, utilizadores e auditoria global.',
    steps: [
      'Autenticação restrita de plataforma',
      'Ative, suspenda ou altere planos',
      'Consulte indicadores e auditoria',
    ],
    allowRegistration: false,
  },
};

export const ALL_AUTH_LAYERS: AuthLayer[] = ['gestao', 'recepcao', 'profissional', 'admin'];
export const SALON_STAFF_LAYERS: AuthLayer[] = ['gestao', 'recepcao', 'profissional'];
export const GESTAO_FALLBACK_LAYER_COOKIE = 'salaomais_gestao_layer';

export function isValidAuthLayer(value: unknown): value is AuthLayer {
  return value === 'gestao' || value === 'recepcao' || value === 'profissional' || value === 'admin';
}

export function isRoleAllowedInLayer(role: UserRole, layer: AuthLayer): boolean {
  return AUTH_LAYERS[layer].allowedRoles.includes(role);
}

export function getDefaultLayerForRole(role: UserRole): AuthLayer {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'admin';
    case 'RECEPTIONIST':
      return 'recepcao';
    case 'PROFESSIONAL':
      return 'profissional';
    case 'OWNER':
    default:
      return 'gestao';
  }
}
