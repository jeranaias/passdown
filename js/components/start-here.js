// ─── Start Here ──────────────────────────────────────────────────────────────
// Curated day-one reading list with reordering and entry picker.

import { html } from '../core/config.js';
import { CATEGORIES } from '../core/config.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import { Button, Modal, EmptyState, showToast } from '../shared/ui.js';
import { IconStar, IconPlus, IconArrowUp, IconArrowDown, IconTrash, IconSearch } from '../shared/icons.js';

const { useState, useCallback, useMemo } = React;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategoryInfo(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return { label: categoryId, color: 'gray' };
  return { label: cat.label, color: cat.color };
}

// ─── Entry Picker Modal ──────────────────────────────────────────────────────

function EntryPicker({ isOpen, onClose, entries, startHereIds, onAdd }) {
  const [search, setSearch] = useState('');

  const available = useMemo(() => {
    const idSet = new Set(startHereIds);
    let list = entries.filter(e => !idSet.has(e.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.content || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, startHereIds, search]);

  return html`
    <${Modal} isOpen=${isOpen} onClose=${onClose} title="Add to Start Here" size="lg">
      <div class="space-y-4">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            ${IconSearch({ size: 16 })}
          </div>
          <input type="text" value=${search} onChange=${e => setSearch(e.target.value)}
            placeholder="Search entries..."
            class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm
                   focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 placeholder-slate-400" />
        </div>

        ${available.length === 0 && html`
          <div class="text-center py-6 text-sm text-slate-500">
            ${entries.length === startHereIds.length
              ? 'All entries are already in the Start Here list.'
              : 'No entries match your search.'}
          </div>
        `}

        <div class="max-h-96 overflow-y-auto divide-y divide-slate-100">
          ${available.map(entry => {
            const catInfo = getCategoryInfo(entry.category);
            return html`
              <div key=${entry.id} class="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                <div class="flex-1 min-w-0 mr-3">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-navy-900 truncate">${entry.title}</span>
                    <span class=${'text-xs px-1.5 py-0.5 rounded bg-' + catInfo.color + '-100 text-' + catInfo.color + '-800'}>
                      ${catInfo.label}
                    </span>
                  </div>
                  ${entry.content && html`
                    <p class="text-xs text-slate-500 truncate mt-0.5">${entry.content.slice(0, 100)}</p>
                  `}
                </div>
                <button onClick=${() => onAdd(entry.id)}
                  class="px-3 py-1.5 text-xs font-medium bg-navy-50 text-navy-700 rounded hover:bg-navy-100 border border-navy-200 transition-colors flex-shrink-0">
                  Add
                </button>
              </div>
            `;
          })}
        </div>
      </div>
    <//>
  `;
}

// ─── Start Here Item ─────────────────────────────────────────────────────────

function StartHereItem({ entry, index, total, onMoveUp, onMoveDown, onRemove, onEdit }) {
  const catInfo = getCategoryInfo(entry.category);

  return html`
    <div class="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow group">
      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center text-sm font-bold">
        ${index + 1}
      </div>

      <div class="flex-1 min-w-0 cursor-pointer" onClick=${() => onEdit(entry)}>
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-sm font-semibold text-navy-900">${entry.title}</h3>
          <span class=${'text-xs px-1.5 py-0.5 rounded bg-' + catInfo.color + '-100 text-' + catInfo.color + '-800'}>
            ${catInfo.label}
          </span>
        </div>
        ${entry.content && html`
          <p class="text-xs text-slate-500 line-clamp-2 mt-1">${entry.content.slice(0, 150)}</p>
        `}
      </div>

      <div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick=${() => onMoveUp(index)} disabled=${index === 0}
          class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move up">
          ${IconArrowUp({ size: 16 })}
        </button>
        <button onClick=${() => onMoveDown(index)} disabled=${index === total - 1}
          class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move down">
          ${IconArrowDown({ size: 16 })}
        </button>
        <button onClick=${() => onRemove(index)}
          class="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
          title="Remove from list">
          ${IconTrash({ size: 16 })}
        </button>
      </div>
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StartHere() {
  const { entries, startHereIds, setStartHere, navigate, billet } = useApp();
  const [pickerOpen, setPickerOpen] = useState(false);

  const startHereEntries = useMemo(() => {
    const entryMap = new Map(entries.map(e => [e.id, e]));
    return startHereIds.map(id => entryMap.get(id)).filter(Boolean);
  }, [entries, startHereIds]);

  const handleMoveUp = useCallback((index) => {
    if (index === 0) return;
    const ids = [...startHereIds];
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    setStartHere(ids);
  }, [startHereIds, setStartHere]);

  const handleMoveDown = useCallback((index) => {
    if (index >= startHereIds.length - 1) return;
    const ids = [...startHereIds];
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    setStartHere(ids);
  }, [startHereIds, setStartHere]);

  const handleRemove = useCallback((index) => {
    const ids = startHereIds.filter((_, i) => i !== index);
    setStartHere(ids);
    showToast('Removed from Start Here list', 'info');
  }, [startHereIds, setStartHere]);

  const handleAdd = useCallback((entryId) => {
    if (startHereIds.includes(entryId)) return;
    setStartHere([...startHereIds, entryId]);
    showToast('Added to Start Here list', 'success');
  }, [startHereIds, setStartHere]);

  const handleEdit = useCallback((entry) => {
    navigate('capture?id=' + entry.id);
  }, [navigate]);

  const headerText = billet.title
    ? 'Welcome to ' + billet.title + '. Start with these entries to get oriented.'
    : 'Start with these entries to get oriented in your new billet.';

  if (startHereEntries.length === 0) {
    return html`
      <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
          ${IconStar({ size: 24 })} Start Here
        </h1>
        <${EmptyState}
          icon=${IconStar({ size: 48 })}
          title="No essential reading list created yet"
          description="Flag entries as essential reading when capturing knowledge, or add them here to build a curated onboarding list for your successor."
          action=${html`<${Button} onClick=${() => setPickerOpen(true)}>${IconPlus({ size: 16 })} Add to Start Here<//>`}
        />
        <${EntryPicker} isOpen=${pickerOpen} onClose=${() => setPickerOpen(false)}
          entries=${entries} startHereIds=${startHereIds} onAdd=${handleAdd} />
      </div>
    `;
  }

  return html`
    <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
          ${IconStar({ size: 24 })} Start Here
        </h1>
        <${Button} onClick=${() => setPickerOpen(true)}>${IconPlus({ size: 16 })} Add to Start Here<//>
      </div>

      <div class="bg-olive-50 border border-olive-200 rounded-lg p-4">
        <p class="text-sm text-olive-800">${headerText}</p>
      </div>

      <div class="space-y-2">
        ${startHereEntries.map((entry, i) => html`
          <${StartHereItem} key=${entry.id} entry=${entry} index=${i} total=${startHereEntries.length}
            onMoveUp=${handleMoveUp} onMoveDown=${handleMoveDown} onRemove=${handleRemove} onEdit=${handleEdit} />
        `)}
      </div>

      <${EntryPicker} isOpen=${pickerOpen} onClose=${() => setPickerOpen(false)}
        entries=${entries} startHereIds=${startHereIds} onAdd=${handleAdd} />
    </div>
  `;
}
