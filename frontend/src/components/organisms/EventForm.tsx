import { useState } from 'react';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import type { CreateEventInput, Event } from '../../api/events';

interface Props {
  initialValues?: Partial<CreateEventInput>;
  onSubmit: (values: CreateEventInput) => void;
  loading?: boolean;
  submitLabel?: string;
}

type FormState = {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  capacity: string;
  organizerName: string;
  organizerEmail: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (f.title.trim().length < 3) errors.title = 'Title must be at least 3 characters';
  if (f.description.trim().length < 10) errors.description = 'Description must be at least 10 characters';
  if (!f.date) errors.date = 'Date is required';
  if (!f.time) errors.time = 'Time is required';
  if (f.location.trim().length < 3) errors.location = 'Location is required';
  const cap = Number(f.capacity);
  if (!Number.isInteger(cap) || cap < 1) errors.capacity = 'Capacity must be a positive integer';
  if (f.organizerName.trim().length < 2) errors.organizerName = 'Organizer name is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.organizerEmail)) errors.organizerEmail = 'Valid email required';
  return errors;
}

export function EventForm({ initialValues, onSubmit, loading, submitLabel = 'Create Event' }: Props) {
  const [form, setForm] = useState<FormState>({
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    date: initialValues?.date ?? '',
    time: initialValues?.time ?? '',
    location: initialValues?.location ?? '',
    capacity: String(initialValues?.capacity ?? ''),
    organizerName: initialValues?.organizerName ?? '',
    organizerEmail: initialValues?.organizerEmail ?? '',
  });

  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit({ ...form, capacity: Number(form.capacity) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Event Title" required value={form.title} onChange={set('title')} error={errors.title} placeholder="e.g. Tech Summit 2026" />
        <FormField label="Date" required type="date" value={form.date} onChange={set('date')} error={errors.date} />
        <FormField label="Location" required value={form.location} onChange={set('location')} error={errors.location} placeholder="City, Country" />
        <FormField label="Time" required type="time" value={form.time} onChange={set('time')} error={errors.time} />
        <FormField label="Capacity" required type="number" value={form.capacity} onChange={set('capacity')} error={errors.capacity} placeholder="100" />
        <FormField label="Organizer Name" required value={form.organizerName} onChange={set('organizerName')} error={errors.organizerName} />
      </div>

      <FormField label="Organizer Email" required type="email" value={form.organizerEmail} onChange={set('organizerEmail')} error={errors.organizerEmail} placeholder="organizer@example.com" />

      <FormField
        label="Description"
        required
        textarea
        value={form.description}
        onChange={set('description')}
        error={errors.description}
        placeholder="Describe the event…"
      />

      <Button type="submit" loading={loading} className="self-end">
        {submitLabel}
      </Button>
    </form>
  );
}
