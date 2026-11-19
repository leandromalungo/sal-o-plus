// Tipos e constantes de domínio do Salão+

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'RECEPTIONIST' | 'PROFESSIONAL';

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export type PaymentMethod =
  | 'MULTICAIXA_EXPRESS'
  | 'TPA'
  | 'CASH'
  | 'BANK_TRANSFER';

export type SalonStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export type NotificationChannel = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'INTERNAL';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  salonId: string | null;
  professionalId: string | null;
}

export interface Salon {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  coverUrl: string | null;
  timezone: string;
  currency: string;
  slotIntervalMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  minCancelHours: number;
  pendingHoldMinutes: number;
  allowClientCancel: boolean;
  isTemporarilyClosed: boolean;
  closureReason: string | null;
  status: SalonStatus;
  planName: string;
  createdAt: string;
}

export interface SalonWorkingHour {
  id: string;
  salonId: string;
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda ... 6 = Sábado
  isOpen: boolean;
  openTime: string; // HH:MM
  closeTime: string; // HH:MM
  breakStart: string | null;
  breakEnd: string | null;
}

export interface Professional {
  id: string;
  salonId: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  specialties: string;
  commissionRate: number; // 0..100 (%)
  bufferMinutesOverride: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface ProfessionalWorkingHour {
  id: string;
  salonId: string;
  professionalId: string;
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  lunchStart: string | null;
  lunchEnd: string | null;
}

export interface ServiceCategory {
  id: string;
  salonId: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface ServiceItem {
  id: string;
  salonId: string;
  categoryId: string | null;
  name: string;
  description: string;
  priceKz: number;
  durationMinutes: number;
  bufferMinutes: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  email: string | null;
  preferences: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BlockedTimeSlot {
  id: string;
  salonId: string;
  professionalId: string | null; // null = bloqueio global do salão
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  reason: string;
  blockType: 'MEETING' | 'LUNCH' | 'MAINTENANCE' | 'VACATION' | 'PERSONAL' | 'EXTRAORDINARY';
  createdBy: string | null;
  createdAt: string;
}

export interface Holiday {
  id: string;
  salonId: string;
  date: string; // YYYY-MM-DD
  name: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface AppointmentServiceSnapshot {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  priceKz: number;
  durationMinutes: number;
  bufferMinutes: number;
  sortOrder: number;
}

export interface Appointment {
  id: string;
  salonId: string;
  bookingCode: string;
  customerId: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM (incluindo intervalo/preparação)
  serviceEndTime: string; // HH:MM (fim real do atendimento antes do buffer)
  startMinutes: number;
  endMinutes: number;
  totalDurationMinutes: number;
  totalBufferMinutes: number;
  totalPriceKz: number;
  paidAmountKz: number;
  paymentStatus: PaymentStatus;
  status: AppointmentStatus;
  holdExpiresAt: string | null;
  notes: string | null;
  cancellationReason: string | null;
  createdSource: 'PUBLIC' | 'MANAGEMENT';
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  time: string; // HH:MM
  endTime: string; // HH:MM (fim do serviço)
  blockedUntil: string; // HH:MM (fim + buffer)
  availableProfessionalIds: string[];
  recommendedProfessionalId: string;
}

export const ACTIVE_BLOCKING_STATUSES: AppointmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Proprietária',
  RECEPTIONIST: 'Recepcionista',
  PROFESSIONAL: 'Profissional',
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MULTICAIXA_EXPRESS: 'Multicaixa Express',
  TPA: 'TPA / Cartão',
  CASH: 'Dinheiro (Kz)',
  BANK_TRANSFER: 'Transferência Bancária',
};

export const DAY_NAMES_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
