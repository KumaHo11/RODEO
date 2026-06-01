import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  children,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: ButtonProps) {
  
  const variants = {
    primary:   'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200/50',
    secondary: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    outline:   'border border-gray-200 text-gray-500 hover:bg-gray-50',
    ghost:     'bg-transparent text-gray-400 hover:bg-gray-50',
    danger:    'bg-red-50 text-red-500 hover:bg-red-100',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };

  return (
    <button
      className={twMerge(
        'relative inline-flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        'rounded-xl',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Spinner — absolutely centred, only visible when loading */}
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </span>
      )}
      {/* Content — invisible while loading so button keeps its natural width */}
      <span className={`inline-flex items-center gap-2 ${isLoading ? 'invisible' : ''}`}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </button>
  );
}
