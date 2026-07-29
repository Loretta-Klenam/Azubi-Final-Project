import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '../atoms/Badge';
import type { Event } from '../../api/events';

interface Props {
  event: Event;
}

function statusVariant(status: Event['status']) {
  if (status === 'active') return 'green';
  if (status === 'full') return 'yellow';
  return 'red';
}

export function EventCard({ event }: Props) {
  const spotsLeft = event.capacity - event.registered;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-slate-700"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <Badge variant={statusVariant(event.status)}>
          {event.status === 'active' ? 'Open' : event.status === 'full' ? 'Full' : 'Cancelled'}
        </Badge>
        <span className="text-xs text-slate-500">{event.date} · {event.time}</span>
      </div>

      <h3 className="text-lg font-semibold text-slate-100">{event.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-400">{event.description}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          <span className="text-slate-300">{event.location}</span>
        </div>
        <div className="text-right text-xs">
          <span className={spotsLeft <= 10 && spotsLeft > 0 ? 'text-yellow-400' : 'text-cyan-400'}>
            {spotsLeft > 0 ? `${spotsLeft} spots left` : 'No spots left'}
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-4">
        <Link
          to={`/events/${event.id}`}
          className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View &amp; Register →
        </Link>
      </div>
    </motion.div>
  );
}
