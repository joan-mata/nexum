import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { formatDate } from '../utils/date';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { lendersApi, LenderInput } from '../api/lenders';
import { TRANSACTION_TYPE_LABELS, INFLOW_TYPES } from '../api/transactions';

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function LenderDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<LenderInput>({ name: '', email: null, phone: null, account_number: null, notes: null });
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['lender', id, 'stats'],
    queryFn: () => lendersApi.getStats(id!).then((r) => r.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: LenderInput) => lendersApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lender', id, 'stats'] });
      qc.invalidateQueries({ queryKey: ['lenders'] });
      setEditing(false);
    },
  });

  const openEdit = () => {
    const l = data?.lender;
    if (!l) return;
    setEditForm({ name: l.name, email: l.email, phone: l.phone, account_number: l.account_number, notes: l.notes });
    setEditing(true);
  };

  const copyAccount = () => {
    const acc = data?.lender?.account_number;
    if (!acc) return;
    navigator.clipboard.writeText(acc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Prestamista no encontrado</p>
        <Link to="/lenders" className="btn-secondary mt-4 inline-block">
          Volver a prestamistas
        </Link>
      </div>
    );
  }

  const { lender, stats, transactions } = data;

  // Build balance evolution chart
  let runningBalance = 0;
  const balanceData = [...transactions]
    .reverse()
    .filter((t) => t.status === 'confirmed')
    .map((t) => {
      const amount = Number(t.amount_in_eur ?? t.amount);
      if (INFLOW_TYPES.includes(t.type)) {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      return {
        date: t.date.slice(0, 10),
        saldo: runningBalance,
      };
    });

  const pending = Number(stats.total_loaned_eur) - Number(stats.total_paid_eur);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/lenders" className="text-gray-400 hover:text-gray-100 text-sm">
          ← Prestamistas
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {editing ? (
            <form
              onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(editForm); }}
              className="card space-y-3 max-w-lg"
            >
              <h2 className="text-base font-semibold text-gray-100">Editar prestamista</h2>
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={editForm.email ?? ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value || null })} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={editForm.phone ?? ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value || null })} />
                </div>
              </div>
              <div>
                <label className="label">Número de cuenta / IBAN</label>
                <input className="input font-mono" value={editForm.account_number ?? ''} onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value || null })} placeholder="ES00 0000 0000 0000 0000 0000" />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input h-16 resize-none" value={editForm.notes ?? ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value || null })} />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-100">{lender.name}</h1>
              {lender.email && <p className="text-gray-400">{lender.email}</p>}
              {lender.phone && <p className="text-gray-400">{lender.phone}</p>}
              {lender.account_number && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-mono text-gray-300">{lender.account_number}</span>
                  <button onClick={copyAccount} className="text-xs text-brand-400 hover:text-brand-300">
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              )}
              {lender.notes && <p className="text-gray-500 text-sm mt-2">{lender.notes}</p>}
            </>
          )}
        </div>
        {!editing && (
          <button onClick={openEdit} className="btn-secondary text-sm ml-4 shrink-0">Editar</button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Total prestado</p>
          <p className="text-xl font-bold positive">€{fmt(Number(stats.total_loaned_eur))}</p>
          <p className="text-xs text-gray-500 mt-0.5">${fmt(Number(stats.total_loaned_usd))} USD</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Total pagado</p>
          <p className="text-xl font-bold negative">€{fmt(Number(stats.total_paid_eur))}</p>
          <p className="text-xs text-gray-500 mt-0.5">${fmt(Number(stats.total_paid_usd))} USD</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Saldo pendiente</p>
          <p className={`text-xl font-bold ${pending > 0 ? 'text-yellow-400' : 'positive'}`}>
            €{fmt(pending)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Transacciones</p>
          <p className="text-xl font-bold text-gray-100">{stats.transaction_count}</p>
        </div>
      </div>

      {/* Balance Chart */}
      {balanceData.length > 1 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Evolución del saldo pendiente</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={balanceData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `€${fmt(v)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(v: number) => [`€${fmt(v)}`, 'Saldo']}
              />
              <Line type="monotone" dataKey="saldo" stroke="#818cf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transactions History */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Historial de transacciones</h2>
        </div>
        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sin transacciones</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripción</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Importe</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const inflow = INFLOW_TYPES.includes(tx.type);
                  return (
                    <tr key={tx.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{TRANSACTION_TYPE_LABELS[tx.type]}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">{tx.description}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={inflow ? 'positive' : 'negative'}>
                          {inflow ? '+' : '-'}{fmt(Number(tx.amount))} {tx.currency}
                        </span>
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
                          {tx.status === 'confirmed' ? 'Conf.' : tx.status === 'pending' ? 'Pend.' : 'Canc.'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
