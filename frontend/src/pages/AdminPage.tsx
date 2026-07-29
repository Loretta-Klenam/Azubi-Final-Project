import { useState } from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/templates/PageLayout';
import { EventForm } from '../components/organisms/EventForm';
import { AdminEventTable } from '../components/organisms/AdminEventTable';
import { Button } from '../components/atoms/Button';
import { Spinner } from '../components/atoms/Spinner';
import { Modal } from '../components/molecules/Modal';
import { useEvents, useCreateEvent } from '../api/events';
import { useUIStore } from '../store/uiStore';
import type { CreateEventInput } from '../api/events';

export function AdminPage() {
  const { data: events, isLoading, isError } = useEvents();
  const createEvent = useCreateEvent();
  const showToast = useUIStore((s) => s.showToast);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = (values: CreateEventInput) => {
    createEvent.mutate(values, {
      onSuccess: () => {
        showToast({ message: 'Event created successfully', type: 'success' });
        setShowForm(false);
      },
      onError: (e) => showToast({ message: e.message, type: 'error' }),
    });
  };

  return (
    <PageLayout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold"
          >
            Admin Dashboard
          </motion.h1>
          <p className="mt-1 text-slate-400">Create, edit and manage all events.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ New Event</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-10 w-10" /></div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6 text-red-300">
          Failed to load events. Check your API URL configuration.
        </div>
      ) : (
        <AdminEventTable events={events ?? []} />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create New Event" maxWidth="max-w-2xl">
        <EventForm onSubmit={handleCreate} loading={createEvent.isPending} />
      </Modal>
    </PageLayout>
  );
}
