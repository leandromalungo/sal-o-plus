// Regras puras de controlo de acesso por perfil (RBAC) e isolamento multi-tenant

import type { SessionUser, UserRole } from '../types/domain.ts';

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = 'Sessão expirada ou não autenticada.') {
    super(message);
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = 'Sem permissão para executar esta operação.') {
    super(message);
  }
}

export function canAccessFinance(role: UserRole): boolean {
  return role === 'OWNER' || role === 'RECEPTIONIST' || role === 'SUPER_ADMIN';
}

export function canManageSalonSettings(role: UserRole): boolean {
  return role === 'OWNER' || role === 'SUPER_ADMIN';
}

export function canManageBookings(role: UserRole): boolean {
  return role === 'OWNER' || role === 'RECEPTIONIST' || role === 'SUPER_ADMIN';
}

export function assertSalonIsolation(user: SessionUser, targetSalonId: string): void {
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.salonId || user.salonId !== targetSalonId) {
    throw new ForbiddenError('Acesso negado: este recurso pertence a outro estabelecimento.');
  }
}
