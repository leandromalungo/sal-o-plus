// Camada de base de dados SQLite transacional (node:sqlite) com isolamento ACID e restrições de integridade

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

declare global {
  var __salaoMaisDb: DatabaseSync | undefined;
  var __salaoMaisDbPath: string | undefined;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), '.data', 'salaomais.db');

function isDirectoryWritable(dirPath: string, filePath?: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    if (filePath && fs.existsSync(filePath)) {
      fs.accessSync(filePath, fs.constants.W_OK);
    }
    return true;
  } catch {
    return false;
  }
}

export function resolveDbPath(): string {
  if (process.env.SALAO_DB_PATH) {
    return process.env.SALAO_DB_PATH;
  }

  const isServerless = Boolean(
    process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME
  );

  if (!isServerless && isDirectoryWritable(path.dirname(DEFAULT_DB_PATH), DEFAULT_DB_PATH)) {
    return DEFAULT_DB_PATH;
  }

  return path.join(os.tmpdir(), 'salaomais.db');
}

function applySchema(db: DatabaseSync): void {
  try {
    db.exec('PRAGMA journal_mode = WAL;');
  } catch {
    // Em alguns sistemas de ficheiros serverless o modo WAL pode não estar disponível
  }

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS salons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Luanda',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      logo_url TEXT,
      cover_url TEXT,
      timezone TEXT NOT NULL DEFAULT 'Africa/Luanda',
      currency TEXT NOT NULL DEFAULT 'AOA',
      slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
      min_advance_hours INTEGER NOT NULL DEFAULT 2,
      max_advance_days INTEGER NOT NULL DEFAULT 60,
      min_cancel_hours INTEGER NOT NULL DEFAULT 4,
      pending_hold_minutes INTEGER NOT NULL DEFAULT 10,
      allow_client_cancel INTEGER NOT NULL DEFAULT 1,
      is_temporarily_closed INTEGER NOT NULL DEFAULT 0,
      closure_reason TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      plan_name TEXT NOT NULL DEFAULT 'Profissional',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      auth_provider TEXT NOT NULL DEFAULT 'PASSWORD',
      name TEXT NOT NULL,
      phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS salon_members (
      id TEXT PRIMARY KEY,
      salon_id TEXT REFERENCES salons(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      professional_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_salon_members_user ON salon_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_salon_members_salon ON salon_members(salon_id);

    CREATE TABLE IF NOT EXISTS professionals (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      specialties TEXT NOT NULL DEFAULT '',
      commission_rate REAL NOT NULL DEFAULT 40,
      buffer_minutes_override INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_professionals_salon ON professionals(salon_id);

    CREATE TABLE IF NOT EXISTS service_categories (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_categories_salon ON service_categories(salon_id);

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES service_categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_kz INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      buffer_minutes INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_services_salon ON services(salon_id);

    CREATE TABLE IF NOT EXISTS professional_services (
      professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      PRIMARY KEY (professional_id, service_id)
    );
    CREATE INDEX IF NOT EXISTS idx_prof_services_salon ON professional_services(salon_id, service_id);

    CREATE TABLE IF NOT EXISTS salon_working_hours (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1,
      open_time TEXT NOT NULL,
      close_time TEXT NOT NULL,
      break_start TEXT,
      break_end TEXT,
      UNIQUE (salon_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS professional_working_hours (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      is_working INTEGER NOT NULL DEFAULT 1,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      lunch_start TEXT,
      lunch_end TEXT,
      UNIQUE (professional_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 1,
      open_time TEXT,
      close_time TEXT,
      UNIQUE (salon_id, date)
    );

    CREATE TABLE IF NOT EXISTS breaks (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      professional_id TEXT REFERENCES professionals(id) ON DELETE CASCADE,
      day_of_week INTEGER,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocked_time_slots (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      professional_id TEXT REFERENCES professionals(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL,
      reason TEXT NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'PERSONAL',
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_blocked_slots_lookup ON blocked_time_slots(salon_id, date, professional_id);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      normalized_phone TEXT NOT NULL,
      email TEXT,
      preferences TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (salon_id, normalized_phone)
    );
    CREATE INDEX IF NOT EXISTS idx_customers_salon ON customers(salon_id);

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      booking_code TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      service_end_time TEXT NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL,
      total_duration_minutes INTEGER NOT NULL,
      total_buffer_minutes INTEGER NOT NULL DEFAULT 0,
      total_price_kz INTEGER NOT NULL,
      paid_amount_kz INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      hold_expires_at TEXT,
      notes TEXT,
      cancellation_reason TEXT,
      created_source TEXT NOT NULL DEFAULT 'PUBLIC',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_availability
      ON appointments(salon_id, professional_id, date, status, start_minutes, end_minutes);
    CREATE INDEX IF NOT EXISTS idx_appointments_salon_date
      ON appointments(salon_id, date);

    -- Trigger de integridade no motor SQL: impede inserção de horários sobrepostos ativos para a mesma profissional
    CREATE TRIGGER IF NOT EXISTS prevent_overlapping_appointments_insert
    BEFORE INSERT ON appointments
    WHEN NEW.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
    BEGIN
      SELECT CASE
        WHEN EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.salon_id = NEW.salon_id
            AND a.professional_id = NEW.professional_id
            AND a.date = NEW.date
            AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
            AND (a.hold_expires_at IS NULL OR a.hold_expires_at > datetime('now'))
            AND a.start_minutes < NEW.end_minutes
            AND a.end_minutes > NEW.start_minutes
        )
        THEN RAISE(ABORT, 'OVERLAPPING_APPOINTMENT')
      END;
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_overlapping_appointments_update
    BEFORE UPDATE OF professional_id, date, start_minutes, end_minutes, status ON appointments
    WHEN NEW.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
    BEGIN
      SELECT CASE
        WHEN EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.id != NEW.id
            AND a.salon_id = NEW.salon_id
            AND a.professional_id = NEW.professional_id
            AND a.date = NEW.date
            AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
            AND (a.hold_expires_at IS NULL OR a.hold_expires_at > datetime('now'))
            AND a.start_minutes < NEW.end_minutes
            AND a.end_minutes > NEW.start_minutes
        )
        THEN RAISE(ABORT, 'OVERLAPPING_APPOINTMENT')
      END;
    END;

    CREATE TABLE IF NOT EXISTS appointment_services (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
      service_name TEXT NOT NULL,
      price_kz INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      buffer_minutes INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_appt_services_appt ON appointment_services(appointment_id);

    CREATE TABLE IF NOT EXISTS appointment_status_history (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT,
      reason TEXT,
      previous_date TEXT,
      previous_start_time TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_appt_history_appt ON appointment_status_history(appointment_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      amount_kz INTEGER NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      notes TEXT,
      recorded_by TEXT,
      paid_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_payments_salon ON payments(salon_id, paid_at);

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_kz INTEGER NOT NULL,
      expense_date TEXT NOT NULL,
      recorded_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_salon ON expenses(salon_id, expense_date);

    CREATE TABLE IF NOT EXISTS cash_registers (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'OPEN',
      opening_balance_kz INTEGER NOT NULL DEFAULT 0,
      closing_balance_kz INTEGER,
      expected_balance_kz INTEGER,
      opened_by TEXT,
      closed_by TEXT,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cash_registers_salon ON cash_registers(salon_id, opened_at);

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      cash_register_id TEXT NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'IN' | 'OUT'
      amount_kz INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'CASH',
      description TEXT NOT NULL,
      reference_id TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cash_tx_register ON cash_transactions(cash_register_id);

    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      service_value_kz INTEGER NOT NULL,
      received_amount_kz INTEGER NOT NULL,
      commission_rate REAL NOT NULL,
      commission_amount_kz INTEGER NOT NULL,
      salon_net_kz INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_commissions_salon ON commissions(salon_id, professional_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      event_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      scheduled_for TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_salon ON notifications(salon_id, created_at);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      whatsapp_enabled INTEGER NOT NULL DEFAULT 1,
      sms_enabled INTEGER NOT NULL DEFAULT 0,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      reminder_hours_before INTEGER NOT NULL DEFAULT 24,
      second_reminder_hours INTEGER NOT NULL DEFAULT 2,
      UNIQUE (salon_id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      salon_id TEXT NOT NULL UNIQUE REFERENCES salons(id) ON DELETE CASCADE,
      plan_name TEXT NOT NULL,
      monthly_price_kz INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      renews_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      salon_id TEXT,
      user_id TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_salon ON audit_logs(salon_id, created_at);
  `);

  const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name?: string }>;
  const hasAuthProvider = userColumns.some((col) => col.name === 'auth_provider');
  if (!hasAuthProvider) {
    db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'PASSWORD';");
  }
}

export function getDb(): DatabaseSync {
  const targetPath = resolveDbPath();

  if (globalThis.__salaoMaisDb && globalThis.__salaoMaisDbPath === targetPath) {
    return globalThis.__salaoMaisDb;
  }

  if (globalThis.__salaoMaisDb && globalThis.__salaoMaisDbPath !== targetPath) {
    try {
      globalThis.__salaoMaisDb.close();
    } catch {
      // ignora erro ao fechar conexão anterior em testes
    }
    globalThis.__salaoMaisDb = undefined;
  }

  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (
      targetPath !== DEFAULT_DB_PATH &&
      !fs.existsSync(targetPath) &&
      fs.existsSync(DEFAULT_DB_PATH)
    ) {
      try {
        fs.copyFileSync(DEFAULT_DB_PATH, targetPath);
      } catch {
        // Se não houver cópia prévia disponível, cria e executa seed normalmente em /tmp
      }
    }
  }

  const db = new DatabaseSync(targetPath);
  applySchema(db);

  globalThis.__salaoMaisDb = db;
  globalThis.__salaoMaisDbPath = targetPath;
  return db;
}

/**
 * Executa uma operação atómica com bloqueio imediato (BEGIN IMMEDIATE)
 * para garantir proteção contra reservas simultâneas / condições de corrida.
 */
export function runInTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignora erro se transação já foi revertida
    }
    throw error;
  }
}

export function resetDbForTests(newPath: string = ':memory:'): DatabaseSync {
  process.env.SALAO_DB_PATH = newPath;
  if (globalThis.__salaoMaisDb) {
    try {
      globalThis.__salaoMaisDb.close();
    } catch {
      // ignora
    }
    globalThis.__salaoMaisDb = undefined;
    globalThis.__salaoMaisDbPath = undefined;
  }
  return getDb();
}
