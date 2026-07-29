import type { ReactNode } from 'react';
import { Input } from '../atoms/Input';
import { Textarea } from '../atoms/Textarea';

interface BaseProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

interface InputProps extends BaseProps {
  type?: 'text' | 'email' | 'number' | 'date' | 'time' | 'tel';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: false;
}

interface TextareaProps extends BaseProps {
  type?: never;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea: true;
}

type Props = InputProps | TextareaProps;

export function FormField({ label, error, required, hint, ...rest }: Props): ReactNode {
  const id = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>

      {(rest as { textarea?: boolean }).textarea ? (
        <Textarea
          id={id}
          value={String(rest.value)}
          placeholder={(rest as { placeholder?: string }).placeholder}
          onChange={(e) => rest.onChange(e.target.value)}
          error={error}
        />
      ) : (
        <Input
          id={id}
          type={(rest as InputProps).type ?? 'text'}
          value={(rest as InputProps).value}
          placeholder={(rest as InputProps).placeholder}
          onChange={(e) => rest.onChange(e.target.value)}
          error={error}
        />
      )}

      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
