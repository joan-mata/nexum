import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exitAccountsApi, ExitAccount, ExitAccountInput } from '../api/exitAccounts';
import { AxiosError } from 'axios';

const EMPTY_FORM: ExitAccountInput = {
  name: '',
  account_number: null,
  bank_name: null,
  currency: 'EUR',
  notes: null,
};

export function ExitAccountsPage(): JSX.Element {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ExitAccountInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<ExitAccountInput>(EMPTY_FORM);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['exit-accounts'],
    queryFn: () => exitAccountsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: ExitAccountInput) => exitAccountsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exit-accounts'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al crear');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExitAccountInput }) =>
      exitAccountsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exit-accounts'] });
      setInlineEdit(null);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      alert(err.response?.data?.error ?? 'Error al actualizar');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => exitAccountsApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exit-accounts'] }),
  });

  const openInlineEdit = (acc: ExitAccount) => {
    setInlineForm({
      name: acc.name,
      account_number: acc.account_number,
      bank_name: acc.bank_name,
      currency: acc.currency,
      notes: acc.notes,
    });
    setInlineEdit(acc.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
      setEditId(null);
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Cuentas de salida</h1>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditId(null); setFormError(null); setShowModal(true); }}
          className="btn-primary text-sm"
        >
          + Nueva cuenta
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay cuentas de salida registradas</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Banco</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Cuenta</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Moneda</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => {
                if (inlineEdit === acc.id) {
                  return (
                    <tr key={acc.id} className="border-t border-gray-700/50 bg-gray-700/40">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input text-sm py-1"
                          value={inlineForm.name}
                          onChange={(e) => setInlineForm({ ...inlineForm, name: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input text-sm py-1"
                          value={inlineForm.bank_name ?? ''}
                          onChange={(e) => setInlineForm({ ...inlineForm, bank_name: e.target.value || null })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input text-sm py-1"
                          value={inlineForm.account_number ?? ''}
                          onChange={(e) => setInlineForm({ ...inlineForm, account_number: e.target.value || null })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          className="input text-sm py-1"
                          value={inlineForm.currency}
                          onChange={(e) => setInlineForm({ ...inlineForm, currency: e.target.value as 'EUR' | 'USD' })}
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="input text-sm py-1"
                          value={inlineForm.notes ?? ''}
                          onChange={(e) => setInlineForm({ ...inlineForm, notes: e.target.value || null })}
                        />
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => updateMutation.mutate({ id: acc.id, data: inlineForm })}
                          className="text-xs text-green-400 hover:text-green-300 mr-2"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setInlineEdit(null)}
                          className="text-xs text-gray-400 hover:text-gray-300"
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={acc.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-gray-100 font-medium">{acc.name}</td>
                    <td className="px-4 py-3 text-gray-400">{acc.bank_name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {acc.account_number ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${acc.currency === 'EUR' ? 'bg-blue-900/50 text-blue-400' : 'bg-green-900/50 text-green-400'}`}>
                        {acc.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">
                      {acc.notes ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openInlineEdit(acc)}
                        className="text-xs text-brand-400 hover:text-brand-300 mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Desactivar "${acc.name}"?`)) deactivateMutation.mutate(acc.id);
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Desactivar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for new account */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Nueva cuenta de salida</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input
                  type="text"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Banco</label>
                <input
                  type="text"
                  className="input"
                  value={form.bank_name ?? ''}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value || null })}
                />
              </div>
              <div>
                <label className="label">Número de cuenta / IBAN</label>
                <input
                  type="text"
                  className="input"
                  value={form.account_number ?? ''}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value || null })}
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
              <div>
                <label className="label">Notas</label>
                <textarea
                  className="input h-16 resize-none"
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                />
              </div>
              {formError && (
                <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Crear</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
