// Modal de confirmação centralizado (substitui o confirm() nativo do navegador)
function confirmDialog(message, { title = 'Tem certeza?', confirmLabel = 'Confirmar', danger = true } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle">
        <p class="confirm-title" id="confirmTitle">${title}</p>
        <p class="confirm-message">${message}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-secondary" data-confirm-cancel>Cancelar</button>
          <button type="button" class="${danger ? 'btn-danger' : ''}" data-confirm-ok>${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('confirm-visible'));

    function close(result) {
      overlay.classList.remove('confirm-visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    }

    overlay.querySelector('[data-confirm-ok]').addEventListener('click', () => close(true));
    overlay.querySelector('[data-confirm-cancel]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKeydown);
  });
}
