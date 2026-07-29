interface Props {
  children: React.ReactNode;
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'slate';
}

const classes: Record<NonNullable<Props['variant']>, string> = {
  green: 'bg-emerald-900/50 text-emerald-300 border border-emerald-800',
  yellow: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
  red: 'bg-red-900/50 text-red-300 border border-red-800',
  blue: 'bg-cyan-900/50 text-cyan-300 border border-cyan-800',
  slate: 'bg-slate-800 text-slate-300 border border-slate-700',
};

export function Badge({ children, variant = 'slate' }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[variant]}`}>
      {children}
    </span>
  );
}
