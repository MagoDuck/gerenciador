// Gráficos da aba de Distribuição: pizza, barras mensais e linha de evolução do saldo
let financeChartInstance = null;
let monthlyChartInstance = null;
let balanceChartInstance = null;

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function renderDistributionCharts(transactions) {
  const income = transactions.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
  const divida = transactions.filter(t => t.type === 'divida' || t.type === 'assinatura').reduce((acc, t) => acc + t.amount, 0);

  renderFinanceChart(income, expense, divida);
  renderMonthlyChart(transactions);
  renderBalanceChart(transactions);
}

function renderFinanceChart(income, expense, divida) {
  const canvas = document.getElementById('financeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (financeChartInstance) financeChartInstance.destroy();

  const isDark = isDarkTheme();
  const legendColor = isDark ? '#cbd5e1' : '#334155';

  if (income === 0 && expense === 0 && divida === 0) {
    financeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sem dados'],
        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
        cutout: '70%'
      }
    });
    return;
  }

  financeChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Receitas', 'Despesas', 'Dívidas/Assinaturas'],
      datasets: [{
        data: [income, expense, divida],
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
        borderWidth: 3,
        borderColor: isDark ? '#1e293b' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, font: { weight: '500' }, color: legendColor }
        }
      },
      cutout: '65%',
      animation: { animateRotate: true, duration: 800 }
    }
  });
}

function renderMonthlyChart(transactions) {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (monthlyChartInstance) monthlyChartInstance.destroy();

  const isDark = isDarkTheme();
  const gridColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.12)';
  const tickColor = isDark ? '#cbd5e1' : '#334155';

  const byMonth = {};
  transactions.forEach(t => {
    const key = t.date.slice(0, 7); // YYYY-MM
    if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0, divida: 0 };
    if (t.type === 'receita') byMonth[key].income += t.amount;
    else if (t.type === 'despesa') byMonth[key].expense += t.amount;
    else byMonth[key].divida += t.amount;
  });

  const keys = Object.keys(byMonth).sort().slice(-6);
  const labels = keys.map(key => {
    const [year, month] = key.split('-');
    return `${MONTH_LABELS[Number(month) - 1]}/${year.slice(2)}`;
  });

  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receitas', data: keys.map(k => byMonth[k].income), backgroundColor: '#10b981', borderRadius: 6, maxBarThickness: 24 },
        { label: 'Despesas', data: keys.map(k => byMonth[k].expense), backgroundColor: '#ef4444', borderRadius: 6, maxBarThickness: 24 },
        { label: 'Dívidas/Assinaturas', data: keys.map(k => byMonth[k].divida), backgroundColor: '#f59e0b', borderRadius: 6, maxBarThickness: 24 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, color: tickColor } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickColor } },
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } }
      }
    }
  });
}

function renderBalanceChart(transactions) {
  const canvas = document.getElementById('balanceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (balanceChartInstance) balanceChartInstance.destroy();

  const isDark = isDarkTheme();
  const gridColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.12)';
  const tickColor = isDark ? '#cbd5e1' : '#334155';

  const byDate = {};
  transactions
    .filter(t => t.type === 'receita' || t.type === 'despesa')
    .forEach(t => {
      const net = t.type === 'receita' ? t.amount : -t.amount;
      byDate[t.date] = (byDate[t.date] || 0) + net;
    });

  const dates = Object.keys(byDate).sort();
  let running = 0;
  const balances = dates.map(d => {
    running += byDate[d];
    return running;
  });
  const labels = dates.map(formatDate);

  balanceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Saldo acumulado',
        data: balances,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.15)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#6366f1',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickColor } },
        y: { grid: { color: gridColor }, ticks: { color: tickColor } }
      }
    }
  });
}
