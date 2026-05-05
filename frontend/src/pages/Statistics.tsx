import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { dashboardApi } from '../api/dashboard';
import { lendersApi } from '../api/lenders';
import { transactionsApi } from '../api/transactions';

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const COLORS = ['#818cf8', '#4ade80', '#fb923c', '#f472b6', '#34d399', '#60a5fa', '#a78bfa', '#fbbf24'];

export function StatisticsPage(): JSX.Element {
  const { data: lenders = [] } = useQuery({
    queryKey: ['lenders'],
    queryFn: () => lendersApi.list().then((r) => r.data),
  });

  const { data: cashflow = [] } = useQuery({
    queryKey: ['dashboard', 'cashflow'],
    queryFn: () => dashboardApi.cashflow().then((r) => r.data),
  });

  const { data: currencyBreakdown = [] } = useQuery({
    queryKey: ['dashboard', 'currency-breakdown'],
    queryFn: () => dashboardApi.currencyBreakdown().then((r) => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['transactions', 'summary'],
    queryFn: () => transactionsApi.summary().then((r) => r.data),
  });

  // Pie chart: capital by lender
  const lenderPieData = lenders
    .filter((l) => Number(l.total_loaned_eur) > 0)
    .map((l) => ({
      name: l.name,
      value: Number(l.total_loaned_eur),
    }));

  // Bar chart: fees by month (exchange_fee + transfer_fee + other_expense)
  const feeMonthData = cashflow.map((m) => ({
    name: m.month,
    'Entradas (EUR)': Number(m.inflows_eur),
    'Salidas (EUR)': Number(m.outflows_eur),
  }));

  // EUR vs USD breakdown
  const eurData = currencyBreakdown.filter((i) => i.currency === 'EUR');
  const usdData = currencyBreakdown.filter((i) => i.currency === 'USD');

  // Simplified balance evolution from cashflow
  let runningBalance = 0;
  const balanceEvolution = cashflow.map((m) => {
    runningBalance += Number(m.inflows_eur) - Number(m.outflows_eur);
    return { name: m.month, saldo: runningBalance };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Estadísticas</h1>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Capital total (EUR)</p>
            <p className="text-lg font-bold positive">€{fmt(Number(summary.total_loaned_eur))}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Retornos (EUR)</p>
            <p className="text-lg font-bold positive">€{fmt(Number(summary.total_returned_eur))}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Pagos a prestamistas</p>
            <p className="text-lg font-bold negative">€{fmt(Number(summary.total_payments_eur))}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Comisiones totales</p>
            <p className="text-lg font-bold negative">€{fmt(Number(summary.total_fees_eur))}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pie: Capital by lender */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Capital por prestamista</h2>
          {lenderPieData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={lenderPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: '#6b7280' }}
                >
                  {lenderPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(v: number) => [`€${fmt(v)}`, 'Capital']}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: inflows vs outflows */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Entradas vs Salidas (EUR)</h2>
          {feeMonthData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={feeMonthData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `€${fmt(v)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(v: number) => [`€${fmt(v)}`, '']}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Bar dataKey="Entradas (EUR)" fill="#4ade80" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Salidas (EUR)" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Comparativa EUR vs USD */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Desglose por moneda</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">EUR</h3>
              <div className="space-y-2">
                {eurData.map((item) => (
                  <div key={item.type} className="flex justify-between text-sm">
                    <span className="text-gray-400 truncate max-w-[120px]">{item.type}</span>
                    <span className="text-gray-200 font-medium">€{fmt(Number(item.total_amount))}</span>
                  </div>
                ))}
                {eurData.length === 0 && <p className="text-gray-500 text-xs">Sin datos</p>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">USD</h3>
              <div className="space-y-2">
                {usdData.map((item) => (
                  <div key={item.type} className="flex justify-between text-sm">
                    <span className="text-gray-400 truncate max-w-[120px]">{item.type}</span>
                    <span className="text-gray-200 font-medium">${fmt(Number(item.total_amount))}</span>
                  </div>
                ))}
                {usdData.length === 0 && <p className="text-gray-500 text-xs">Sin datos</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Balance evolution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Evolución del saldo estimado</h2>
          {balanceEvolution.length < 2 ? (
            <p className="text-gray-500 text-sm text-center py-8">Datos insuficientes</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={balanceEvolution} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `€${fmt(v)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(v: number) => [`€${fmt(v)}`, 'Saldo']}
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
