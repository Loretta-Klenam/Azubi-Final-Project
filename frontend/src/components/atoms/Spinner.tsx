interface Props {
  className?: string;
}

export function Spinner({ className = 'h-6 w-6' }: Props) {
  return (
    <div
      role="status"
      className={`animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400 ${className}`}
    />
  );
}
