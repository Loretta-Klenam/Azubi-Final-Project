import { useState } from 'react';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import type { CreateRegistrationInput } from '../../api/registrations';

interface Props {
  onSubmit: (values: CreateRegistrationInput) => void;
  loading?: boolean;
}

type FormState = { name: string; email: string; phone: string };
type Errors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (f.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.email = 'Valid email required';
  return errors;
}

export function RegistrationForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '' });
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
    onSubmit({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Full Name" required value={form.name} onChange={set('name')} error={errors.name} placeholder="Kofi Mensah" />
      <FormField label="Email" required type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="you@example.com" />
      <FormField label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+233 20 000 0000 (optional)" />

      <Button type="submit" loading={loading} className="mt-1">
        Register Now
      </Button>
    </form>
  );
}
