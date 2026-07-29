import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Modal } from '../molecules/Modal';
import { EventForm } from './EventForm';
import type { Event, CreateEventInput } from '../../api/events';
import { useUpdateEvent, useDeleteEvent } from '../../api/events';
import { useUIStore } from '../../store/uiStore';

interface Props {
  events: Event[];
}

function statusVariant(s: Event['status']) {
  if (s === 'active') return 'green';
  if (s === 'full') return 'yellow';
  return 'red';
}

export function AdminEventTable({ events }: Props) {
  const [editing, setEditing] = useState<Event | null>(null);
  const update = useUpdateEvent();
  const remove = useDeleteEvent();
  const showToast = useUIStore((s) => s.showToast);

  const handleUpdate = (values: CreateEventInput) => {
    if (!editing) return;
    update.mutate(
      { id: editing.id, ...values },
      {
        onSuccess: () => {
          showToast({ message: 'Event updated', type: 'success' });
          setEditing(null);
        },
        onError: (e) => showToast({ message: e.message, type: 'error' }),
      },
    );
  };

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    remove.mutate(id, {
      onSuccess: () => showToast({ message: 'Event deleted', type: 'success' }),
      onError: (e) => showToast({ message: e.message, type: 'error' }),
    });
  };

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-500">
        No events yet. Create one above.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              {['Title', 'Date', 'Location', 'Registered', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {events.map((ev) => (
              <tr key={ev.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-100">
                  <Link to={`/events/${ev.id}`} className="hover:text-cyan-400 transition-colors">
                    {ev.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-400">{ev.date}</td>
                <td className="px-4 py-3 text-slate-400">{ev.location}</td>
                <td className="px-4 py-3 text-slate-300">
                  {ev.registered} / {ev.capacity}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(ev.status)}>
                    {ev.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(ev)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={remove.isPending}
                      onClick={() => handleDelete(ev.id, ev.title)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Event"
        maxWidth="max-w-2xl"
      >
        {editing && (
          <EventForm
            initialValues={editing}
            onSubmit={handleUpdate}
            loading={update.isPending}
            submitLabel="Save Changes"
          />
        )}
      </Modal>
    </>
  );
}
