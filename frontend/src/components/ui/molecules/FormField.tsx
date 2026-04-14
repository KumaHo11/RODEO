import { Input } from '@/design-system/atoms/Input';
import { twMerge } from 'tailwind-merge';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function FormField({
  label,
  errorText,
  className,
  ...props
}: FormFieldProps) {
  return (
    <div className={twMerge('space-y-1.5 w-full', className)}>
      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
        {label}
      </label>
      <Input
        error={!!errorText}
        {...props}
      />
      {errorText && (
        <p className="text-[10px] font-bold text-red-500 px-1 animate-in fade-in slide-in-from-top-1">
          {errorText}
        </p>
      )}
    </div>
  );
}
