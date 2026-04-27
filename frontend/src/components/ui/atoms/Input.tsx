import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  className,
  error,
  leftIcon,
  rightIcon,
  ...props
}: InputProps) {
  return (
    <div className="relative w-full group">
      {leftIcon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-green-600 transition-colors">
          {leftIcon}
        </div>
      )}
      <input
        className={twMerge(
          'w-full bg-gray-50 border border-gray-200 rounded-xl transition-all outline-none text-sm font-bold text-gray-800',
          'px-4 py-3 placeholder:text-gray-300 placeholder:font-normal',
          'focus:ring-2 focus:ring-green-500/10 focus:border-green-500/50 focus:bg-white',
          leftIcon && 'pl-11',
          rightIcon && 'pr-11',
          error && 'border-red-300 focus:ring-red-500/10 focus:border-red-500',
          className
        )}
        {...props}
      />
      {rightIcon && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
          {rightIcon}
        </div>
      )}
    </div>
  );
}
