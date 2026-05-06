import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, TRANSACTION_TYPE_LABELS, INFLOW_TYPES, Transaction, TransactionInput } from '../api/transactions';
import { lendersApi } from '../api/lenders';
import { formatDate } from '../utils/date';
import { TransactionEditModal } from '../components/TransactionEditModal';
import { AxiosError } from 'axios';

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function monthRange(offset: number): { date_from: string; date_to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  const label = from.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

export function ThisMonthPage(): JSX.Element {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const { date_from, date_to, label } = monthRange(offset);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-transactions', date_from],
    queryFn: () =>
      transactionsApi.list({ date_from, date_to, limit: 200 }).then((r) => r.data),
  });

  const { data: lenders = [] } = useQuery({
    queryKey: ['lenders'],
    queryFn: () => lendersApi.list().then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['monthly-transactions', date_from] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionInput }) =>
      transactionsApi.update(id, data),
    onSuccess: () => { invalidate(); setEditTx(null); setEditError(null); },
    onError: (err: AxiosError<{ error: string }>) =>
      setEditError(err.response?.data?.error ?? 'Error al guardar'),
  });

  const updateAllMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionInput }) =>
      transactionsApi.updateAllRecurring(id, data),
    onSuccess: () => { invalidate(); setEditTx(null); setEditError(null); },
    onError: (err: AxiosError<{ error: string }>) =>
      setEditError(err.response?.data?.error ?? 'Error al guardar'),
  });

  const updateRecurrenceEndMutation = useMutation({
    mutationFn: ({ id, end_date }: { id: string; end_date: string }) =>
      transactionsApi.updateRecurrenceEnd(id, end_date),
    onSuccess: () => { invalidate(); setEditTx(null); setEditError(null); },
    onError: (err: AxiosError<{ error: string }>) =>
      setEditError(err.response?.data?.error ?? 'Error al actualizar la serie'),
  });

  const handleSave = (formData: TransactionInput, scope: 'one' | 'all') => {
    if (!editTx) return;
    setEditError(null);
    if (scope === 'all') {
      updateAllMutation.mutate({ id: editTx.id, data: formData });
    } else {
      updateMutation.mutate({ id: editTx.id, data: formData });
    }
  };

  const confirmMutation = useMutation({
    mutationFn: (tx: Transaction) =>
      transactionsApi.update(tx.id, {
        date: tx.date.slice(0, 10),
        type: tx.type,
        amount: Number(tx.amount),
        currency: tx.currency,
        exchange_rate: tx.exchange_rate ? Number(tx.exchange_rate) : null,
        lender_id: tx.lender_id,
        exit_account_name: tx.exit_account_name,
        description: tx.description,
        reference_transaction_id: tx.reference_transaction_id,
        status: 'confirmed',
        notes: tx.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-transactions', date_from] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-transactions', date_from] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const txs = data?.data ?? [];
  const pending = txs.filter((t) => t.status === 'pending');
  const confirmed = txs.filter((t) => t.status === 'confirmed');
  const cancelled = txs.filter((t) => t.status === 'cancelled');

  const sumEur = (list: Transaction[], types: string[]) =>
    list
      .filter((t) => types.includes(t.type) && t.status === 'confirmed')
      .reduce((s, t) => s + Number(t.amount_in_eur ?? 0), 0);

  const totalIn = sumEur(txs, INFLOW_TYPES);
  const totalOut = sumEur(
    txs,
    txs.map((t) => t.type).filter((t) => !INFLOW_TYPES.includes(t as never))
  );
  const netEur = totalIn - totalOut;

  const isBusy = (id: string) =>
    (confirmMutation.isPending && (confirmMutation.variables as Transaction)?.id === id) ||
    (cancelMutation.isPending && cancelMutation.variables === id);

  return (
    <div className="space-y-6">
      {/* Header with month navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setOffset((o) => o - 1)}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-100 transition-colors text-lg leading-none"
          title="Mes anterior"
        >
          ‹
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-bold text-gray-100">{label}</h1>
          {pending.length > 0 && (
            <span className="badge bg-yellow-900/60 text-yellow-400 text-xs px-2 py-1 shrink-0">
              {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setOffset((o) => o + 1)}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-100 transition-colors text-lg leading-none"
          title="Mes siguiente"
        >
          ›
        </button>
        {offset !== 0 && (
          <button
            onClick={() => setOffset(0)}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            Hoy
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Entradas</p>
          <p className="text-xl font-bold positive">+€{fmt(totalIn)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Salidas</p>
          <p className="text-xl font-bold negative">-€{fmt(totalOut)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Neto confirmado</p>
          <p className={`text-xl font-bold ${netEur >= 0 ? 'positive' : 'negative'}`}>
            {netEur >= 0 ? '+' : ''}€{fmt(netEur)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Transacciones</p>
          <p className="text-xl font-bold text-gray-100">{confirmed.length} confirmadas</p>
        </div>
      </div>

      {/* Pendientes */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : pending.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
            <h2 className="text-sm font-semibold text-gray-200">Pendientes de revisión</h2>
          </div>
          <div className="divide-y divide-gray-700/50">
            {pending.map((tx) => {
              const inflow = INFLOW_TYPES.includes(tx.type);
              const busy = isBusy(tx.id);
              return (
                <div key={tx.id} className="flex items-center gap-3 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-400">
                        {TRANSACTION_TYPE_LABELS[tx.type]}
                      </span>
                      {tx.lender_name && (
                        <>
                          <span className="text-xs text-gray-500">·</span>
                          <span className="text-xs text-gray-400 truncate">{tx.lender_name}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-200 mt-0.5 truncate">{tx.description}</p>
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${inflow ? 'positive' : 'negative'}`}>
                    {inflow ? '+' : '-'}{fmt(Number(tx.amount))} {tx.currency}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setEditTx(tx); setEditError(null); }}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600 disabled:opacity-40 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => confirmMutation.mutate(tx)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-900/40 text-green-400 hover:bg-green-900/70 border border-green-800/50 disabled:opacity-40 transition-colors"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate(tx.id)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/40 text-red-400 hover:bg-red-900/70 border border-red-800/50 disabled:opacity-40 transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !isLoading && (
          <div className="card text-center py-8">
            <p className="text-green-400 font-medium">Sin pendientes este mes</p>
          </div>
        )
      )}

      {/* Confirmadas */}
      {confirmed.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-200">Confirmadas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripción</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Importe</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">EUR</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {confirmed.map((tx) => {
                  const inflow = INFLOW_TYPES.includes(tx.type);
                  return (
                    <tr key={tx.id} className="border-t border-gray-700/50 hover:bg-gray-700/20">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{TRANSACTION_TYPE_LABELS[tx.type]}</td>
                      <td className="px-4 py-3 text-gray-300 max-w-[220px] truncate">{tx.description}</td>
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
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setEditTx(tx); setEditError(null); }}
                          className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTx && (
        <TransactionEditModal
          tx={editTx}
          lenders={lenders}
          onSave={handleSave}
          onUpdateRecurrenceEnd={(end_date) =>
            updateRecurrenceEndMutation.mutate({ id: editTx.id, end_date })
          }
          onClose={() => { setEditTx(null); setEditError(null); }}
          isSaving={updateMutation.isPending || updateAllMutation.isPending}
          isUpdatingRecurrence={updateRecurrenceEndMutation.isPending}
          error={editError}
        />
      )}

      {/* Canceladas */}
      {cancelled.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-400">Canceladas ({cancelled.length})</h2>
          </div>
          <div className="divide-y divide-gray-700/50">
            {cancelled.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-6 py-3 opacity-50">
                <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(tx.date)}</span>
                <span className="text-xs text-gray-500">{TRANSACTION_TYPE_LABELS[tx.type]}</span>
                <span className="text-sm text-gray-500 flex-1 truncate">{tx.description}</span>
                <span className="text-sm text-gray-500 whitespace-nowrap line-through">
                  {fmt(Number(tx.amount))} {tx.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
