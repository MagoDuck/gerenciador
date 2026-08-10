// Lógica principal da aplicação
let accounts = [];
let transactions = [];
let goals = [];
let currentUser = null;
let authMode = 'login';
let editingId = null;
let editingAccountId = null;
let editingGoalId = null;
let sortState = { field: 'date', dir: 'desc' };
let currentSection = 'lancamento';

const appRoot = document.getElementById('appRoot');
const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const authError = document.getElementById('authError');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggleBtn = document.getElementById('authToggleBtn');
const authToggleText = document.getElementById('authToggleText');
const userEmailLabel = document.getElementById('userEmailLabel');
const logoutBtn = document.getElementById('logoutBtn');

const form = document.getElementById('transactionForm');
const dateInput = document.getElementById('date');
const typeInput = document.getElementById('type');
const accountSelect = document.getElementById('accountSelect');
const dividaFields = document.getElementById('dividaFields');
const dueDateInput = document.getElementById('dueDate');
const dueDateLabel = document.getElementById('dueDateLabel');
const installmentsField = document.getElementById('installmentsField');
const installmentsInput = document.getElementById('installments');
const descriptionLabel = document.getElementById('descriptionLabel');
const descriptionInput = document.getElementById('description');
const amountLabel = document.getElementById('amountLabel');
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

const accountForm = document.getElementById('accountForm');
const accountNameInput = document.getElementById('accountName');
const accountTypeInput = document.getElementById('accountType');
const accountSubmitBtn = document.getElementById('accountSubmitBtn');
const cancelAccountEditBtn = document.getElementById('cancelAccountEditBtn');
const accountFormTitle = document.getElementById('accountFormTitle');
const accountsGrid = document.getElementById('accountsGrid');

const goalForm = document.getElementById('goalForm');
const goalNameInput = document.getElementById('goalName');
const goalTargetInput = document.getElementById('goalTarget');
const goalDeadlineInput = document.getElementById('goalDeadline');
const goalSubmitBtn = document.getElementById('goalSubmitBtn');
const cancelGoalEditBtn = document.getElementById('cancelGoalEditBtn');
const goalFormTitle = document.getElementById('goalFormTitle');
const goalsGrid = document.getElementById('goalsGrid');

const TYPE_LABELS = { receita: 'Receita', despesa: 'Despesa', divida: 'Dívida', assinatura: 'Assinatura' };
const ACCOUNT_TYPE_LABELS = { banco: 'Banco', carteira: 'Carteira física', vale: 'Vale', investimento: 'Investimento' };
const isDividaOuAssinatura = t => t.type === 'divida' || t.type === 'assinatura';

function icon(name, className = 'icon') {
  return `<svg class="${className}"><use href="#icon-${name}"></use></svg>`;
}

function formatCurrency(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getAccountName(accountId) {
  return accounts.find(a => a.id === accountId)?.name || '';
}

function accountSubtitle(t) {
  if (accounts.length <= 1) return '';
  return `<br><span class="cell-subtitle">${escapeHTML(getAccountName(t.accountId))}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Autenticação ---------- */

function updateAuthUI() {
  const isLogin = authMode === 'login';
  authTitle.textContent = isLogin ? 'Entrar' : 'Criar conta';
  authSubmitBtn.textContent = isLogin ? 'Entrar' : 'Criar conta';
  authToggleText.textContent = isLogin ? 'Não tem conta?' : 'Já tem conta?';
  authToggleBtn.textContent = isLogin ? 'Criar conta' : 'Entrar';
  authError.hidden = true;
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  updateAuthUI();
}

function showAuthScreen() {
  authOverlay.hidden = false;
  appRoot.hidden = true;
}

function showApp() {
  authOverlay.hidden = true;
  appRoot.hidden = false;
  userEmailLabel.textContent = currentUser ? currentUser.email : '—';
}

function onAuthExpired() {
  currentUser = null;
  showAuthScreen();
  showToast('Sessão expirada. Faça login novamente.', 'error');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  authError.hidden = true;
  authSubmitBtn.disabled = true;
  try {
    const result = authMode === 'login'
      ? await api.login(email, password)
      : await api.register(email, password);
    setToken(result.token);
    currentUser = result.user;
    await loadAllData();
    authForm.reset();
    showApp();
  } catch (err) {
    authError.textContent = err.message;
    authError.hidden = false;
  } finally {
    authSubmitBtn.disabled = false;
  }
}

function handleLogout() {
  setToken(null);
  currentUser = null;
  transactions = [];
  accounts = [];
  goals = [];
  stopEditing();
  showAuthScreen();
}

async function checkAuthAndLoad() {
  const token = getToken();
  if (!token) {
    showAuthScreen();
    return;
  }
  try {
    const { user } = await api.me();
    currentUser = user;
    await loadAllData();
    showApp();
  } catch {
    showAuthScreen();
  }
}

async function loadAllData() {
  const [accountsRes, transactionsRes, goalsRes] = await Promise.all([
    api.getAccounts(),
    api.getTransactions(),
    api.getGoals()
  ]);
  accounts = accountsRes;
  transactions = transactionsRes;
  goals = goalsRes;
  populateAccountSelect();
  render();
  renderGoalsSection();
}

/* ---------- Formulário de lançamento ---------- */

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

  installmentsField.hidden = !isDivida || editingId !== null;
  if (installmentsField.hidden) installmentsInput.value = '1';
  updateAmountLabel();
}

function updateAmountLabel() {
  const installments = Math.max(1, parseInt(installmentsInput.value, 10) || 1);
  amountLabel.textContent = !installmentsField.hidden && installments > 1
    ? 'Valor de cada parcela (R$)'
    : 'Valor (R$)';
}

function populateAccountSelect() {
  const previous = Number(accountSelect.value) || accountSelect.value;
  accountSelect.innerHTML = accounts.map(a => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('');
  accountSelect.value = accounts.some(a => a.id === previous) ? previous : accounts[0].id;
}

async function handleSubmit(e) {
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

  const accountId = Number(accountSelect.value);
  const installments = type === 'divida' && editingId === null
    ? Math.max(1, parseInt(installmentsInput.value, 10) || 1)
    : 1;

  const payload = {
    date: dateInput.value,
    type,
    description,
    amount,
    accountId,
    dueDate: needsDueDate ? dueDateInput.value : undefined,
    installments
  };

  submitBtn.disabled = true;
  try {
    if (editingId !== null) {
      await api.updateTransaction(editingId, payload);
      showToast('Lançamento atualizado!', 'success');
      stopEditing();
    } else {
      await api.createTransaction(payload);
      showToast(
        installments > 1 ? `${installments} parcelas de ${formatCurrency(amount)} adicionadas!` : 'Lançamento adicionado!',
        'success'
      );
    }

    transactions = await api.getTransactions();
    render();
    descriptionInput.value = '';
    amountInput.value = '';
    installmentsInput.value = '1';
    updateAmountLabel();
    descriptionInput.focus();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function startEditing(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  editingId = id;
  dateInput.value = t.date;
  typeInput.value = t.type;
  accountSelect.value = t.accountId || accounts[0].id;
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
  try {
    await api.deleteTransaction(id);
    if (editingId === id) stopEditing();
    transactions = await api.getTransactions();
    render();
    showToast('Lançamento excluído.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function togglePaid(id) {
  try {
    const result = await api.togglePaid(id);
    transactions = await api.getTransactions();
    render();
    if (result.created) {
      showToast(`Paga! Próxima cobrança de "${result.created.description}" agendada para ${formatDate(result.created.dueDate)}.`, 'success');
    } else {
      showToast(result.updated.paid ? 'Marcada como paga.' : 'Marcada como pendente.', 'info');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function clearAllData() {
  const ok = await confirmDialog('Atenção: isso irá excluir TODOS os dados. Esta ação não pode ser desfeita.', { title: 'Limpar todos os dados', confirmLabel: 'Excluir tudo' });
  if (!ok) return;
  try {
    await api.clearAllData();
    stopEditing();
    await loadAllData();
    showToast('Todos os dados foram apagados.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
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
        <td><strong>${escapeHTML(t.description)}</strong>${accountSubtitle(t)}</td>
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
        <td><strong>${escapeHTML(t.description)}</strong>${accountSubtitle(t)}</td>
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

/* ---------- Contas ---------- */

function getAccountBalance(accountId) {
  const accTx = transactions.filter(t => t.accountId === accountId);
  const income = accTx.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
  const expense = accTx.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
  const dividaPaga = accTx.filter(t => isDividaOuAssinatura(t) && t.paid).reduce((acc, t) => acc + t.amount, 0);
  return income - expense - dividaPaga;
}

function renderAccountsSection() {
  accountsGrid.innerHTML = accounts.map(a => {
    const balance = getAccountBalance(a.id);
    const color = balance < 0 ? 'var(--expense)' : 'var(--income)';
    return `
      <div class="info-card" data-account-id="${a.id}" title="Dê 2 cliques para ver os lançamentos desta conta">
        <div class="info-card-header">
          <span class="info-card-icon">${icon('wallet')}</span>
          <div>
            <p class="info-card-title">${escapeHTML(a.name)}</p>
            <p class="info-card-subtitle">${ACCOUNT_TYPE_LABELS[a.type] || a.type}</p>
          </div>
        </div>
        <p class="info-card-value" style="color:${color}">${formatCurrency(balance)}</p>
        <div class="info-card-actions">
          <button class="btn-icon" data-edit-account="${a.id}" title="Editar">${icon('edit')}</button>
          <button class="btn-del" data-delete-account="${a.id}" title="Excluir">${icon('x')}</button>
        </div>
      </div>
    `;
  }).join('');
}

function openAccountDetail(accountId) {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return;

  const accTx = transactions
    .filter(t => t.accountId === accountId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const income = accTx.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
  const expense = accTx.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);
  const dividaPendente = accTx.filter(t => isDividaOuAssinatura(t) && !t.paid).reduce((s, t) => s + t.amount, 0);
  const balance = getAccountBalance(accountId);

  const rowsHTML = accTx.length === 0
    ? `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            ${icon('inbox', 'icon-lg')}
            <p>Nenhum lançamento nessa conta.</p>
          </div>
        </td>
      </tr>
    `
    : accTx.map(t => {
        const color = t.type === 'receita' ? 'var(--income)' : t.type === 'despesa' ? 'var(--expense)' : 'var(--divida)';
        const sign = t.type === 'receita' ? '+' : '−';
        return `
          <tr>
            <td>${formatDate(t.date)}</td>
            <td><strong>${escapeHTML(t.description)}</strong></td>
            <td><span class="badge badge-${t.type}">${TYPE_LABELS[t.type]}</span></td>
            <td style="font-weight:600; color:${color}">${sign} ${formatCurrency(t.amount)}</td>
          </tr>
        `;
      }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay center-overlay';
  overlay.innerHTML = `
    <div class="detail-box detail-box-wide" role="dialog" aria-modal="true" aria-label="Lançamentos da conta">
      <button type="button" class="detail-close" aria-label="Fechar">${icon('x')}</button>
      <div class="account-detail-header">
        <span class="info-card-icon">${icon('wallet')}</span>
        <h3 class="detail-description">${escapeHTML(acc.name)}</h3>
        <p class="detail-date" style="margin-bottom:0;">${ACCOUNT_TYPE_LABELS[acc.type] || acc.type}</p>
        <p class="detail-amount" style="color:${balance < 0 ? 'var(--expense)' : 'var(--income)'}">${formatCurrency(balance)}</p>
      </div>

      <div class="account-detail-summary">
        <div>
          <span class="label">Receitas</span>
          <span class="value" style="color:var(--income)">${formatCurrency(income)}</span>
        </div>
        <div>
          <span class="label">Despesas</span>
          <span class="value" style="color:var(--expense)">${formatCurrency(expense)}</span>
        </div>
        <div>
          <span class="label">Dívidas/Assinaturas</span>
          <span class="value" style="color:var(--divida)">${formatCurrency(dividaPendente)}</span>
        </div>
      </div>

      <div class="table-container account-detail-table-container">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
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
  document.addEventListener('keydown', onKeydown);
}

async function handleAccountSubmit(e) {
  e.preventDefault();
  const name = accountNameInput.value.trim();
  const type = accountTypeInput.value;

  if (!name) {
    showToast('Insira um nome para a conta.', 'error');
    return;
  }

  try {
    if (editingAccountId !== null) {
      await api.updateAccount(editingAccountId, { name, type });
      showToast('Conta atualizada!', 'success');
      stopEditingAccount();
    } else {
      await api.createAccount({ name, type });
      showToast('Conta adicionada!', 'success');
      accountForm.reset();
    }
    accounts = await api.getAccounts();
    populateAccountSelect();
    renderAccountsSection();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function startEditingAccount(id) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  editingAccountId = id;
  accountNameInput.value = acc.name;
  accountTypeInput.value = acc.type;
  accountSubmitBtn.innerHTML = `${icon('save')} Salvar Alterações`;
  cancelAccountEditBtn.hidden = false;
  accountFormTitle.innerHTML = `${icon('edit')} Editar Conta`;
}

function stopEditingAccount() {
  editingAccountId = null;
  accountForm.reset();
  accountSubmitBtn.innerHTML = `${icon('plus')} Adicionar Conta`;
  cancelAccountEditBtn.hidden = true;
  accountFormTitle.innerHTML = `${icon('plus')} Nova Conta`;
}

async function deleteAccount(id) {
  if (accounts.length <= 1) {
    showToast('Você precisa manter ao menos uma conta.', 'error');
    return;
  }
  const ok = await confirmDialog('Tem certeza que deseja excluir esta conta? Os lançamentos dela serão movidos para outra conta.', { title: 'Excluir conta', confirmLabel: 'Excluir' });
  if (!ok) return;

  try {
    await api.deleteAccount(id);
    if (editingAccountId === id) stopEditingAccount();
    accounts = await api.getAccounts();
    transactions = await api.getTransactions();
    populateAccountSelect();
    render();
    showToast('Conta excluída.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- Metas ---------- */

function renderGoalsSection() {
  if (goals.length === 0) {
    goalsGrid.innerHTML = `
      <div class="empty-state">
        ${icon('inbox', 'icon-lg')}
        <p>Nenhuma meta cadastrada.</p>
      </div>
    `;
    return;
  }

  goalsGrid.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
    const done = g.currentAmount >= g.targetAmount;
    return `
      <div class="info-card goal-card">
        <div class="info-card-header">
          <span class="info-card-icon">${icon('target')}</span>
          <div>
            <p class="info-card-title">${escapeHTML(g.name)}</p>
            <p class="info-card-subtitle">${formatCurrency(g.currentAmount)} de ${formatCurrency(g.targetAmount)}</p>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill${done ? ' progress-fill-done' : ''}" style="width:${pct}%"></div>
        </div>
        <p class="goal-meta">${pct}% concluído${g.deadline ? ' · até ' + formatDate(g.deadline) : ''}${done ? ' · Meta concluída!' : ''}</p>
        <div class="goal-contribute">
          <input type="number" step="0.01" min="0.01" placeholder="Valor do aporte" class="goal-contribute-input" data-goal-input="${g.id}">
          <button type="button" data-add-contribution="${g.id}">${icon('plus')} Aporte</button>
        </div>
        <div class="info-card-actions">
          <button class="btn-icon" data-edit-goal="${g.id}" title="Editar">${icon('edit')}</button>
          <button class="btn-del" data-delete-goal="${g.id}" title="Excluir">${icon('x')}</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleGoalSubmit(e) {
  e.preventDefault();
  const name = goalNameInput.value.trim();
  const target = parseFloat(goalTargetInput.value);
  const deadline = goalDeadlineInput.value || undefined;

  if (!name) {
    showToast('Insira um nome para a meta.', 'error');
    return;
  }
  if (!target || target <= 0) {
    showToast('Insira um valor alvo válido maior que zero.', 'error');
    return;
  }

  try {
    if (editingGoalId !== null) {
      await api.updateGoal(editingGoalId, { name, targetAmount: target, deadline });
      showToast('Meta atualizada!', 'success');
      stopEditingGoal();
    } else {
      await api.createGoal({ name, targetAmount: target, deadline });
      showToast('Meta criada!', 'success');
      goalForm.reset();
    }
    goals = await api.getGoals();
    renderGoalsSection();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function startEditingGoal(id) {
  const g = goals.find(g => g.id === id);
  if (!g) return;
  editingGoalId = id;
  goalNameInput.value = g.name;
  goalTargetInput.value = g.targetAmount;
  goalDeadlineInput.value = g.deadline || '';
  goalSubmitBtn.innerHTML = `${icon('save')} Salvar Alterações`;
  cancelGoalEditBtn.hidden = false;
  goalFormTitle.innerHTML = `${icon('edit')} Editar Meta`;
}

function stopEditingGoal() {
  editingGoalId = null;
  goalForm.reset();
  goalSubmitBtn.innerHTML = `${icon('plus')} Criar Meta`;
  cancelGoalEditBtn.hidden = true;
  goalFormTitle.innerHTML = `${icon('plus')} Nova Meta`;
}

async function deleteGoal(id) {
  const ok = await confirmDialog('Tem certeza que deseja excluir esta meta?', { title: 'Excluir meta', confirmLabel: 'Excluir' });
  if (!ok) return;
  try {
    await api.deleteGoal(id);
    if (editingGoalId === id) stopEditingGoal();
    goals = await api.getGoals();
    renderGoalsSection();
    showToast('Meta excluída.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addGoalContribution(id, rawValue) {
  const value = parseFloat(rawValue);
  if (!value || value <= 0) {
    showToast('Insira um valor de aporte válido.', 'error');
    return;
  }
  try {
    await api.contributeGoal(id, value);
    goals = await api.getGoals();
    renderGoalsSection();
    showToast('Aporte adicionado!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- Detalhes (modais) ---------- */

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

/* ---------- Histórico: filtros e ordenação ---------- */

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

/* ---------- Backup / importação ---------- */

function handleExportJSON() {
  if (transactions.length === 0 && goals.length === 0) {
    showToast('Não há dados para exportar.', 'error');
    return;
  }
  exportBackupAsJSON({ transactions, accounts, goals });
  showToast('Backup JSON exportado.', 'success');
}

function handleExportCSV() {
  if (transactions.length === 0) {
    showToast('Não há dados para exportar.', 'error');
    return;
  }
  exportTransactionsAsCSV(transactions, accounts);
  showToast('CSV exportado.', 'success');
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = parseImportedBackup(reader.result);

      const accountIdMap = new Map();
      for (const a of imported.accounts) {
        const created = await api.createAccount({ name: a.name, type: a.type });
        accountIdMap.set(a.id, created.id);
      }
      if (imported.accounts.length > 0) {
        accounts = await api.getAccounts();
        populateAccountSelect();
      }

      for (const g of imported.goals) {
        const created = await api.createGoal({ name: g.name, targetAmount: g.targetAmount, deadline: g.deadline });
        if (g.currentAmount > 0) await api.contributeGoal(created.id, g.currentAmount);
      }

      const fallbackAccountId = accounts[0].id;
      for (const t of imported.transactions) {
        const accountId = accountIdMap.get(t.accountId) || fallbackAccountId;
        await api.createTransaction({ ...t, accountId, installments: 1 });
      }

      transactions = await api.getTransactions();
      goals = await api.getGoals();
      render();
      renderGoalsSection();
      showToast(`${imported.transactions.length} lançamento(s) importado(s).`, 'success');
    } catch (err) {
      showToast('Erro ao importar: ' + err.message, 'error');
    }
    importFileInput.value = '';
  };
  reader.readAsText(file);
}

/* ---------- Renderização geral / navegação ---------- */

function render() {
  updateTotals();
  renderTable();
  renderDividasTable();
  renderAssinaturasTable();
  renderAccountsSection();
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
  authForm.addEventListener('submit', handleAuthSubmit);
  authToggleBtn.addEventListener('click', toggleAuthMode);
  logoutBtn.addEventListener('click', handleLogout);

  form.addEventListener('submit', handleSubmit);
  cancelEditBtn.addEventListener('click', stopEditing);
  typeInput.addEventListener('change', updateFormForType);
  installmentsInput.addEventListener('input', updateAmountLabel);

  accountForm.addEventListener('submit', handleAccountSubmit);
  cancelAccountEditBtn.addEventListener('click', stopEditingAccount);
  accountsGrid.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit-account]')?.dataset.editAccount;
    const delId = e.target.closest('[data-delete-account]')?.dataset.deleteAccount;
    if (editId) startEditingAccount(Number(editId));
    if (delId) deleteAccount(Number(delId));
  });

  accountsGrid.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    const card = e.target.closest('[data-account-id]');
    if (!card) return;
    openAccountDetail(Number(card.dataset.accountId));
  });

  goalForm.addEventListener('submit', handleGoalSubmit);
  cancelGoalEditBtn.addEventListener('click', stopEditingGoal);
  goalsGrid.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit-goal]')?.dataset.editGoal;
    const delId = e.target.closest('[data-delete-goal]')?.dataset.deleteGoal;
    const contribId = e.target.closest('[data-add-contribution]')?.dataset.addContribution;
    if (editId) startEditingGoal(Number(editId));
    if (delId) deleteGoal(Number(delId));
    if (contribId) {
      const input = goalsGrid.querySelector(`[data-goal-input="${contribId}"]`);
      addGoalContribution(Number(contribId), input?.value);
      if (input) input.value = '';
    }
  });

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
    if (editId) startEditing(Number(editId));
    if (delId) deleteTransaction(Number(delId));
  });

  function bindDividaLikeTable(el) {
    el.addEventListener('click', (e) => {
      const editId = e.target.closest('[data-edit]')?.dataset.edit;
      const delId = e.target.closest('[data-delete]')?.dataset.delete;
      const toggleId = e.target.closest('[data-toggle-paid]')?.dataset.togglePaid;
      if (editId) startEditing(Number(editId));
      if (delId) deleteTransaction(Number(delId));
      if (toggleId) togglePaid(Number(toggleId));
    });
  }
  bindDividaLikeTable(dividasTableBody);
  bindDividaLikeTable(assinaturasTableBody);

  function bindRowDetailOnMobile(tbody, openFn) {
    tbody.addEventListener('dblclick', (e) => {
      if (!window.matchMedia('(max-width: 600px)').matches) return;
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      openFn(Number(row.dataset.id));
    });
  }
  bindRowDetailOnMobile(tableBody, openTransactionDetail);
  bindRowDetailOnMobile(dividasTableBody, openDividaDetail);
  bindRowDetailOnMobile(assinaturasTableBody, openDividaDetail);

  document.addEventListener('keydown', (e) => {
    const closestForm = e.target.closest('form');
    if (e.key === 'Enter' && closestForm && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      closestForm.dispatchEvent(new Event('submit', { cancelable: true }));
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
  updateAuthUI();
  bindEvents();
  registerServiceWorker();
  setupInstallPrompt();
  checkAuthAndLoad();
}

init();
