import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/templates/PageLayout';
import { Button } from '../components/atoms/Button';
import { EventCard } from '../components/molecules/EventCard';
import { Spinner } from '../components/atoms/Spinner';
import { useEvents } from '../api/events';

export function HomePage() {
  const { data: events, isLoading } = useEvents();

  const upcoming = (events ?? [])
    .filter((e) => e.status === 'active')
    .slice(0, 4);

  return (
    <PageLayout>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/60 p-8 shadow-2xl mb-12"
      >
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-400">
          Serverless · AWS · Terraform
        </p>
        <h1 className="text-4xl font-bold leading-tight">
          Register for upcoming events,
          <br />
          <span className="text-cyan-400">instantly.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          Browse events, claim your spot, and receive a ticket code — all powered by AWS Lambda,
          DynamoDB, and React.
        </p>
        <div className="mt-6 flex gap-3">
          <Button as={Link} to="/events">Browse Events</Button>
          <Button variant="secondary" as={Link} to="/admin">Admin Dashboard</Button>
        </div>
      </motion.section>

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Upcoming Events</h2>
          <Link to="/events" className="text-sm text-cyan-400 hover:text-cyan-300">
            View all →
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-10 w-10" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-500">
            No upcoming events. <Link to="/admin" className="text-cyan-400 hover:underline">Create one</Link>.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
