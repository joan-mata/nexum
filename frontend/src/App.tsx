import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { TransactionsPage } from './pages/Transactions';
import { LendersPage } from './pages/Lenders';
import { LenderDetailPage } from './pages/LenderDetail';
import { CalendarPage } from './pages/Calendar';
import { StatisticsPage } from './pages/Statistics';
import { ThisMonthPage } from './pages/ThisMonth';

import { UsersPage } from './pages/Users';
import { AcceptInvitePage } from './pages/AcceptInvite';
import { ChangePasswordPage } from './pages/ChangePassword';

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/this-month" element={<ThisMonthPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/lenders" element={<LendersPage />} />
                    <Route path="/lenders/:id" element={<LenderDetailPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/statistics" element={<StatisticsPage />} />

                    <Route
                      path="/users"
                      element={
                        <AdminRoute>
                          <UsersPage />
                        </AdminRoute>
                      }
                    />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
