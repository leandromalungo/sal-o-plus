// Seed idempotente inicial para Luanda (Fuso Africa/Luanda, Moeda AOA/Kz)

import bcrypt from 'bcryptjs';
import { getDb } from './client.ts';
import { addDays, getLuandaNow } from '../utils/time.ts';

let seededMetaDbRef: unknown = null;
let seededDemoDbRef: unknown = null;

/**
 * Garante apenas metadados base (papéis e permissões) em ambiente de produção.
 * Não cria salões nem contas de demonstração/teste em execução normal.
 */
export function ensureSeeded(): void {
  const db = getDb();
  if (seededMetaDbRef === db) {
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const roles = [
      { id: 'role_super_admin', name: 'SUPER_ADMIN', description: 'Administrador global da plataforma Salão+' },
      { id: 'role_owner', name: 'OWNER', description: 'Proprietária com controlo total do seu salão' },
      { id: 'role_receptionist', name: 'RECEPTIONIST', description: 'Recepção, agenda, clientes e caixa' },
      { id: 'role_professional', name: 'PROFESSIONAL', description: 'Profissional com acesso apenas à própria agenda' },
    ];
    for (const r of roles) {
      db.prepare('INSERT OR IGNORE INTO roles (id, name, description) VALUES (?, ?, ?)').run(r.id, r.name, r.description);
    }

    const permissions = [
      { id: 'perm_manage_platform', code: 'platform:manage', description: 'Gerir todos os salões e subscrições' },
      { id: 'perm_manage_salon', code: 'salon:manage', description: 'Gerir configurações e equipa do salão' },
      { id: 'perm_view_finance', code: 'finance:view', description: 'Consultar receitas, despesas, caixa e comissões' },
      { id: 'perm_manage_bookings', code: 'bookings:manage', description: 'Criar, reagendar e cancelar marcações do salão' },
      { id: 'perm_view_own_agenda', code: 'agenda:own', description: 'Consultar apenas os próprios agendamentos' },
    ];
    for (const p of permissions) {
      db.prepare('INSERT OR IGNORE INTO permissions (id, code, description) VALUES (?, ?, ?)').run(p.id, p.code, p.description);
    }

    db.exec('COMMIT');
    seededMetaDbRef = db;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignora
    }
    throw error;
  }
}

/**
 * Fixtures isoladas exclusivamente para a suite automatizada (node:test em memória).
 */
export function seedTestFixtures(): void {
  ensureSeeded();
  const db = getDb();
  if (seededDemoDbRef === db) {
    return;
  }

  const existing = db.prepare('SELECT COUNT(*) as total FROM salons').get() as { total: number };
  if (existing.total > 0) {
    seededDemoDbRef = db;
    return;
  }

  const now = getLuandaNow();
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const createdAt = now.iso;

  const passwordHash = bcrypt.hashSync('Salao@2026', 10);

  db.exec('BEGIN IMMEDIATE');
  try {
    // Salões de fixture para testes
    const insertSalon = db.prepare(`
      INSERT INTO salons (
        id, name, slug, description, address, city, phone, email,
        logo_url, cover_url, timezone, currency,
        slot_interval_minutes, min_advance_hours, max_advance_days,
        min_cancel_hours, pending_hold_minutes, allow_client_cancel,
        is_temporarily_closed, closure_reason, status, plan_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSalon.run(
      'salon_luanda_1',
      'Luanda Esthétique',
      'luanda-esthetique',
      'Estúdio contemporâneo de cuidados capilares, tranças de assinatura, manicure e tratamentos faciais em Talatona.',
      'Av. Pedro de Castro Van-Dúnem Loy, Talatona',
      'Luanda',
      '+244 923 410 800',
      'contacto@luandaesthetique.ao',
      '/images/salon_studio_cover_1795068461036.jpg',
      '/images/hero_salon_luanda_1795068461488.jpg',
      'Africa/Luanda',
      'AOA',
      30, // intervalos de 30 min
      2,  // antecedência mínima 2h
      60, // limite máximo 60 dias
      4,  // cancelamento até 4h antes
      10, // reserva temporária 10 min
      1,
      0,
      null,
      'ACTIVE',
      'Profissional',
      createdAt
    );

    insertSalon.run(
      'salon_luanda_2',
      'Kizomba Beauty Studio',
      'kizomba-beauty',
      'Especialistas em coloração, extensões e estética corporal no Miramar.',
      'Rua da Missão, nº 42, Miramar',
      'Luanda',
      '+244 924 780 120',
      'agenda@kizombabeauty.ao',
      '/images/salon_studio_cover_1795068461036.jpg',
      '/images/salon_studio_cover_1795068461036.jpg',
      'Africa/Luanda',
      'AOA',
      30,
      2,
      45,
      6,
      10,
      1,
      0,
      null,
      'ACTIVE',
      'Essencial',
      createdAt
    );

    // Subscrições
    db.prepare(
      'INSERT INTO subscriptions (id, salon_id, plan_name, monthly_price_kz, status, renews_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('sub_1', 'salon_luanda_1', 'Profissional', 45000, 'ACTIVE', addDays(today, 28));

    db.prepare(
      'INSERT INTO subscriptions (id, salon_id, plan_name, monthly_price_kz, status, renews_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('sub_2', 'salon_luanda_2', 'Essencial', 25000, 'ACTIVE', addDays(today, 15));

    // Utilizadores e Membros
    const insertUser = db.prepare(
      'INSERT INTO users (id, email, password_hash, name, phone, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );
    const insertMember = db.prepare(
      'INSERT INTO salon_members (id, salon_id, user_id, role, professional_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );

    insertUser.run('user_super_admin', 'admin@salaomais.ao', passwordHash, 'Helena Neto (Admin)', '+244 923 000 001', createdAt);
    insertMember.run('mem_super', null, 'user_super_admin', 'SUPER_ADMIN', null, createdAt);

    insertUser.run('user_owner_1', 'dona@luandaesthetique.ao', passwordHash, 'Miriam Tavares', '+244 923 410 801', createdAt);
    insertMember.run('mem_owner_1', 'salon_luanda_1', 'user_owner_1', 'OWNER', null, createdAt);

    insertUser.run('user_recep_1', 'recepcao@luandaesthetique.ao', passwordHash, 'Beatriz Mateus', '+244 923 410 802', createdAt);
    insertMember.run('mem_recep_1', 'salon_luanda_1', 'user_recep_1', 'RECEPTIONIST', null, createdAt);

    insertUser.run('user_pro_1', 'ana.silva@luandaesthetique.ao', passwordHash, 'Ana Silva', '+244 923 410 810', createdAt);
    insertMember.run('mem_pro_1', 'salon_luanda_1', 'user_pro_1', 'PROFESSIONAL', 'pro_1', createdAt);

    insertUser.run('user_owner_2', 'dona@kizomba.ao', passwordHash, 'Jéssica Fernandes', '+244 924 780 121', createdAt);
    insertMember.run('mem_owner_2', 'salon_luanda_2', 'user_owner_2', 'OWNER', null, createdAt);

    // Profissionais (Salão 1)
    const insertPro = db.prepare(`
      INSERT INTO professionals (
        id, salon_id, user_id, name, phone, email, avatar_url,
        specialties, commission_rate, buffer_minutes_override, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insertPro.run(
      'pro_1',
      'salon_luanda_1',
      'user_pro_1',
      'Ana Silva',
      '+244 923 410 810',
      'ana.silva@luandaesthetique.ao',
      '/images/pro_avatar_one_1795068461594.jpg',
      'Tranças, Tratamento Capilar, Corte e Styling',
      45,
      null,
      createdAt
    );

    insertPro.run(
      'pro_2',
      'salon_luanda_1',
      null,
      'Carla Domingos',
      '+244 923 410 811',
      'carla@luandaesthetique.ao',
      '/images/pro_avatar_two_1795068461143.jpg',
      'Manicure Gel, Pedicure Spa, Design de Unhas',
      40,
      null,
      createdAt
    );

    insertPro.run(
      'pro_3',
      'salon_luanda_1',
      null,
      'Tânia Lopes',
      '+244 923 410 812',
      'tania@luandaesthetique.ao',
      '/images/pro_avatar_one_1795068461594.jpg',
      'Manicure, Pedicure, Hidratação Capilar',
      40,
      null,
      createdAt
    );

    // Profissional Salão 2 (para isolamento multi-tenant)
    insertPro.run(
      'pro_salon2_1',
      'salon_luanda_2',
      null,
      'Djamila Costa',
      '+244 924 780 130',
      'djamila@kizombabeauty.ao',
      '/images/pro_avatar_two_1795068461143.jpg',
      'Coloração, Extensões',
      45,
      null,
      createdAt
    );

    // Horários do Salão 1: Seg-Sex 08:00-18:00, Sáb 08:00-16:00, Dom encerrado
    const insertSalonHour = db.prepare(`
      INSERT INTO salon_working_hours (id, salon_id, day_of_week, is_open, open_time, close_time, break_start, break_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (let d = 0; d <= 6; d++) {
      if (d === 0) {
        insertSalonHour.run(`swh_1_${d}`, 'salon_luanda_1', d, 0, '08:00', '18:00', null, null);
        insertSalonHour.run(`swh_2_${d}`, 'salon_luanda_2', d, 0, '09:00', '18:00', null, null);
      } else if (d === 6) {
        insertSalonHour.run(`swh_1_${d}`, 'salon_luanda_1', d, 1, '08:00', '16:00', null, null);
        insertSalonHour.run(`swh_2_${d}`, 'salon_luanda_2', d, 1, '09:00', '15:00', null, null);
      } else {
        insertSalonHour.run(`swh_1_${d}`, 'salon_luanda_1', d, 1, '08:00', '18:00', null, null);
        insertSalonHour.run(`swh_2_${d}`, 'salon_luanda_2', d, 1, '09:00', '18:00', null, null);
      }
    }

    // Horários individuais das profissionais
    const insertProHour = db.prepare(`
      INSERT INTO professional_working_hours (id, salon_id, professional_id, day_of_week, is_working, start_time, end_time, lunch_start, lunch_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let d = 0; d <= 6; d++) {
      // Ana Silva: Seg-Sáb, almoço 12:30-13:30, folga Domingo
      insertProHour.run(`pwh_1_${d}`, 'salon_luanda_1', 'pro_1', d, d === 0 ? 0 : 1, '08:00', d === 6 ? '16:00' : '18:00', d === 6 ? null : '12:30', d === 6 ? null : '13:30');
      // Carla Domingos: Ter-Sáb (folga Domingo e Segunda), almoço 13:00-14:00
      insertProHour.run(`pwh_2_${d}`, 'salon_luanda_1', 'pro_2', d, d === 0 || d === 1 ? 0 : 1, '08:30', d === 6 ? '16:00' : '18:00', '13:00', '14:00');
      // Tânia Lopes: Seg-Sáb, almoço 12:00-13:00
      insertProHour.run(`pwh_3_${d}`, 'salon_luanda_1', 'pro_3', d, d === 0 ? 0 : 1, '08:00', d === 6 ? '16:00' : '17:30', '12:00', '13:00');
      // Djamila (Salão 2)
      insertProHour.run(`pwh_s2_${d}`, 'salon_luanda_2', 'pro_salon2_1', d, d === 0 ? 0 : 1, '09:00', d === 6 ? '15:00' : '18:00', '13:00', '14:00');
    }

    // Categorias & Serviços (Salão 1)
    const insertCat = db.prepare('INSERT INTO service_categories (id, salon_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)');
    insertCat.run('cat_1', 'salon_luanda_1', 'Cabelo & Tranças', 'Cortes, hidratação profunda e tranças de assinatura', 1);
    insertCat.run('cat_2', 'salon_luanda_1', 'Unhas & Mãos', 'Manicure tradicional, gel e pedicure spa', 2);
    insertCat.run('cat_3', 'salon_luanda_1', 'Tratamentos Faciais', 'Limpeza e revitalização facial', 3);
    insertCat.run('cat_s2_1', 'salon_luanda_2', 'Coloração & Extensões', 'Serviços capilares exclusivos Miramar', 1);

    const insertSvc = db.prepare(`
      INSERT INTO services (id, salon_id, category_id, name, description, price_kz, duration_minutes, buffer_minutes, image_url, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insertSvc.run('svc_corte', 'salon_luanda_1', 'cat_1', 'Corte & Escova Modeladora', 'Corte técnico adaptado ao formato do rosto com finalização brilhante.', 12000, 30, 0, null, createdAt);
    insertSvc.run('svc_tratamento', 'salon_luanda_1', 'cat_1', 'Tratamento Capilar Nutritivo', 'Reconstrução intensiva com óleos botânicos e vaporização.', 22000, 90, 15, null, createdAt);
    insertSvc.run('svc_trancas', 'salon_luanda_1', 'cat_1', 'Tranças Box Braids Médias', 'Trançado preciso com acabamento leve e proteção dos fios.', 35000, 120, 15, null, createdAt);
    insertSvc.run('svc_manicure', 'salon_luanda_1', 'cat_2', 'Manicure Gel Completa', 'Cuticulagem cuidadosa, esmaltação em gel de longa duração e hidratação.', 8500, 60, 15, null, createdAt);
    insertSvc.run('svc_pedicure', 'salon_luanda_1', 'cat_2', 'Pedicure Spa Relaxante', 'Esfoliação mineral, tratamento plantar e esmaltação perfeita.', 10000, 45, 0, null, createdAt);
    insertSvc.run('svc_facial', 'salon_luanda_1', 'cat_3', 'Limpeza Facial Luminosidade', 'Limpeza profunda com extração suave e máscara calmante.', 18000, 60, 15, null, createdAt);

    insertSvc.run('svc_s2_color', 'salon_luanda_2', 'cat_s2_1', 'Coloração & Brilho', 'Coloração personalizada sem amónia.', 28000, 90, 15, null, createdAt);

    // Associação Profissional <-> Serviços
    const linkProSvc = db.prepare('INSERT INTO professional_services (professional_id, service_id, salon_id) VALUES (?, ?, ?)');
    // Ana Silva: Corte, Tratamento, Tranças
    linkProSvc.run('pro_1', 'svc_corte', 'salon_luanda_1');
    linkProSvc.run('pro_1', 'svc_tratamento', 'salon_luanda_1');
    linkProSvc.run('pro_1', 'svc_trancas', 'salon_luanda_1');
    // Carla Domingos: Manicure, Pedicure, Facial
    linkProSvc.run('pro_2', 'svc_manicure', 'salon_luanda_1');
    linkProSvc.run('pro_2', 'svc_pedicure', 'salon_luanda_1');
    linkProSvc.run('pro_2', 'svc_facial', 'salon_luanda_1');
    // Tânia Lopes: Manicure, Pedicure, Tratamento, Corte
    linkProSvc.run('pro_3', 'svc_manicure', 'salon_luanda_1');
    linkProSvc.run('pro_3', 'svc_pedicure', 'salon_luanda_1');
    linkProSvc.run('pro_3', 'svc_tratamento', 'salon_luanda_1');
    linkProSvc.run('pro_3', 'svc_corte', 'salon_luanda_1');
    // Djamila (Salão 2)
    linkProSvc.run('pro_salon2_1', 'svc_s2_color', 'salon_luanda_2');

    // Feriados de Angola (exemplos)
    db.prepare('INSERT INTO holidays (id, salon_id, date, name, is_closed, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('hol_1', 'salon_luanda_1', '2026-11-11', 'Dia da Independência Nacional', 1, null, null);
    db.prepare('INSERT INTO holidays (id, salon_id, date, name, is_closed, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('hol_2', 'salon_luanda_1', '2026-12-25', 'Dia de Natal', 1, null, null);

    // Clientes (Salão 1 & Salão 2)
    const insertCust = db.prepare(`
      INSERT INTO customers (id, salon_id, name, phone, normalized_phone, email, preferences, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCust.run('cust_1', 'salon_luanda_1', 'Maria Fernandes', '+244 923 551 200', '244923551200', 'maria.fernandes@exemplo.ao', 'Prefere tons nude em manicure gel', 'Cliente VIP desde 2025', createdAt);
    insertCust.run('cust_2', 'salon_luanda_1', 'Joana Gaspar', '+244 924 112 304', '244924112304', null, 'Cabelo sensível ao calor', null, createdAt);
    insertCust.run('cust_3', 'salon_luanda_1', 'Luísa Mateus', '+244 922 809 441', '244922809441', 'luisa.mateus@exemplo.ao', 'Prefere horário da manhã', null, createdAt);
    insertCust.run('cust_s2_1', 'salon_luanda_2', 'Rosa Sebastião', '+244 925 330 990', '244925330990', null, null, null, createdAt);

    // Escolha de uma data útil futura garantida para demonstração (próximo dia útil se amanhã for domingo)
    const targetDay = new Date(`${tomorrow}T12:00:00Z`).getUTCDay() === 0 ? addDays(tomorrow, 1) : tomorrow;
    const activeDay = new Date(`${today}T12:00:00Z`).getUTCDay() === 0 ? addDays(today, 1) : today;

    // Marcações iniciais (ontem concluída + hoje/amanhã confirmadas e pendentes)
    const insertAppt = db.prepare(`
      INSERT INTO appointments (
        id, salon_id, booking_code, customer_id, professional_id,
        date, start_time, end_time, service_end_time,
        start_minutes, end_minutes, total_duration_minutes, total_buffer_minutes,
        total_price_kz, paid_amount_kz, payment_status, status,
        hold_expires_at, notes, cancellation_reason, created_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertApptSvc = db.prepare(`
      INSERT INTO appointment_services (id, appointment_id, service_id, service_name, price_kz, duration_minutes, buffer_minutes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertHist = db.prepare(`
      INSERT INTO appointment_status_history (id, salon_id, appointment_id, from_status, to_status, changed_by, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Marcação concluída ontem (com pagamento total + comissão)
    insertAppt.run(
      'appt_seed_1', 'salon_luanda_1', 'SL-9012', 'cust_1', 'pro_1',
      yesterday, '10:00', '11:45', '11:30',
      600, 705, 90, 15,
      22000, 22000, 'PAID', 'COMPLETED',
      null, 'Tratamento nutritivo trimestral', null, 'MANAGEMENT', createdAt, createdAt
    );
    insertApptSvc.run('as_seed_1', 'appt_seed_1', 'svc_tratamento', 'Tratamento Capilar Nutritivo', 22000, 90, 15, 0);
    insertHist.run('hist_seed_1', 'salon_luanda_1', 'appt_seed_1', 'CONFIRMED', 'COMPLETED', 'user_owner_1', 'Atendimento concluído', createdAt);

    // 2. Marcação hoje às 10:00-11:15 com Tânia Lopes (Manicure 60m + 15m buffer) - pagamento parcial
    insertAppt.run(
      'appt_seed_2', 'salon_luanda_1', 'SL-9045', 'cust_2', 'pro_3',
      activeDay, '10:00', '11:15', '11:00',
      600, 675, 60, 15,
      8500, 4000, 'PARTIAL', 'CONFIRMED',
      null, 'Sinal pago via Multicaixa Express', null, 'PUBLIC', createdAt, createdAt
    );
    insertApptSvc.run('as_seed_2', 'appt_seed_2', 'svc_manicure', 'Manicure Gel Completa', 8500, 60, 15, 0);
    insertHist.run('hist_seed_2', 'salon_luanda_1', 'appt_seed_2', null, 'CONFIRMED', 'cust_2', 'Reserva pública', createdAt);

    // 3. Marcação futura para Ana Silva às 09:00-11:15 (Tranças 120m + 15m buffer)
    insertAppt.run(
      'appt_seed_3', 'salon_luanda_1', 'SL-9088', 'cust_3', 'pro_1',
      targetDay, '09:00', '11:15', '11:00',
      540, 675, 120, 15,
      35000, 0, 'PENDING', 'CONFIRMED',
      null, 'Tranças médias cor castanho escuro', null, 'PUBLIC', createdAt, createdAt
    );
    insertApptSvc.run('as_seed_3', 'appt_seed_3', 'svc_trancas', 'Tranças Box Braids Médias', 35000, 120, 15, 0);
    insertHist.run('hist_seed_3', 'salon_luanda_1', 'appt_seed_3', null, 'CONFIRMED', 'cust_3', 'Reserva pública', createdAt);

    // 4. Marcação Salão 2 (para provar isolamento multi-tenant)
    insertAppt.run(
      'appt_seed_s2', 'salon_luanda_2', 'KB-4410', 'cust_s2_1', 'pro_salon2_1',
      targetDay, '10:00', '11:45', '11:30',
      600, 705, 90, 15,
      28000, 0, 'PENDING', 'CONFIRMED',
      null, null, null, 'MANAGEMENT', createdAt, createdAt
    );
    insertApptSvc.run('as_seed_s2', 'appt_seed_s2', 'svc_s2_color', 'Coloração & Brilho', 28000, 90, 15, 0);

    // Bloqueio de horário exemplo (Reunião de equipa às 15:00-15:30 no targetDay)
    db.prepare(`
      INSERT INTO blocked_time_slots (id, salon_id, professional_id, date, start_time, end_time, start_minutes, end_minutes, reason, block_type, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('blk_seed_1', 'salon_luanda_1', 'pro_1', targetDay, '15:00', '16:00', 900, 960, 'Formação de novos produtos capilares', 'MEETING', 'user_owner_1', createdAt);

    // Caixa aberto hoje + Pagamentos + Despesas + Comissões
    db.prepare(`
      INSERT INTO cash_registers (id, salon_id, status, opening_balance_kz, opened_by, opened_at, notes)
      VALUES (?, ?, 'OPEN', ?, ?, ?, ?)
    `).run('cr_seed_1', 'salon_luanda_1', 25000, 'user_recep_1', createdAt, 'Abertura diária Talatona');

    db.prepare(`
      INSERT INTO payments (id, salon_id, appointment_id, customer_id, amount_kz, method, status, notes, recorded_by, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)
    `).run('pay_seed_1', 'salon_luanda_1', 'appt_seed_1', 'cust_1', 22000, 'TPA', 'Pagamento integral na recepção', 'user_recep_1', createdAt);

    db.prepare(`
      INSERT INTO payments (id, salon_id, appointment_id, customer_id, amount_kz, method, status, notes, recorded_by, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)
    `).run('pay_seed_2', 'salon_luanda_1', 'appt_seed_2', 'cust_2', 4000, 'MULTICAIXA_EXPRESS', 'Sinal parcial de confirmação', 'user_recep_1', createdAt);

    db.prepare(`
      INSERT INTO cash_transactions (id, salon_id, cash_register_id, type, amount_kz, method, description, reference_id, recorded_by, created_at)
      VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?)
    `).run('ctx_seed_1', 'salon_luanda_1', 'cr_seed_1', 4000, 'MULTICAIXA_EXPRESS', 'Sinal Manicure - Joana Gaspar (SL-9045)', 'pay_seed_2', 'user_recep_1', createdAt);

    db.prepare(`
      INSERT INTO expenses (id, salon_id, category, description, amount_kz, expense_date, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exp_seed_1', 'salon_luanda_1', 'Materiais', 'Reposição de géis UV e óleos botânicos', 14500, activeDay, 'user_owner_1', createdAt);

    db.prepare(`
      INSERT INTO expenses (id, salon_id, category, description, amount_kz, expense_date, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('exp_seed_2', 'salon_luanda_1', 'Energia', 'Recarga de energia pré-paga', 8000, yesterday, 'user_owner_1', createdAt);

    db.prepare(`
      INSERT INTO commissions (id, salon_id, professional_id, appointment_id, service_value_kz, received_amount_kz, commission_rate, commission_amount_kz, salon_net_kz, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
    `).run('com_seed_1', 'salon_luanda_1', 'pro_1', 'appt_seed_1', 22000, 22000, 45, 9900, 12100, createdAt);

    // Preferências de Notificação + Registo interno
    db.prepare(`
      INSERT INTO notification_preferences (id, salon_id, whatsapp_enabled, sms_enabled, email_enabled, reminder_hours_before, second_reminder_hours)
      VALUES (?, ?, 1, 0, 1, 24, 2)
    `).run('np_1', 'salon_luanda_1');

    db.prepare(`
      INSERT INTO notifications (id, salon_id, appointment_id, channel, event_type, recipient, message, status, scheduled_for, created_at)
      VALUES (?, ?, ?, 'WHATSAPP', 'BOOKING_CONFIRMED', ?, ?, 'QUEUED', ?, ?)
    `).run(
      'notif_seed_1',
      'salon_luanda_1',
      'appt_seed_3',
      '+244 922 809 441',
      'Olá Luísa! A sua marcação SL-9088 para Tranças Box Braids Médias está confirmada.',
      targetDay,
      createdAt
    );

    db.exec('COMMIT');
    seededDemoDbRef = db;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignora
    }
    throw error;
  }
}
