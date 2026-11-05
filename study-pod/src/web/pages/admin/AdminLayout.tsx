import { NavLink, Outlet } from 'react-router';
import { useApp } from '../../context';

export function AdminLayout() {
  const { user } = useApp();
  const isManager = user?.kind === 'staff' && user.role === 'facility_manager';
  return (
    <div>
      <div className="row spread no-print">
        <h1>Admin console</h1>
        <span className="badge">{isManager ? 'Facility Manager' : 'Front Desk'}</span>
      </div>
      <nav className="subnav no-print" aria-label="Admin">
        <NavLink to="/admin" end>
          Reservations
        </NavLink>
        <NavLink to="/admin/pods">Pods</NavLink>
        {isManager && <NavLink to="/admin/reports">Reports</NavLink>}
        <NavLink to="/admin/settings">Settings</NavLink>
        {isManager && <NavLink to="/admin/staff">Staff</NavLink>}
        <NavLink to="/admin/outbox">Email outbox</NavLink>
        <a href="/kiosk">Kiosk mode</a>
      </nav>
      <Outlet />
    </div>
  );
}

export function useIsManager() {
  const { user } = useApp();
  return user?.kind === 'staff' && user.role === 'facility_manager';
}
