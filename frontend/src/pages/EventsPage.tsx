import { useState } from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/templates/PageLayout';
import { EventCard } from '../components/molecules/EventCard';
import { Input } from '../components/atoms/Input';
import { Spinner } from '../components/atoms/Spinner';
import { Badge } from '../components/atoms/Badge';
import { useEvents } from '../api/events';

type StatusFilter = 'all' | 'active' | 'full' | 'cancelled';

export function EventsPage() {
  const { data: events, isLoading, isError } = useEvents();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered = (events ?? []).filter((e) => {
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || e.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <PageLayout>
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold"
        >
          All Events
        </motion.h1>
        <p className="mt-1 text-slate-400">Browse and register for upcoming events.</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by title or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'full', 'cancelled'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-10 w-10" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6 text-red-300">
          Failed to load events. Check your API URL configuration.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-500">
          No events match your search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
