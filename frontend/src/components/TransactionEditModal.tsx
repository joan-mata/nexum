import { useState } from 'react';
import {
  Transaction,
  TransactionInput,
  TransactionType,
  TRANSACTION_TYPE_LABELS,
} from '../api/transactions';
import { Lender } from '../api/lenders';

const TYPES_NEEDING_LENDER: TransactionType[] = ['loan_received', 'lender_payment', 'return_received'];
const TYPES_NEEDING_EXIT: TransactionType[] = ['transfer_out'];

interface Props {
  tx: Transaction;
  lenders: Lender[];
  onSave: (data: TransactionInput, scope: 'one' | 'all') => void;
  onUpdateRecurrenceEnd: (newEndDate: string) => void;
  onClose: () => void;
  isSaving: boolean;
  isUpdatingRecurrence?: boolean;
  error?: string | null;
}

export function TransactionEditModal({ tx, lenders, onSave, onUpdateRecurrenceEnd, onClose, isSaving, isUpdatingRecurrence, error }: Props): JSX.Element {
  const [form, setForm] = useState<TransactionInput>({
    date: tx.date.slice(0, 10),
    type: tx.type,
    amount: Number(tx.amount),
    currency: tx.currency,
    exchange_rate: tx.exchange_rate ? Number(tx.exchange_rate) : null,
    lender_id: tx.lender_id,
    exit_account_name: tx.exit_account_name,
    description: tx.description,
    reference_transaction_id: tx.reference_transaction_id,
    status: tx.status,
    notes: tx.notes,
  });
  const [scopeDialog, setScopeDialog] = useState(false);
  const isRecurring = !!tx.recurrence_master_id;
  const currentSeriesEnd = tx.series_recurrence_end_date?.slice(0, 10) ?? '';
  const [newSeriesEnd, setNewSeriesEnd] = useState(currentSeriesEnd);
  const [showRecurrencePanel, setShowRecurrencePanel] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecurring) {
      setScopeDialog(true);
    } else {
      onSave(form, 'one');
    }
  };

  return (
    <>
      {/* Edit modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-gray-100">Editar transacción</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fecha *</label>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Estado</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                >
                  <option value="confirmed">Confirmada</option>
                  <option value="pending">Pendiente</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Tipo *</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as TransactionType, lender_id: null, exit_account_name: null })
                }
                required
              >
                {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
                  <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Importe *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input"
                  value={form.amount || ''}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div>
                <label className="label">Moneda *</label>
                <select
                  className="input"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value as 'EUR' | 'USD' })}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Tipo de cambio EUR/USD</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                className="input"
                placeholder="Ej: 1.0850"
                value={form.exchange_rate ?? ''}
                onChange={(e) =>
                  setForm({ ...form, exchange_rate: e.target.value ? parseFloat(e.target.value) : null })
                }
              />
            </div>

            {TYPES_NEEDING_LENDER.includes(form.type) && (
              <div>
                <label className="label">Prestamista</label>
                <select
                  className="input"
                  value={form.lender_id ?? ''}
                  onChange={(e) => setForm({ ...form, lender_id: e.target.value || null })}
                >
                  <option value="">Sin prestamista</option>
                  {lenders.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {TYPES_NEEDING_EXIT.includes(form.type) && (
              <div>
                <label className="label">Cuenta de salida</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: IBAN / nombre de cuenta"
                  value={form.exit_account_name ?? ''}
                  onChange={(e) => setForm({ ...form, exit_account_name: e.target.value || null })}
                />
              </div>
            )}

            <div>
              <label className="label">Descripción</label>
              <input
                type="text"
                className="input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={1000}
              />
            </div>

            <div>
              <label className="label">Notas</label>
              <textarea
                className="input h-20 resize-none"
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
              />
            </div>

            {/* Recurrence end-date management */}
            {isRecurring && (
              <div className="border-t border-gray-700 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRecurrencePanel((v) => !v)}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                >
                  <span>{showRecurrencePanel ? '▾' : '▸'}</span>
                  Gestionar fin de serie recurrente
                </button>
                {showRecurrencePanel && (
                  <div className="mt-3 space-y-3 bg-gray-700/30 rounded-lg p-4">
                    <p className="text-xs text-gray-400">
                      Fin actual: <span className="text-gray-200 font-medium">{currentSeriesEnd || '—'}</span>
                    </p>
                    <div>
                      <label className="label">Nueva fecha de fin</label>
                      <input
                        type="date"
                        className="input"
                        value={newSeriesEnd}
                        onChange={(e) => setNewSeriesEnd(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Si la fecha es anterior al fin actual, se cancelarán las instancias posteriores.
                      Si es posterior, se generarán nuevas.
                    </p>
                    <button
                      type="button"
                      disabled={!newSeriesEnd || newSeriesEnd === currentSeriesEnd || isUpdatingRecurrence}
                      onClick={() => onUpdateRecurrenceEnd(newSeriesEnd)}
                      className="btn-primary w-full text-sm py-2 disabled:opacity-40"
                    >
                      {isUpdatingRecurrence ? 'Aplicando...' : 'Aplicar cambio de serie'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={isSaving} className="btn-primary flex-1">
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Scope dialog — only shown for recurring transactions */}
      {scopeDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-100">¿Qué deseas modificar?</h3>
              <p className="text-sm text-gray-400 mt-1">
                Esta transacción forma parte de una serie recurrente.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setScopeDialog(false); onSave(form, 'one'); }}
                className="w-full text-left px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                <p className="text-sm font-medium text-gray-100">Solo esta transacción</p>
                <p className="text-xs text-gray-400 mt-0.5">Las demás de la serie no cambian</p>
              </button>
              <button
                onClick={() => { setScopeDialog(false); onSave(form, 'all'); }}
                className="w-full text-left px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                <p className="text-sm font-medium text-gray-100">Todas las recurrentes</p>
                <p className="text-xs text-gray-400 mt-0.5">Se actualizan todos los registros de la serie</p>
              </button>
            </div>
            <button
              onClick={() => setScopeDialog(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
