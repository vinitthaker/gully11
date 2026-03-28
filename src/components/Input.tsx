import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-label text-on-surface-variant">{label}</label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-2xl bg-surface-dim/50 px-5 py-3.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-on-surface-variant/50 ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
