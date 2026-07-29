import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

export function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors ${isActive ? 'text-cyan-400 font-medium' : 'text-slate-400 hover:text-slate-100'}`;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold text-slate-100 tracking-tight">
          Event<span className="text-cyan-400">Flow</span>
        </Link>

        <div className="flex items-center gap-6">
          <NavLink to="/events" className={linkClass}>Events</NavLink>
          <NavLink to="/admin" className={linkClass}>Admin</NavLink>
        </div>
      </div>
    </motion.nav>
  );
}
