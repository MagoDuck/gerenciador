// Cliente da API do Finanças Pro (substitui o acesso direto ao localStorage)
const API_BASE_URL = window.FINANCAS_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'financas_pro_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Não foi possível conectar ao servidor da API.');
  }

  if (res.status === 401) {
    setToken(null);
    if (typeof onAuthExpired === 'function') onAuthExpired();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!res.ok) {
    let message = 'Erro na requisição.';
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // resposta sem corpo JSON
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

const api = {
  register: (email, password) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => apiRequest('/auth/me'),

  getAccounts: () => apiRequest('/accounts'),
  createAccount: (data) => apiRequest('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) => apiRequest(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => apiRequest(`/accounts/${id}`, { method: 'DELETE' }),

  getTransactions: () => apiRequest('/transactions'),
  createTransaction: (data) => apiRequest('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) => apiRequest(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id) => apiRequest(`/transactions/${id}`, { method: 'DELETE' }),
  togglePaid: (id) => apiRequest(`/transactions/${id}/toggle-paid`, { method: 'PATCH' }),

  getGoals: () => apiRequest('/goals'),
  createGoal: (data) => apiRequest('/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id, data) => apiRequest(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoal: (id) => apiRequest(`/goals/${id}`, { method: 'DELETE' }),
  contributeGoal: (id, amount) => apiRequest(`/goals/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) }),

  clearAllData: () => apiRequest('/data', { method: 'DELETE' })
};
