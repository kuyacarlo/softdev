import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout, RequireUser } from './components/Layout';
import { AppProvider } from './context';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOutbox } from './pages/admin/Outbox';
import { AdminPodLabel } from './pages/admin/PodLabel';
import { AdminPods } from './pages/admin/Pods';
import { AdminReports } from './pages/admin/Reports';
import { AdminReservations } from './pages/admin/Reservations';
import { AdminSettings } from './pages/admin/Settings';
import { AdminStaff } from './pages/admin/Staff';
import { CheckInPage } from './pages/CheckIn';
import { FindPod } from './pages/FindPod';
import { KioskPage } from './pages/Kiosk';
import { LoginPage } from './pages/Login';
import { MyReservation } from './pages/MyReservation';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/kiosk" element={<KioskPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<FindPod />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/checkin" element={<CheckInPage />} />
            <Route
              path="/me"
              element={
                <RequireUser kind="student">
                  <MyReservation />
                </RequireUser>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireUser kind="staff">
                  <AdminLayout />
                </RequireUser>
              }
            >
              <Route index element={<AdminReservations />} />
              <Route path="pods" element={<AdminPods />} />
              <Route path="pods/:id/label" element={<AdminPodLabel />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="staff" element={<AdminStaff />} />
              <Route path="outbox" element={<AdminOutbox />} />
            </Route>
            <Route path="*" element={<div className="empty">Page not found.</div>} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
