import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useApp } from '../context';

export function Layout() {
  const { user, logout, config } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isStaff = user?.kind === 'staff';

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <img src="/favicon.svg" alt="" /> {config.appName}
          </NavLink>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>
              Find a pod
            </NavLink>
            {user?.kind === 'student' && <NavLink to="/me">My reservation</NavLink>}
            {isStaff && <NavLink to="/admin">Admin console</NavLink>}
          </nav>
          <div className="user">
            {user ? (
              <>
                <span className="muted">{user.name}</span>
                <button
                  className="secondary small"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <a className="btn small" href={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

/** Wrap a page that requires a signed-in user of a certain kind. */
export function RequireUser({ kind, children }: { kind: 'student' | 'staff'; children: React.ReactNode }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="card stack" style={{ maxWidth: 480 }}>
        <h1>Please sign in</h1>
        <p className="muted">Use your campus account to continue.</p>
        <a className="btn" href={`/login?returnTo=${returnTo}`}>
          Sign in with campus SSO
        </a>
      </div>
    );
  }
  if (user.kind !== kind) {
    return (
      <div className="alert warn">
        <p>{kind === 'staff' ? 'This area is for library staff only.' : 'This page is for students. Staff can use the admin console.'}</p>
      </div>
    );
  }
  return <>{children}</>;
}
