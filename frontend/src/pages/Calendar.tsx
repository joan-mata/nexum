import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi, EventInput, ScheduledEvent } from '../api/calendar';
import { lendersApi } from '../api/lenders';
import { transactionsApi, Transaction, TransactionType, TRANSACTION_TYPE_LABELS } from '../api/transactions';
import { AxiosError } from 'axios';
import { RecurrenceFields } from '../components/RecurrenceFields';
import { RECURRENCE_LABELS, RecurrenceType } from '../utils/recurrence';

const INCOME_TYPES = new Set<TransactionType>(['loan_received', 'return_received', 'reinvestment']);
const isIncome = (type: TransactionType) => INCOME_TYPES.has(type);

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];


const EMPTY_FORM: EventInput = {
  expected_date: new Date().toISOString().slice(0, 10),
  type: 'payment',
  description: '',
  estimated_amount: null,
  currency: null,
  lender_id: null,
  notes: null,
  recurrence_type: 'none',
  recurrence_end_date: null,
};

export function CalendarPage(): JSX.Element {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<ScheduledEvent | null>(null);
  const [form, setForm] = useState<EventInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmCancelSeries, setConfirmCancelSeries] = useState<ScheduledEvent | null>(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const fromDate = `${monthStr}-01`;
  const lastDay = getDaysInMonth(year, month);
  const toDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const { data: events = [] } = useQuery({
    queryKey: ['calendar', fromDate, toDate],
    queryFn: () => calendarApi.events(fromDate, toDate).then((r) => r.data),
  });

  const { data: lenders = [] } = useQuery({
    queryKey: ['lenders'],
    queryFn: () => lendersApi.list().then((r) => r.data),
  });

  const { data: txData } = useQuery({
    queryKey: ['transactions-calendar', fromDate, toDate],
    queryFn: () => transactionsApi.list({ date_from: fromDate, date_to: toDate, limit: 200 }).then((r) => r.data),
  });
  const transactions: Transaction[] = txData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: EventInput) => calendarApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al crear');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<EventInput, 'recurrence_type' | 'recurrence_end_date'> }) =>
      calendarApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setShowModal(false);
      setEditEvent(null);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al actualizar');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => calendarApi.complete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const detachMutation = useMutation({
    mutationFn: (id: string) => calendarApi.detach(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
    onError: (err: AxiosError<{ error: string }>) => {
      alert(err.response?.data?.error ?? 'Error al desanclar');
    },
  });

  const cancelSeriesMutation = useMutation({
    mutationFn: (masterId: string) => calendarApi.cancelSeries(masterId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setConfirmCancelSeries(null);
    },
    onError: (err: AxiosError<{ error: string }>) => {
      alert(err.response?.data?.error ?? 'Error al cancelar la serie');
    },
  });

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const openCreate = (day?: number) => {
    const date = day
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : new Date().toISOString().slice(0, 10);
    setForm({ ...EMPTY_FORM, expected_date: date });
    setEditEvent(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (ev: ScheduledEvent) => {
    setForm({
      expected_date: ev.expected_date,
      type: ev.type,
      description: ev.description,
      estimated_amount: ev.estimated_amount,
      currency: ev.currency,
      lender_id: ev.lender_id,
      notes: ev.notes,
      recurrence_type: 'none',
      recurrence_end_date: null,
    });
    setEditEvent(ev);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editEvent) {
      const { recurrence_type: _rt, recurrence_end_date: _red, ...updateData } = form;
      updateMutation.mutate({ id: editEvent.id, data: updateData });
    } else {
      createMutation.mutate(form);
    }
  };

  const eventMap: Record<number, ScheduledEvent[]> = {};
  for (const ev of events) {
    const day = parseInt(ev.expected_date.slice(8, 10));
    if (!eventMap[day]) eventMap[day] = [];
    eventMap[day].push(ev);
  }

  const txMap: Record<number, Transaction[]> = {};
  for (const tx of transactions) {
    if (tx.status === 'cancelled') continue;
    const day = parseInt(tx.date.slice(8, 10));
    if (!txMap[day]) txMap[day] = [];
    txMap[day].push(tx);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const selectedEvents = selectedDay ? (eventMap[selectedDay] ?? []) : [];
  const selectedTxs = selectedDay ? (txMap[selectedDay] ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Calendario</h1>
        <button onClick={() => openCreate()} className="btn-primary text-sm">
          + Nuevo evento
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="btn-secondary px-3 py-1.5 text-sm">←</button>
            <h2 className="text-lg font-semibold text-gray-100">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="btn-secondary px-3 py-1.5 text-sm">→</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs text-gray-500 py-1 font-medium">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = eventMap[day] ?? [];
              const isToday =
                now.getFullYear() === year &&
                now.getMonth() === month &&
                now.getDate() === day;
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start text-xs transition-colors ${
                    isSelected
                      ? 'bg-brand-600 text-white'
                      : isToday
                      ? 'bg-gray-700 text-gray-100 ring-1 ring-brand-500'
                      : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <span className="font-medium">{day}</span>
                  {(dayEvents.length > 0 || (txMap[day] ?? []).length > 0) && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            ev.is_completed ? 'bg-green-400' : 'bg-yellow-400'
                          }`}
                        />
                      ))}
                      {(txMap[day] ?? []).some(t => isIncome(t.type) && t.status === 'confirmed') && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                      {(txMap[day] ?? []).some(t => isIncome(t.type) && t.status === 'pending') && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-40" />
                      )}
                      {(txMap[day] ?? []).some(t => !isIncome(t.type) && t.status === 'confirmed') && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      )}
                      {(txMap[day] ?? []).some(t => !isIncome(t.type) && t.status === 'pending') && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 opacity-40" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className="card">
          {selectedDay ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-100">
                  {selectedDay} de {MONTH_NAMES[month]}
                </h3>
                <button
                  onClick={() => openCreate(selectedDay)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  + Añadir
                </button>
              </div>
              {selectedEvents.length === 0 && selectedTxs.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin eventos ni transacciones</p>
              ) : (
                <div className="space-y-3">
                  {selectedTxs.map((tx) => {
                    const income = isIncome(tx.type);
                    return (
                      <div
                        key={tx.id}
                        className={`p-3 rounded-lg border ${
                          income ? 'border-emerald-800 bg-emerald-900/20' : 'border-red-800 bg-red-900/20'
                        } ${tx.status === 'pending' ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold ${income ? 'text-emerald-400' : 'text-red-400'}`}>
                                {income ? '↑' : '↓'}
                              </span>
                              <p className="text-sm font-medium text-gray-100 truncate">
                                {tx.description || TRANSACTION_TYPE_LABELS[tx.type]}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{TRANSACTION_TYPE_LABELS[tx.type]}</p>
                            {tx.lender_name && (
                              <p className="text-xs text-gray-500">{tx.lender_name}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-sm font-semibold whitespace-nowrap ${income ? 'text-emerald-400' : 'text-red-400'}`}>
                              {income ? '+' : '-'}{fmt(Number(tx.amount_in_eur ?? tx.amount))} €
                            </span>
                            {tx.status === 'pending' && (
                              <span className="text-xs text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">pendiente</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {selectedEvents.map((ev) => {
                    const isMaster = ev.recurrence_type !== 'none';
                    const isInstance = !!ev.recurrence_master_id;
                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-lg border ${
                          ev.is_completed
                            ? 'border-green-800 bg-green-900/20'
                            : 'border-yellow-800 bg-yellow-900/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium text-gray-100 truncate">
                                {ev.description}
                              </p>
                              {(isMaster || isInstance) && (
                                <span className="text-xs text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded shrink-0">
                                  ↺ {isMaster ? RECURRENCE_LABELS[ev.recurrence_type] : 'serie'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 capitalize mt-0.5">{ev.type}</p>
                            {ev.lender_name && (
                              <p className="text-xs text-gray-500">{ev.lender_name}</p>
                            )}
                            {ev.estimated_amount && (
                              <p className="text-xs text-gray-400 mt-1">
                                {fmt(Number(ev.estimated_amount))} {ev.currency}
                              </p>
                            )}
                          </div>
                          {ev.is_completed ? (
                            <span className="badge bg-green-900/50 text-green-400 shrink-0">
                              Completado
                            </span>
                          ) : (
                            <button
                              onClick={() => completeMutation.mutate(ev.id)}
                              className="text-xs text-green-400 hover:text-green-300 shrink-0"
                            >
                              Completar
                            </button>
                          )}
                        </div>

                        {!ev.is_completed && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                            <button
                              onClick={() => openEdit(ev)}
                              className="text-xs text-brand-400 hover:text-brand-300"
                            >
                              Editar
                            </button>
                            {isInstance && (
                              <button
                                onClick={() => detachMutation.mutate(ev.id)}
                                disabled={detachMutation.isPending}
                                className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-50"
                              >
                                Desanclar de serie
                              </button>
                            )}
                            {isMaster && (
                              <button
                                onClick={() => setConfirmCancelSeries(ev)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Cancelar serie
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Selecciona un día para ver eventos</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">
                  {editEvent ? 'Editar evento' : 'Nuevo evento'}
                </h2>
                {editEvent && (editEvent.recurrence_type !== 'none' || editEvent.recurrence_master_id) && (
                  <p className="text-xs text-purple-400 mt-0.5">
                    Solo se modifica esta ocurrencia
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-100 text-xl">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Fecha *</label>
                <input
                  type="date"
                  className="input"
                  value={form.expected_date}
                  onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
                  required
                />
              </div>

              {!editEvent && (
                <RecurrenceFields
                  type={(form.recurrence_type ?? 'none') as RecurrenceType}
                  endDate={form.recurrence_end_date ?? null}
                  minDate={form.expected_date}
                  onChange={(type, endDate) => setForm({ ...form, recurrence_type: type, recurrence_end_date: endDate })}
                />
              )}

              <div>
                <label className="label">Tipo *</label>
                <input
                  type="text"
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="pago, retorno, vencimiento..."
                  required
                />
              </div>
              <div>
                <label className="label">Descripción *</label>
                <input
                  type="text"
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Importe estimado</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={form.estimated_amount ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, estimated_amount: e.target.value ? parseFloat(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={form.currency ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, currency: (e.target.value as 'EUR' | 'USD') || null })
                    }
                  >
                    <option value="">-</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Prestamista</label>
                <select
                  className="input"
                  value={form.lender_id ?? ''}
                  onChange={(e) => setForm({ ...form, lender_id: e.target.value || null })}
                >
                  <option value="">-</option>
                  {lenders.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
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
                <button type="submit" className="btn-primary flex-1">
                  {editEvent ? 'Guardar' : 'Crear'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel series confirmation */}
      {confirmCancelSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Cancelar serie</h3>
            <p className="text-sm text-gray-400 mb-1">
              Se eliminarán todos los eventos pendientes de la serie:
            </p>
            <p className="text-sm font-medium text-gray-100 mb-4">
              {confirmCancelSeries.description}
              <span className="ml-2 text-xs text-purple-400">
                ({RECURRENCE_LABELS[confirmCancelSeries.recurrence_type]})
              </span>
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Los eventos ya completados no se borran.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => cancelSeriesMutation.mutate(confirmCancelSeries.id)}
                disabled={cancelSeriesMutation.isPending}
                className="btn-primary flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50"
              >
                {cancelSeriesMutation.isPending ? 'Cancelando...' : 'Sí, cancelar serie'}
              </button>
              <button
                onClick={() => setConfirmCancelSeries(null)}
                className="btn-secondary flex-1"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
