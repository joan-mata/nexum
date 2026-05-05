import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  transactionsApi,
  TRANSACTION_TYPE_LABELS,
  INFLOW_TYPES,
  TransactionType,
  TransactionInput,
  TransactionFilters,
} from '../api/transactions';
import { lendersApi } from '../api/lenders';
import { exitAccountsApi } from '../api/exitAccounts';
import { AxiosError } from 'axios';

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const EMPTY_FORM: TransactionInput = {
  date: new Date().toISOString().slice(0, 10),
  type: 'loan_received',
  amount: 0,
  currency: 'EUR',
  exchange_rate: null,
  lender_id: null,
  exit_account_id: null,
  description: '',
  status: 'confirmed',
  notes: null,
};

const TYPES_NEEDING_LENDER: TransactionType[] = [
  'loan_received',
  'lender_payment',
  'return_received',
];

const TYPES_NEEDING_EXIT: TransactionType[] = ['transfer_out'];

export function TransactionsPage(): JSX.Element {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 50 });
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState<string | null>(null);
  const [form, setForm] = useState<TransactionInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionsApi.list(filters).then((r) => r.data),
  });

  const { data: lenders = [] } = useQuery({
    queryKey: ['lenders'],
    queryFn: () => lendersApi.list().then((r) => r.data),
  });

  const { data: exitAccounts = [] } = useQuery({
    queryKey: ['exit-accounts'],
    queryFn: () => exitAccountsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: TransactionInput) => transactionsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al guardar');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionInput }) =>
      transactionsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowModal(false);
      setEditTx(null);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al actualizar');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTx(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (tx: import('../api/transactions').Transaction) => {
    setForm({
      date: tx.date.slice(0, 10),
      type: tx.type,
      amount: Number(tx.amount),
      currency: tx.currency,
      exchange_rate: tx.exchange_rate ? Number(tx.exchange_rate) : null,
      lender_id: tx.lender_id,
      exit_account_id: tx.exit_account_id,
      description: tx.description,
      status: tx.status,
      notes: tx.notes,
    });
    setEditTx(tx.id);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editTx) {
      updateMutation.mutate({ id: editTx, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const exportCSV = () => {
    const rows = data?.data ?? [];
    const headers = ['Fecha', 'Tipo', 'Importe', 'Moneda', 'EUR', 'USD', 'Prestamista', 'Descripción', 'Estado'];
    const lines = [
      headers.join(';'),
      ...rows.map((t) =>
        [
          t.date,
          TRANSACTION_TYPE_LABELS[t.type],
          t.amount,
          t.currency,
          t.amount_in_eur ?? '',
          t.amount_in_usd ?? '',
          t.lender_name ?? '',
          `"${t.description}"`,
          t.status,
        ].join(';')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexum_transacciones_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const transactions = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Transacciones</h1>
        <div className="flex gap-3">
          <button onClick={exportCSV} className="btn-secondary text-sm">
            Exportar CSV
          </button>
          <button onClick={openCreate} className="btn-primary text-sm">
            + Nueva transacción
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="label">Desde</label>
          <input
            type="date"
            className="input text-sm"
            value={filters.date_from ?? ''}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input
            type="date"
            className="input text-sm"
            value={filters.date_to ?? ''}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select
            className="input text-sm"
            value={filters.type ?? ''}
            onChange={(e) =>
              setFilters({ ...filters, type: (e.target.value as TransactionType) || undefined, page: 1 })
            }
          >
            <option value="">Todos</option>
            {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
              <option key={t} value={t}>
                {TRANSACTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Moneda</label>
          <select
            className="input text-sm"
            value={filters.currency ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                currency: (e.target.value as 'EUR' | 'USD') || undefined,
                page: 1,
              })
            }
          >
            <option value="">Todas</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-400">{total} transacciones</span>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No hay transacciones</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Prestamista</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripción</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Importe</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">EUR</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const inflow = INFLOW_TYPES.includes(tx.type);
                  return (
                    <tr key={tx.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {TRANSACTION_TYPE_LABELS[tx.type]}
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[100px] truncate">
                        {tx.lender_name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={inflow ? 'positive' : 'negative'}>
                          {inflow ? '+' : '-'}{fmt(Number(tx.amount))} {tx.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {tx.amount_in_eur != null ? (
                          <span className={inflow ? 'positive' : 'negative'}>
                            {inflow ? '+' : '-'}€{fmt(Number(tx.amount_in_eur))}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`badge ${
                            tx.status === 'confirmed'
                              ? 'bg-green-900/50 text-green-400'
                              : tx.status === 'pending'
                              ? 'bg-yellow-900/50 text-yellow-400'
                              : 'bg-red-900/50 text-red-400'
                          }`}
                        >
                          {tx.status === 'confirmed'
                            ? 'Confirmada'
                            : tx.status === 'pending'
                            ? 'Pendiente'
                            : 'Cancelada'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(tx)}
                          className="text-xs text-brand-400 hover:text-brand-300 mr-3"
                        >
                          Editar
                        </button>
                        {tx.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              if (confirm('¿Cancelar esta transacción?')) {
                                cancelMutation.mutate(tx.id);
                              }
                            }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > (filters.limit ?? 50) && (
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-2">
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
            >
              Anterior
            </button>
            <span className="text-sm text-gray-400 self-center px-2">
              Pág. {filters.page ?? 1}
            </span>
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={(filters.page ?? 1) * (filters.limit ?? 50) >= total}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">
                {editTx ? 'Editar transacción' : 'Nueva transacción'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-100 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as typeof form.status })
                    }
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
                    setForm({ ...form, type: e.target.value as TransactionType, lender_id: null, exit_account_id: null })
                  }
                  required
                >
                  {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
                    <option key={t} value={t}>
                      {TRANSACTION_TYPE_LABELS[t]}
                    </option>
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
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {TYPES_NEEDING_EXIT.includes(form.type) && (
                <div>
                  <label className="label">Cuenta de salida</label>
                  <select
                    className="input"
                    value={form.exit_account_id ?? ''}
                    onChange={(e) => setForm({ ...form, exit_account_id: e.target.value || null })}
                  >
                    <option value="">Sin cuenta</option>
                    {exitAccounts.map((ea) => (
                      <option key={ea.id} value={ea.id}>
                        {ea.name} ({ea.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Descripción *</label>
                <input
                  type="text"
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
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

              {formError && (
                <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editTx ? 'Guardar cambios' : 'Crear transacción'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
