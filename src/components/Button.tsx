import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const variants = {
  primary: 'sunset-gradient font-semibold shadow-lg shadow-primary/20',
  secondary: 'bg-white card-shadow text-on-surface font-semibold',
  ghost: 'text-primary font-semibold',
};

export function Button({
  variant = 'primary',
  children,
  fullWidth = false,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-full px-6 py-3.5 text-base transition-all min-h-[52px] active:scale-[0.98] flex items-center justify-center gap-2 ${variants[variant]} ${fullWidth ? 'w-full' : ''} disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
