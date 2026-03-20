import { html } from '../core/config.js';
import { IconX } from './icons.js';

const { useState, useEffect, useCallback, useRef } = React;

// ─── Button ──────────────────────────────────────────────────────────────────

const BUTTON_VARIANTS = {
  primary:   'bg-navy-700 hover:bg-navy-800 text-white shadow-sm',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm',
  danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm',
  ghost:     'bg-transparent hover:bg-slate-100 text-slate-600',
  success:   'bg-green-600 hover:bg-green-700 text-white shadow-sm',
  warning:   'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
};

const BUTTON_SIZES = {
  sm: 'px-2.5 py-1 text-xs rounded',
  md: 'px-3.5 py-2 text-sm rounded-md',
  lg: 'px-5 py-2.5 text-base rounded-lg',
};

/**
 * Reusable Button component.
 * @param {Object} props
 * @param {'primary'|'secondary'|'danger'|'ghost'|'success'|'warning'} props.variant
 * @param {'sm'|'md'|'lg'} props.size
 * @param {boolean} props.disabled
 * @param {Function} props.onClick
 * @param {string} props.className
 * @param {*} props.children
 */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  title,
  children,
  ...rest
}) {
  const baseClasses = 'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  const sizeClasses = BUTTON_SIZES[size] || BUTTON_SIZES.md;

  return html`
    <button
      type=${type}
      class=${`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      disabled=${disabled}
      onClick=${onClick}
      title=${title}
      ...${rest}
    >
      ${children}
    </button>
  `;
}

// ─── Badge ───────────────────────────────────────────────────────────────────

const BADGE_COLORS = {
  blue:   'bg-blue-50 text-blue-700 ring-blue-600/20',
  green:  'bg-green-50 text-green-700 ring-green-600/20',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red:    'bg-red-50 text-red-700 ring-red-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  gray:   'bg-slate-50 text-slate-600 ring-slate-500/20',
  navy:   'bg-navy-50 text-navy-700 ring-navy-600/20',
};

/**
 * Inline badge / pill component.
 * @param {Object} props
 * @param {'blue'|'green'|'yellow'|'red'|'purple'|'orange'|'gray'|'navy'} props.color
 * @param {string} props.className
 * @param {*} props.children
 */
export function Badge({ color = 'gray', className = '', children }) {
  const colorClasses = BADGE_COLORS[color] || BADGE_COLORS.gray;
  return html`
    <span class=${`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${colorClasses} ${className}`}>
      ${children}
    </span>
  `;
}

// ─── Card ────────────────────────────────────────────────────────────────────

/**
 * Card container with shadow and rounded corners.
 */
export function Card({ className = '', onClick, children }) {
  const interactive = onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '';
  return html`
    <div
      class=${`bg-white rounded-lg border border-slate-200 shadow-sm ${interactive} ${className}`}
      onClick=${onClick}
    >
      ${children}
    </div>
  `;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export function Tooltip({ text, children, position = 'top' }) {
  const [show, setShow] = useState(false);

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return html`
    <div
      class="relative inline-flex"
      onMouseEnter=${() => setShow(true)}
      onMouseLeave=${() => setShow(false)}
    >
      ${children}
      ${show && html`
        <div class=${`absolute ${posClasses[position]} z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow-lg pointer-events-none`}>
          ${text}
        </div>
      `}
    </div>
  `;
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

/**
 * Horizontal progress bar.
 * @param {number} value - Current value (0-100)
 * @param {string} color - Tailwind bg color class (e.g. 'bg-blue-500')
 * @param {string} className - Additional classes on the outer container
 */
export function ProgressBar({ value = 0, color = 'bg-navy-600', className = '', height = 'h-2' }) {
  const clamped = Math.min(100, Math.max(0, value));
  return html`
    <div class=${`w-full bg-slate-100 rounded-full overflow-hidden ${height} ${className}`}>
      <div
        class=${`${color} ${height} rounded-full transition-all duration-500 ease-out`}
        style=${{ width: `${clamped}%` }}
      />
    </div>
  `;
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }) {
  return html`
    <div class="flex flex-col items-center justify-center py-12 px-6 text-center">
      ${icon && html`<div class="text-slate-300 mb-3">${icon}</div>`}
      <h3 class="text-sm font-semibold text-slate-700 mb-1">${title}</h3>
      ${description && html`<p class="text-sm text-slate-500 max-w-sm mb-4">${description}</p>`}
      ${action}
    </div>
  `;
}

// ─── Toast Container ─────────────────────────────────────────────────────────

const TOAST_COLORS = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  warning: 'bg-amber-500',
  info:    'bg-navy-700',
};

export function ToastContainer({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;

  return html`
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      ${toasts.map(toast => html`
        <div
          key=${toast.id}
          class=${`toast-enter pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${TOAST_COLORS[toast.type] || TOAST_COLORS.info}`}
          role="alert"
        >
          <span class="flex-1">${toast.message}</span>
          <button
            onClick=${() => onDismiss && onDismiss(toast.id)}
            class="ml-2 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            x
          </button>
        </div>
      `)}
    </div>
  `;
}

// ─── Global Toast System ──────────────────────────────────────────────────────
// showToast() can be called from anywhere; Toast component renders them.

let _toastListeners = [];
let _toasts = [];
let _toastId = 0;

export function showToast(message, type = 'info') {
  const id = ++_toastId;
  const toast = { id, message, type, exiting: false };
  _toasts = [..._toasts, toast];
  _toastListeners.forEach(fn => fn([..._toasts]));

  setTimeout(() => {
    _toasts = _toasts.map(t => t.id === id ? { ...t, exiting: true } : t);
    _toastListeners.forEach(fn => fn([..._toasts]));
    setTimeout(() => {
      _toasts = _toasts.filter(t => t.id !== id);
      _toastListeners.forEach(fn => fn([..._toasts]));
    }, 150);
  }, 3000);

  return id;
}

export function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _toastListeners.push(setToasts);
    return () => {
      _toastListeners = _toastListeners.filter(fn => fn !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  const typeStyles = {
    success: 'bg-green-600 text-white',
    error:   'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
    info:    'bg-navy-700 text-white',
  };

  const typeIcons = {
    success: '\u2713',
    error:   '\u2717',
    warning: '\u26A0',
    info:    '\u2139',
  };

  return html`
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      ${toasts.map(toast => html`
        <div key=${toast.id}
          class=${'pointer-events-auto px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium min-w-[280px] '
            + (typeStyles[toast.type] || typeStyles.info) + ' '
            + (toast.exiting ? 'toast-exit' : 'toast-enter')}
          role="alert">
          <span class="text-base">${typeIcons[toast.type] || typeIcons.info}</span>
          <span class="flex-1">${toast.message}</span>
        </div>
      `)}
    </div>
  `;
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl' };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return html`
    <div ref=${overlayRef}
      class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick=${handleOverlayClick}>
      <div class=${'bg-white rounded-lg shadow-2xl w-full ' + (sizeClasses[size] || sizeClasses.md) + ' max-h-[90vh] flex flex-col'}>
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-navy-900">${title}</h2>
          <button onClick=${onClose}
            class="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close">
            <${IconX} size=${18} />
          </button>
        </div>
        <div class="px-6 py-4 overflow-y-auto flex-1">
          ${children}
        </div>
      </div>
    </div>
  `;
}

// ─── ConfirmDialog ──────────────────────────────────────────────────────────

export function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message, confirmText = 'Confirm', danger = false }) {
  return html`
    <${Modal} isOpen=${isOpen} onClose=${onCancel} title=${title || 'Confirm'} size="sm">
      <div class="space-y-4">
        <p class="text-sm text-slate-600">${message}</p>
        <div class="flex justify-end gap-3">
          <${Button} variant="secondary" onClick=${onCancel}>Cancel<//>
          <${Button} variant=${danger ? 'danger' : 'primary'} onClick=${onConfirm}>${confirmText}<//>
        </div>
      </div>
    <//>
  `;
}

// ─── Tag ────────────────────────────────────────────────────────────────────

export function Tag({ label, onRemove, color = 'slate' }) {
  const colorMap = {
    slate:  'bg-slate-100 text-slate-700 border-slate-200',
    blue:   'bg-blue-100 text-blue-700 border-blue-200',
    green:  'bg-green-100 text-green-700 border-green-200',
    red:    'bg-red-100 text-red-700 border-red-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };
  const style = colorMap[color] || colorMap.slate;

  return html`
    <span class=${'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ' + style}>
      <span>${label}</span>
      ${onRemove && html`
        <button onClick=${onRemove}
          class="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
          aria-label=${'Remove ' + label}>
          <${IconX} size=${12} />
        </button>
      `}
    </span>
  `;
}

// ─── TextInput ──────────────────────────────────────────────────────────────

export function TextInput({ value, onChange, placeholder, label, required = false, type = 'text', id, disabled = false, className = '' }) {
  const inputId = id || 'input-' + (label || '').toLowerCase().replace(/\s+/g, '-');

  return html`
    <div class=${'flex flex-col gap-1 ' + className}>
      ${label && html`
        <label for=${inputId} class="text-sm font-medium text-slate-700">
          ${label}
          ${required && html`<span class="text-red-500 ml-0.5">*</span>`}
        </label>
      `}
      <input
        id=${inputId}
        type=${type}
        value=${value || ''}
        onChange=${(e) => onChange(e.target.value)}
        placeholder=${placeholder || ''}
        required=${required}
        disabled=${disabled}
        class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
               text-slate-700 placeholder-slate-400
               focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
               disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
      />
    </div>
  `;
}

// ─── TextArea ───────────────────────────────────────────────────────────────

export function TextArea({ value, onChange, placeholder, label, rows = 4, id, required = false, disabled = false, className = '' }) {
  const areaId = id || 'textarea-' + (label || '').toLowerCase().replace(/\s+/g, '-');

  return html`
    <div class=${'flex flex-col gap-1 ' + className}>
      ${label && html`
        <label for=${areaId} class="text-sm font-medium text-slate-700">
          ${label}
          ${required && html`<span class="text-red-500 ml-0.5">*</span>`}
        </label>
      `}
      <textarea
        id=${areaId}
        value=${value || ''}
        onChange=${(e) => onChange(e.target.value)}
        placeholder=${placeholder || ''}
        rows=${rows}
        required=${required}
        disabled=${disabled}
        class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
               text-slate-700 placeholder-slate-400 resize-y
               focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
               disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
      />
    </div>
  `;
}

// ─── Select ─────────────────────────────────────────────────────────────────

export function Select({ options, value, onChange, placeholder, label, id, disabled = false, className = '' }) {
  const selectId = id || 'select-' + (label || '').toLowerCase().replace(/\s+/g, '-');

  return html`
    <div class=${'flex flex-col gap-1 ' + className}>
      ${label && html`
        <label for=${selectId} class="text-sm font-medium text-slate-700">${label}</label>
      `}
      <select
        id=${selectId}
        value=${value || ''}
        onChange=${(e) => onChange(e.target.value)}
        disabled=${disabled}
        class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
               text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
               disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
               appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-8">
        ${placeholder && html`<option value="" disabled>${placeholder}</option>`}
        ${(options || []).map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return html`<option key=${val} value=${val}>${lbl}</option>`;
        })}
      </select>
    </div>
  `;
}
