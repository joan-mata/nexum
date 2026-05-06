import { useQuery } from '@tanstack/react-query';
import { formatDate } from '../utils/date';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '../api/dashboard';
import { TRANSACTION_TYPE_LABELS, INFLOW_TYPES } from '../api/transactions';
import type { Transaction } from '../api/transactions';

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function AmountCell({ amount, isInflow }: { amount: number; isInflow: boolean }): JSX.Element {
  return (
    <span className={isInflow ? 'positive' : 'negative'}>
      {isInflow ? '+' : '-'}€{fmt(Math.abs(amount))}
    </span>
  );
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="card">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export function DashboardPage(): JSX.Element {
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.overview().then((r) => r.data),
  });

  const { data: cashflow, isLoading: loadingCashflow } = useQuery({
    queryKey: ['dashboard', 'cashflow'],
    queryFn: () => dashboardApi.cashflow().then((r) => r.data),
  });

  if (loadingOverview || loadingCashflow) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  const kpi = overview?.kpi;
  const recent = overview?.recent_transactions ?? [];
  const upcoming = overview?.upcoming_events ?? [];

  const chartData = (cashflow ?? []).map((m) => ({
    name: m.month,
    Entradas: Number(m.inflows_eur),
    Salidas: Number(m.outflows_eur),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Capital gestionado (EUR)"
          value={`€${fmt(Number(kpi?.total_capital_managed_eur ?? 0))}`}
          sub={`$${fmt(Number(kpi?.total_capital_managed_usd ?? 0))} USD`}
        />
        <KPICard
          label="Retornos recibidos"
          value={`€${fmt(Number(kpi?.total_returns_eur ?? 0))}`}
        />
        <KPICard
          label="Comisiones totales"
          value={`€${fmt(Number(kpi?.total_fees_eur ?? 0))}`}
        />
        <KPICard
          label="Saldo estimado"
          value={`€${fmt(Number(kpi?.balance_eur ?? 0))}`}
        />
      </div>

      {/* Cashflow Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Flujo de caja mensual (últimos 12 meses)</h2>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-12">Sin datos de cashflow aún</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `€${fmt(v)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(value: number) => [`€${fmt(value)}`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="Entradas" fill="#4ade80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Salidas" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Últimas transacciones</h2>
          {recent.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay transacciones aún</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-gray-400 font-medium">Fecha</th>
                    <th className="text-left py-2 text-gray-400 font-medium">Tipo</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((tx: Transaction) => (
                    <tr key={tx.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-2 text-gray-300">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-2 text-gray-300 max-w-[140px] truncate">
                        {TRANSACTION_TYPE_LABELS[tx.type]}
                      </td>
                      <td className="py-2 text-right">
                        <AmountCell
                          amount={Number(tx.amount_in_eur ?? tx.amount)}
                          isInflow={INFLOW_TYPES.includes(tx.type)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            Próximos eventos (30 días)
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay eventos próximos</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-700/40 border border-gray-700"
                >
                  <div className="text-center shrink-0">
                    <p className="text-xs text-gray-400">
                      {formatDate(ev.expected_date, { month: 'short' })}
                    </p>
                    <p className="text-lg font-bold text-gray-100 leading-none">
                      {parseInt(ev.expected_date.slice(8, 10), 10)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">{ev.description}</p>
                    {ev.lender_name && (
                      <p className="text-xs text-gray-400">{ev.lender_name}</p>
                    )}
                    {ev.estimated_amount && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmt(Number(ev.estimated_amount))} {ev.currency}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
