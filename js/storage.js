// Persistência dos lançamentos financeiros no localStorage
const STORAGE_KEY = 'financas_pro_transactions_v2';
const LEGACY_KEY = 'transactions';
const THEME_KEY = 'financas_pro_theme';

// Migra o formato antigo (type: 'divida' + recurring: true) para o novo type: 'assinatura'
function migrateLegacyRecurring(list) {
  let changed = false;
  const migrated = list.map(t => {
    if (t.type === 'divida' && t.recurring) {
      changed = true;
      const { recurring, ...rest } = t;
      return { ...rest, type: 'assinatura' };
    }
    if (t.type === 'divida' && 'recurring' in t) {
      changed = true;
      const { recurring, ...rest } = t;
      return rest;
    }
    return t;
  });
  return { migrated, changed };
}

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const { migrated, changed } = migrateLegacyRecurring(parsed);
      if (changed) persistTransactions(migrated);
      return migrated;
    } catch {
      return [];
    }
  }

  // Migração de dados da versão anterior
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw) || [];
      const migrated = legacy.map(t => ({
        id: t.id || Date.now() + Math.random(),
        date: t.date,
        type: t.type,
        description: t.description,
        amount: t.amount
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_KEY);
      return migrated;
    } catch {
      return [];
    }
  }

  return [];
}

function persistTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function exportTransactionsAsJSON(transactions) {
  const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `financas-backup-${todayStamp()}.json`);
}

function exportTransactionsAsCSV(transactions) {
  const header = ['Data', 'Tipo', 'Descrição', 'Valor', 'Vencimento', 'Status'];
  const rows = transactions.map(t => {
    const hasDueDate = t.type === 'divida' || t.type === 'assinatura';
    return [
      t.date,
      t.type,
      t.description,
      t.amount.toFixed(2),
      hasDueDate ? (t.dueDate || '') : '',
      hasDueDate ? (t.paid ? 'Paga' : 'Pendente') : ''
    ];
  });
  const csv = [header, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `financas-transacoes-${todayStamp()}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function parseImportedTransactions(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Formato inválido: esperado um array de transações.');

  return data.map(t => {
    if (!t.date || !t.type || !t.description || typeof t.amount !== 'number') {
      throw new Error('Formato inválido: cada transação precisa de date, type, description e amount.');
    }
    let type = ['receita', 'despesa', 'divida', 'assinatura'].includes(t.type) ? t.type : 'despesa';
    if (type === 'divida' && t.recurring) type = 'assinatura';
    const transaction = {
      id: t.id || Date.now() + Math.random(),
      date: t.date,
      type,
      description: String(t.description),
      amount: Number(t.amount)
    };
    if (type === 'divida' || type === 'assinatura') {
      transaction.dueDate = t.dueDate || t.date;
      transaction.paid = !!t.paid;
    }
    return transaction;
  });
}
