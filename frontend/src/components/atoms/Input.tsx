import { type InputHTMLAttributes, forwardRef } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ error, className = '', ...rest }, ref) => (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        className={`w-full rounded-xl border bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
          error ? 'border-red-500' : 'border-slate-700 hover:border-slate-500'
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  ),
);

Input.displayName = 'Input';
