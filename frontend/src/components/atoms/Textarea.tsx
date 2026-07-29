import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ error, className = '', ...rest }, ref) => (
    <div className="flex flex-col gap-1">
      <textarea
        ref={ref}
        rows={4}
        className={`w-full rounded-xl border bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none ${
          error ? 'border-red-500' : 'border-slate-700 hover:border-slate-500'
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  ),
);

Textarea.displayName = 'Textarea';
