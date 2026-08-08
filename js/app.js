// Lógica principal da aplicação
let transactions = loadTransactions();
let editingId = null;
let sortState = { field: 'date', dir: 'desc' };
let currentSection = 'lancamento';

const form = document.getElementById('transactionForm');
const dateInput = document.getElementById('date');
const typeInput = document.getElementById('type');
const dividaFields = document.getElementById('dividaFields');
const dueDateInput = document.getElementById('dueDate');
const dueDateLabel = document.getElementById('dueDateLabel');
const descriptionLabel = document.getElementById('descriptionLabel');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const tableBody = document.getElementById('transactionTableBody');
const searchInput = document.getElementById('searchInput');
const searchDate = document.getElementById('searchDate');
const typeFilter = document.getElementById('typeFilter');
const importFileInput = document.getElementById('importFile');
const filteredSummary = document.getElementById('filteredSummary');
const dividasTableBody = document.getElementById('dividasTableBody');
const dividasSummary = document.getElementById('dividasSummary');
const assinaturasTableBody = document.getElementById('assinaturasTableBody');
const assinaturasSummary = document.getElementById('assinaturasSummary');
const menuToggle = document.getElementById('menuToggle');
const sidebarEl = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

const TYPE_LABELS = { receita: 'Receita', despesa: 'Despesa', divida: 'Dívida', assinatura: 'Assinatura' };
const isDividaOuAssinatura = t => t.type === 'divida' || t.type === 'assinatura';

function icon(name, className = 'icon') {
  return `<svg class="${className}"><use href="#icon-${name}"></use></svg>`;
}

function formatCurrency(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function updateFormForType() {
  const type = typeInput.value;
  const isDivida = type === 'divida';
  const isAssinatura = type === 'assinatura';
  const needsDueDate = isDivida || isAssinatura;

  dividaFields.hidden = !needsDueDate;
  dueDateInput.required = needsDueDate;
  dueDateLabel.textContent = isAssinatura ? 'Cobrança mensal em' : 'Vencimento';
  descriptionLabel.textContent = isAssinatura ? 'Serviço' : isDivida ? 'Para quem / O quê' : 'Descrição';
  descriptionInput.placeholder = isAssinatura
    ? 'Ex: Netflix, Spotify, Academia...'
    : isDivida
      ? 'Ex: Cartão Nubank, Empréstimo...'
      : 'Ex: Supermercado, Salário...';
}

function handleSubmit(e) {
  e.preventDefault();

  const type = typeInput.value;
  const description = descriptionInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!description) {
    showToast('Insira uma descrição.', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('Insira um valor válido maior que zero.', 'error');
    return;
  }
  const needsDueDate = isDividaOuAssinatura({ type });
  if (needsDueDate && !dueDateInput.value) {
    showToast('Informe a data de vencimento.', 'error');
    return;
  }

  const extra = needsDueDate
    ? { dueDate: dueDateInput.value }
    : { dueDate: undefined };

  if (editingId !== null) {
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      transactions[idx] = {
        ...transactions[idx],
        date: dateInput.value,
        type,
        description,
        amount,
        ...extra,
        paid: needsDueDate ? !!transactions[idx].paid : undefined
      };
    }
    showToast('Lançamento atualizado!', 'success');
    stopEditing();
  } else {
    transactions.push({
      id: Date.now() + Math.random(),
      date: dateInput.value,
      type,
      description,
      amount,
      ...extra,
      paid: needsDueDate ? false : undefined
    });
    showToast('Lançamento adicionado!', 'success');
  }

  saveAndRefresh();
  descriptionInput.value = '';
  amountInput.value = '';
  descriptionInput.focus();
}

function startEditing(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  editingId = id;
  dateInput.value = t.date;
  typeInput.value = t.type;
  updateFormForType();
  dueDateInput.value = t.dueDate || '';
  descriptionInput.value = t.description;
  amountInput.value = t.amount;

  submitBtn.innerHTML = `${icon('save')} Salvar Alterações`;
  cancelEditBtn.hidden = false;
  document.getElementById('formTitle').innerHTML = `${icon('edit')} Editar Lançamento`;
  switchSection('lancamento');
}

function stopEditing() {
  editingId = null;
  submitBtn.innerHTML = `${icon('plus')} Adicionar Registro`;
  cancelEditBtn.hidden = true;
  document.getElementById('formTitle').innerHTML = `${icon('plus')} Novo Lançamento`;
  form.reset();
  dateInput.valueAsDate = new Date();
  updateFormForType();
}

async function deleteTransaction(id) {
  const ok = await confirmDialog('Tem certeza que deseja excluir esta transação?', { title: 'Excluir lançamento', confirmLabel: 'Excluir' });
  if (!ok) return;
  transactions = transactions.filter(t => t.id !== id);
  if (editingId === id) stopEditing();
  saveAndRefresh();
  showToast('Lançamento excluído.', 'info');
}

function addOneMonth(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  let targetYear = year;
  let targetMonth = month + 1;
  if (targetMonth > 12) {
    targetMonth = 1;
    targetYear += 1;
  }
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

function togglePaid(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;
  t.paid = !t.paid;

  if (t.paid && t.type === 'assinatura') {
    const baseDate = t.dueDate || t.date;
    const nextDueDate = addOneMonth(baseDate);
    transactions.push({
      id: Date.now() + Math.random(),
      date: nextDueDate,
      type: 'assinatura',
      description: t.description,
      amount: t.amount,
      dueDate: nextDueDate,
      paid: false
    });
    saveAndRefresh();
    showToast(`Paga! Próxima cobrança de "${t.description}" agendada para ${formatDate(nextDueDate)}.`, 'success');
    return;
  }

  saveAndRefresh();
  showToast(t.paid ? 'Marcada como paga.' : 'Marcada como pendente.', 'info');
}

async function clearAllData() {
  const ok = await confirmDialog('Atenção: isso irá excluir TODOS os dados. Esta ação não pode ser desfeita.', { title: 'Limpar todos os dados', confirmLabel: 'Excluir tudo' });
  if (!ok) return;
  transactions = [];
  stopEditing();
  saveAndRefresh();
  showToast('Todos os dados foram apagados.', 'info');
}

function saveAndRefresh() {
  persistTransactions(transactions);
  render();
}

function getFilteredTransactions() {
  const textQuery = searchInput.value.toLowerCase().trim();
  const dateQuery = searchDate.value;
  const type = typeFilter.value;

  let filtered = transactions.filter(t => {
    const matchesText = t.description.toLowerCase().includes(textQuery) ||
      t.amount.toString().includes(textQuery);
    const matchesDate = !dateQuery || t.date === dateQuery;
    const matchesType = !type || t.type === type;
    return matchesText && matchesDate && matchesType;
  });

  filtered.sort((a, b) => {
    let av = a[sortState.field];
    let bv = b[sortState.field];
    if (sortState.field === 'date') {
      av = new Date(av);
      bv = new Date(bv);
    } else if (typeof av === 'string') {
      av = av.toLowerCase();
      bv = bv.toLowerCase();
    }
    if (av < bv) return sortState.dir === 'asc' ? -1 : 1;
    if (av > bv) return sortState.dir === 'asc' ? 1 : -1;
    return 0;
  });

  return filtered;
}

function updateTotals() {
  const income = transactions.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
  const dividaPendente = transactions.filter(t => isDividaOuAssinatura(t) && !t.paid).reduce((acc, t) => acc + t.amount, 0);
  const dividaPaga = transactions.filter(t => isDividaOuAssinatura(t) && t.paid).reduce((acc, t) => acc + t.amount, 0);
  const balance = income - expense - dividaPaga;

  document.getElementById('totalIncome').textContent = formatCurrency(income);
  document.getElementById('totalExpense').textContent = formatCurrency(expense);
  document.getElementById('totalBalance').textContent = formatCurrency(balance);
  document.getElementById('totalDivida').textContent = formatCurrency(dividaPendente);
}

function renderTable() {
  const filtered = getFilteredTransactions();

  const income = filtered.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
  filteredSummary.textContent = `${filtered.length} lançamento(s) · Receitas ${formatCurrency(income)} · Despesas ${formatCurrency(expense)}`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            ${icon('inbox', 'icon-lg')}
            <p>Nenhuma transação encontrada.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(t => {
    const color = t.type === 'receita' ? 'var(--income)' : t.type === 'despesa' ? 'var(--expense)' : 'var(--divida)';
    const sign = t.type === 'receita' ? '+' : '−';
    const label = TYPE_LABELS[t.type];
    return `
      <tr data-id="${t.id}">
        <td>${formatDate(t.date)}</td>
        <td><strong>${escapeHTML(t.description)}</strong></td>
        <td>
          <span class="badge badge-${t.type}">${label}</span>
        </td>
        <td style="font-weight:600; color: ${color}">
          ${sign} ${formatCurrency(t.amount)}
        </td>
        <td class="actions-cell">
          <span class="row-actions">
            <button class="btn-icon" data-edit="${t.id}" title="Editar">${icon('edit')}</button>
            <button class="btn-del" data-delete="${t.id}" title="Excluir">${icon('x')}</button>
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function getDividaStatus(t) {
  if (t.paid) return { label: 'Paga', className: 'badge-paga' };
  const today = new Date().toISOString().slice(0, 10);
  if (t.dueDate && t.dueDate < today) return { label: 'Vencida', className: 'badge-vencida' };
  return { label: 'A vencer', className: 'badge-pendente' };
}

function renderDividaLikeTable(type, tableBodyEl, summaryEl, emptyMessage) {
  const items = transactions
    .filter(t => t.type === type)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  const pendentes = items.filter(t => !t.paid).reduce((acc, t) => acc + t.amount, 0);
  summaryEl.textContent = `${items.length} registro(s) · Pendente ${formatCurrency(pendentes)}`;

  if (items.length === 0) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            ${icon('inbox', 'icon-lg')}
            <p>${emptyMessage}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBodyEl.innerHTML = items.map(t => {
    const status = getDividaStatus(t);
    return `
      <tr data-id="${t.id}">
        <td>${formatDate(t.dueDate)}</td>
        <td><strong>${escapeHTML(t.description)}</strong></td>
        <td style="font-weight:600; color: var(--divida)">${formatCurrency(t.amount)}</td>
        <td><span class="badge ${status.className}">${status.label}</span></td>
        <td class="actions-cell">
          <span class="row-actions">
            <button class="btn-pay" data-toggle-paid="${t.id}" title="${t.paid ? 'Marcar como pendente' : 'Marcar como paga'}">${t.paid ? icon('rotate-ccw') : icon('check-circle')}</button>
            <button class="btn-icon" data-edit="${t.id}" title="Editar">${icon('edit')}</button>
            <button class="btn-del" data-delete="${t.id}" title="Excluir">${icon('x')}</button>
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderDividasTable() {
  renderDividaLikeTable('divida', dividasTableBody, dividasSummary, 'Nenhuma dívida cadastrada.');
}

function renderAssinaturasTable() {
  renderDividaLikeTable('assinatura', assinaturasTableBody, assinaturasSummary, 'Nenhuma assinatura cadastrada.');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openTransactionDetail(id) {
  const t = transactions.find(tr => tr.id === id);
  if (!t) return;

  const color = t.type === 'receita' ? 'var(--income)' : t.type === 'despesa' ? 'var(--expense)' : 'var(--divida)';
  const sign = t.type === 'receita' ? '+' : '−';
  const label = TYPE_LABELS[t.type];

  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `
    <div class="detail-box" role="dialog" aria-modal="true" aria-label="Detalhes do lançamento">
      <button type="button" class="detail-close" aria-label="Fechar">${icon('x')}</button>
      <span class="badge badge-${t.type}">${label}</span>
      <p class="detail-amount" style="color:${color}">${sign} ${formatCurrency(t.amount)}</p>
      <h3 class="detail-description">${escapeHTML(t.description)}</h3>
      <p class="detail-date">${formatDate(t.date)}</p>
      <div class="detail-actions">
        <button type="button" class="btn-secondary" data-detail-edit>${icon('edit')} Editar</button>
        <button type="button" class="btn-danger" data-detail-delete>${icon('trash')} Excluir</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('detail-visible'));

  function close() {
    overlay.classList.remove('detail-visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  overlay.querySelector('.detail-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-detail-edit]').addEventListener('click', () => {
    close();
    startEditing(id);
  });
  overlay.querySelector('[data-detail-delete]').addEventListener('click', async () => {
    close();
    await deleteTransaction(id);
  });
  document.addEventListener('keydown', onKeydown);
}

function openDividaDetail(id) {
  const t = transactions.find(tr => tr.id === id);
  if (!t) return;

  const label = TYPE_LABELS[t.type];
  const status = getDividaStatus(t);
  const dueDateLabelText = t.type === 'assinatura' ? 'Próxima cobrança' : 'Vencimento';

  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `
    <div class="detail-box" role="dialog" aria-modal="true" aria-label="Detalhes do lançamento">
      <button type="button" class="detail-close" aria-label="Fechar">${icon('x')}</button>
      <span class="badge badge-${t.type}">${label}</span>
      <p class="detail-amount" style="color:var(--divida)">${formatCurrency(t.amount)}</p>
      <h3 class="detail-description">${escapeHTML(t.description)}</h3>
      <p class="detail-date">${dueDateLabelText}: ${formatDate(t.dueDate)}</p>
      <p class="detail-status"><span class="badge ${status.className}">${status.label}</span></p>
      <div class="detail-actions">
        <button type="button" class="btn-pay detail-pay-btn" data-detail-toggle-paid title="${t.paid ? 'Marcar como pendente' : 'Marcar como paga'}">${t.paid ? icon('rotate-ccw') : icon('check-circle')} ${t.paid ? 'Pendente' : 'Paga'}</button>
        <button type="button" class="btn-secondary" data-detail-edit>${icon('edit')} Editar</button>
        <button type="button" class="btn-danger" data-detail-delete>${icon('trash')} Excluir</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('detail-visible'));

  function close() {
    overlay.classList.remove('detail-visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  overlay.querySelector('.detail-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-detail-toggle-paid]').addEventListener('click', () => {
    close();
    togglePaid(id);
  });
  overlay.querySelector('[data-detail-edit]').addEventListener('click', () => {
    close();
    startEditing(id);
  });
  overlay.querySelector('[data-detail-delete]').addEventListener('click', async () => {
    close();
    await deleteTransaction(id);
  });
  document.addEventListener('keydown', onKeydown);
}

function clearFilters() {
  searchInput.value = '';
  searchDate.value = '';
  typeFilter.value = '';
  renderTable();
}

function handleSort(field) {
  if (sortState.field === field) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.field = field;
    sortState.dir = 'asc';
  }
  updateSortIndicators();
  renderTable();
}

function updateSortIndicators() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortState.field) {
      th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function handleExportJSON() {
  if (transactions.length === 0) {
    showToast('Não há dados para exportar.', 'error');
    return;
  }
  exportTransactionsAsJSON(transactions);
  showToast('Backup JSON exportado.', 'success');
}

function handleExportCSV() {
  if (transactions.length === 0) {
    showToast('Não há dados para exportar.', 'error');
    return;
  }
  exportTransactionsAsCSV(transactions);
  showToast('CSV exportado.', 'success');
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = parseImportedTransactions(reader.result);
      transactions = transactions.concat(imported);
      saveAndRefresh();
      showToast(`${imported.length} lançamento(s) importado(s).`, 'success');
    } catch (err) {
      showToast('Erro ao importar: ' + err.message, 'error');
    }
    importFileInput.value = '';
  };
  reader.readAsText(file);
}

function render() {
  updateTotals();
  renderTable();
  renderDividasTable();
  renderAssinaturasTable();
  if (currentSection === 'distribuicao') {
    renderDistributionCharts(transactions);
  }
}

function switchSection(name) {
  currentSection = name;

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.toggle('active', section.id === `section-${name}`);
  });

  if (name === 'distribuicao') {
    renderDistributionCharts(transactions);
  }

  closeMobileMenu();
}

function openMobileMenu() {
  sidebarEl.classList.add('sidebar-open');
  sidebarOverlay.classList.add('visible');
  menuToggle.setAttribute('aria-expanded', 'true');
}

function closeMobileMenu() {
  sidebarEl.classList.remove('sidebar-open');
  sidebarOverlay.classList.remove('visible');
  menuToggle.setAttribute('aria-expanded', 'false');
}

function toggleMobileMenu() {
  if (sidebarEl.classList.contains('sidebar-open')) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function bindEvents() {
  form.addEventListener('submit', handleSubmit);
  cancelEditBtn.addEventListener('click', stopEditing);
  typeInput.addEventListener('change', updateFormForType);

  searchInput.addEventListener('input', renderTable);
  searchDate.addEventListener('change', renderTable);
  typeFilter.addEventListener('change', renderTable);
  document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
  document.getElementById('exportJSONBtn').addEventListener('click', handleExportJSON);
  document.getElementById('exportCSVBtn').addEventListener('click', handleExportCSV);
  document.getElementById('importBtn').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', handleImportFile);
  document.getElementById('themeToggle').addEventListener('click', () => {
    toggleTheme();
    if (currentSection === 'distribuicao') renderDistributionCharts(transactions);
  });

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
  });

  menuToggle.addEventListener('click', toggleMobileMenu);
  sidebarOverlay.addEventListener('click', closeMobileMenu);

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.sort));
  });

  tableBody.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-delete]')?.dataset.delete;
    if (editId) startEditing(Number(editId) || editId);
    if (delId) deleteTransaction(Number(delId) || delId);
  });

  function bindDividaLikeTable(el) {
    el.addEventListener('click', (e) => {
      const editId = e.target.closest('[data-edit]')?.dataset.edit;
      const delId = e.target.closest('[data-delete]')?.dataset.delete;
      const toggleId = e.target.closest('[data-toggle-paid]')?.dataset.togglePaid;
      if (editId) startEditing(Number(editId) || editId);
      if (delId) deleteTransaction(Number(delId) || delId);
      if (toggleId) togglePaid(Number(toggleId) || toggleId);
    });
  }
  bindDividaLikeTable(dividasTableBody);
  bindDividaLikeTable(assinaturasTableBody);

  function bindRowDetailOnMobile(tbody, openFn) {
    tbody.addEventListener('dblclick', (e) => {
      if (!window.matchMedia('(max-width: 600px)').matches) return;
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      openFn(Number(row.dataset.id) || row.dataset.id);
    });
  }
  bindRowDetailOnMobile(tableBody, openTransactionDetail);
  bindRowDetailOnMobile(dividasTableBody, openDividaDetail);
  bindRowDetailOnMobile(assinaturasTableBody, openDividaDetail);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest('form')) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
    if (e.key === 'Escape' && editingId !== null) {
      stopEditing();
    }
    if (e.key === 'Escape' && sidebarEl.classList.contains('sidebar-open')) {
      closeMobileMenu();
    }
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function setupInstallPrompt() {
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    showToast('Aplicativo instalado!', 'success');
  });
}

function init() {
  initTheme();
  dateInput.valueAsDate = new Date();
  updateFormForType();
  updateSortIndicators();
  bindEvents();
  render();
  registerServiceWorker();
  setupInstallPrompt();
}

init();
