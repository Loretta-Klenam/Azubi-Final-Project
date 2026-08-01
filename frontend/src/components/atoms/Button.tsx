import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-sm',
  secondary: 'border border-violet-300 hover:border-violet-500 hover:bg-violet-50 text-violet-700',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-semibold',
  ghost: 'hover:bg-violet-50 text-violet-700',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...rest }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      disabled={disabled ?? loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...(rest as object)}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  ),
);

Button.displayName = 'Button';
