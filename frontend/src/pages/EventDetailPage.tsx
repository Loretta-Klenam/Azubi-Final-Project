import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/templates/PageLayout';
import { RegistrationForm } from '../components/organisms/RegistrationForm';
import { Badge } from '../components/atoms/Badge';
import { Spinner } from '../components/atoms/Spinner';
import { Modal } from '../components/molecules/Modal';
import { useEvent } from '../api/events';
import { useRegisterForEvent } from '../api/registrations';
import { useUIStore } from '../store/uiStore';
import type { CreateRegistrationInput } from '../api/registrations';

function statusVariant(s: 'active' | 'cancelled' | 'full') {
  if (s === 'active') return 'green';
  if (s === 'full') return 'yellow';
  return 'red';
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: event, isLoading, isError } = useEvent(id!);
  const register = useRegisterForEvent(id!);
  const showToast = useUIStore((s) => s.showToast);
  const [modalOpen, setModalOpen] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);

  const handleRegister = (values: CreateRegistrationInput) => {
    register.mutate(values, {
      onSuccess: (reg) => {
        setModalOpen(false);
        setTicket(reg.ticketCode);
        showToast({ message: 'Registration confirmed!', type: 'success' });
      },
      onError: (e) => {
        showToast({ message: e.message, type: 'error' });
      },
    });
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center py-20"><Spinner className="h-10 w-10" /></div>
      </PageLayout>
    );
  }

  if (isError || !event) {
    return (
      <PageLayout>
        <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6 text-red-300">
          Event not found. <Link to="/events" className="underline">Back to events</Link>
        </div>
      </PageLayout>
    );
  }

  const spotsLeft = event.capacity - event.registered;
  const canRegister = event.status === 'active' && spotsLeft > 0;

  return (
    <PageLayout>
      <Link to="/events" className="mb-6 inline-block text-sm text-slate-400 hover:text-slate-100">
        ← Back to events
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-8 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <Badge variant={statusVariant(event.status)}>
              {event.status === 'active' ? 'Open' : event.status === 'full' ? 'Full' : 'Cancelled'}
            </Badge>
          </div>

          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="mt-4 text-slate-300 leading-relaxed">{event.description}</p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Date', value: event.date },
              { label: 'Time', value: event.time },
              { label: 'Location', value: event.location },
              { label: 'Organizer', value: `${event.organizerName} (${event.organizerEmail})` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="mt-1 font-medium text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4">
              <p className="text-3xl font-bold text-cyan-400">{spotsLeft}</p>
              <p className="text-sm text-slate-400">spots remaining of {event.capacity}</p>
            </div>

            <div className="mb-6 h-2 rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-cyan-500 transition-all"
                style={{ width: `${Math.min((event.registered / event.capacity) * 100, 100)}%` }}
              />
            </div>

            {ticket ? (
              <div className="rounded-xl border border-emerald-700 bg-emerald-900/30 p-4 text-center">
                <p className="text-xs text-emerald-400 uppercase tracking-wider">Your Ticket</p>
                <p className="mt-2 text-2xl font-mono font-bold text-emerald-300">{ticket}</p>
              </div>
            ) : (
              <button
                onClick={() => setModalOpen(true)}
                disabled={!canRegister}
                className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canRegister ? 'Register Now' : event.status === 'cancelled' ? 'Event Cancelled' : 'Sold Out'}
              </button>
            )}
          </div>
        </aside>
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Register for Event">
        <RegistrationForm onSubmit={handleRegister} loading={register.isPending} />
      </Modal>
    </PageLayout>
  );
}
