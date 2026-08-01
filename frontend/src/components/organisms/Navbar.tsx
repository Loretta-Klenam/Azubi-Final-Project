import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

export function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-all duration-300 ${isActive ? 'text-violet-700 font-medium' : 'text-slate-600 hover:text-violet-700'}`;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 bg-transparent backdrop-blur-sm transition-all duration-300"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight text-slate-900 transition-colors duration-300 hover:text-violet-700">
          Event<span className="text-violet-700">Flow</span>
        </Link>

        <div className="flex items-center gap-6">
          <NavLink to="/events" className={linkClass}>Events</NavLink>
          <NavLink to="/admin" className={linkClass}>Admin</NavLink>
        </div>
      </div>
    </motion.nav>
  );
}
