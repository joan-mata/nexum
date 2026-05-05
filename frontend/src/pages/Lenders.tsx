import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { lendersApi, LenderInput } from '../api/lenders';
import { AxiosError } from 'axios';

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const EMPTY_FORM: LenderInput = { name: '', email: null, phone: null, notes: null };

export function LendersPage(): JSX.Element {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LenderInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: lenders = [], isLoading } = useQuery({
    queryKey: ['lenders'],
    queryFn: () => lendersApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: LenderInput) => lendersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lenders'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al crear');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LenderInput }) => lendersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lenders'] });
      setShowModal(false);
      setEditId(null);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al actualizar');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => lendersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lenders'] }),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (l: (typeof lenders)[0]) => {
    setForm({ name: l.name, email: l.email, phone: l.phone, notes: l.notes });
    setEditId(l.id);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Prestamistas</h1>
        <button onClick={openCreate} className="btn-primary text-sm">
          + Nuevo prestamista
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
        </div>
      ) : lenders.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay prestamistas registrados</p>
          <button onClick={openCreate} className="btn-primary mt-4 text-sm">
            Añadir prestamista
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lenders.map((l) => {
            const loaned = Number(l.total_loaned_eur ?? 0);
            const paid = Number(l.total_paid_eur ?? 0);
            const pending = loaned - paid;

            return (
              <div key={l.id} className="card hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-100 text-lg">{l.name}</h3>
                    {l.email && <p className="text-sm text-gray-400">{l.email}</p>}
                    {l.phone && <p className="text-sm text-gray-400">{l.phone}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(l)}
                      className="text-xs text-brand-400 hover:text-brand-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Desactivar a ${l.name}?`)) deactivateMutation.mutate(l.id);
                      }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Desactivar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Prestado</p>
                    <p className="text-sm font-semibold positive">€{fmt(loaned)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pagado</p>
                    <p className="text-sm font-semibold negative">€{fmt(paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pendiente</p>
                    <p className={`text-sm font-semibold ${pending > 0 ? 'text-yellow-400' : 'positive'}`}>
                      €{fmt(pending)}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/lenders/${l.id}`}
                  className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Ver detalle →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">
                {editId ? 'Editar prestamista' : 'Nuevo prestamista'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-100 text-xl">
                ×
              </button>
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
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={form.email ?? ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value || null })}
                />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input
                  type="text"
                  className="input"
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value || null })}
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
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">
                  {editId ? 'Guardar' : 'Crear'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
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
