// Utilitários de exportação/importação e preferências locais (tema).
// Os dados financeiros (transações, contas, metas) agora vivem no servidor — ver js/api.js.
const THEME_KEY = 'financas_pro_theme';

function exportBackupAsJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `financas-backup-${todayStamp()}.json`);
}

function exportTransactionsAsCSV(transactions, accounts) {
  const accountName = (id) => accounts.find(a => a.id === id)?.name || '';
  const header = ['Data', 'Tipo', 'Descrição', 'Valor', 'Conta', 'Vencimento', 'Status'];
  const rows = transactions.map(t => {
    const hasDueDate = t.type === 'divida' || t.type === 'assinatura';
    return [
      t.date,
      t.type,
      t.description,
      t.amount.toFixed(2),
      accountName(t.accountId),
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

// Normaliza um backup importado (formato antigo: array puro; novo: {transactions, accounts, goals})
function parseImportedBackup(text) {
  const data = JSON.parse(text);

  let rawTransactions;
  let rawAccounts;
  let rawGoals;
  if (Array.isArray(data)) {
    rawTransactions = data;
    rawAccounts = [];
    rawGoals = [];
  } else if (data && typeof data === 'object') {
    rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];
    rawAccounts = Array.isArray(data.accounts) ? data.accounts : [];
    rawGoals = Array.isArray(data.goals) ? data.goals : [];
  } else {
    throw new Error('Formato inválido: esperado um backup de transações.');
  }

  const transactions = rawTransactions.map(t => {
    if (!t.date || !t.type || !t.description || typeof t.amount !== 'number') {
      throw new Error('Formato inválido: cada transação precisa de date, type, description e amount.');
    }
    let type = ['receita', 'despesa', 'divida', 'assinatura'].includes(t.type) ? t.type : 'despesa';
    if (type === 'divida' && t.recurring) type = 'assinatura';
    const transaction = {
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

  const accounts = rawAccounts
    .filter(a => a && a.name)
    .map(a => ({ name: String(a.name), type: a.type || 'banco' }));

  const goals = rawGoals
    .filter(g => g && g.name)
    .map(g => ({
      name: String(g.name),
      targetAmount: Number(g.targetAmount) || 0,
      currentAmount: Number(g.currentAmount) || 0,
      deadline: g.deadline || undefined
    }));

  return { transactions, accounts, goals };
}
