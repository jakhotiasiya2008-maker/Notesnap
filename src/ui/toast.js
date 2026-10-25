import gsap from 'gsap';
import { triggerHaptic } from './haptics.js';

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-label', 'Notifications');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show a toast notification
 * @param {string} message 
 * @param {Object} options { type: 'info'|'success'|'error', duration: 3500, action: { label: string, onClick: function } }
 */
export function showToast(message, options = {}) {
  const container = ensureContainer();
  const { type = 'info', duration = 3500, action = null } = options;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${getIcon(type)}</span>
      <span class="toast-message">${message}</span>
    </div>
    ${action ? `<button class="toast-action-btn" type="button">${action.label}</button>` : ''}
  `;

  if (action) {
    const btn = toast.querySelector('.toast-action-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      action.onClick();
      dismissToast(toast);
    });
  }

  container.appendChild(toast);
  triggerHaptic(12);

  // Animate in
  gsap.fromTo(toast,
    { y: 20, opacity: 0, scale: 0.95 },
    { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.4)' }
  );

  // Auto dismiss
  let timer = null;
  if (duration > 0) {
    timer = setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }

  toast.addEventListener('click', () => {
    if (timer) clearTimeout(timer);
    dismissToast(toast);
  });

  return {
    dismiss: () => dismissToast(toast)
  };
}

function dismissToast(toast) {
  gsap.to(toast, {
    opacity: 0,
    y: -15,
    scale: 0.92,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }
  });
}

function getIcon(type) {
  switch (type) {
    case 'success':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
    case 'error':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    default:
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }
}
