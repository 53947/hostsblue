import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  arrowHover?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, arrowHover, children, className = '', disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-6 py-3',
      lg: 'px-8 py-4 text-lg',
    };
    const variants = {
      primary: 'bg-[#1844A6] hover:bg-[#133A8A] text-white shadow-sm',
      secondary: 'border border-[#064A6C] text-[#064A6C] hover:bg-[#064A6C] hover:text-white',
      outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400',
      ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
      danger: 'bg-red-600 hover:bg-red-700 text-white',
    };

    return (
      <button
        ref={ref}
        className={`${base} ${sizes[size]} ${variants[variant]} rounded-[7px] ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {children}
        {arrowHover && <span className="ml-1 transition-transform duration-200 group-hover:translate-x-1">→</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';
