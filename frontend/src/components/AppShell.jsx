import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, LogOut, BanknoteArrowUp, LayoutDashboard, FileText, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AppShell = ({ title, subtitle, children, actions }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-secure-950 text-white">
      <div className="absolute inset-0 bg-grid bg-[size:48px_48px] opacity-[0.06] pointer-events-none" />
      <div className="relative z-10">
        <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-neon-500">
              <ShieldCheck className="h-5 w-5" />
              SecureLend
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <Link className="text-sm text-white/70 transition hover:text-neon-500" to="/dashboard">
                <span className="inline-flex items-center gap-2"><LayoutDashboard className="h-4 w-4" />Dashboard</span>
              </Link>
              <Link className="text-sm text-white/70 transition hover:text-neon-500" to="/apply">
                <span className="inline-flex items-center gap-2"><BanknoteArrowUp className="h-4 w-4" />Apply Loan</span>
              </Link>
              {user?.role === 'admin' ? (
                <Link className="text-sm text-white/70 transition hover:text-neon-500" to="/admin">
                  <span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Admin</span>
                </Link>
              ) : null}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-neon-500/30 bg-neon-500/10 px-4 py-2 text-sm font-medium text-neon-500 transition hover:bg-neon-500/20"
            >
              <LogOut className="h-4 w-4" />Logout
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-neon-500/80">{user?.role || 'user'} workspace</p>
                <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">{subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">{actions}</div>
            </div>
          </motion.div>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
