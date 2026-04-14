import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  accentColor?: string;
}

export function Card({
  className,
  padding = 'md',
  accentColor,
  children,
  ...props
}: CardProps) {
  
  const paddings = {
    none: 'p-0',
    sm:   'p-4',
    md:   'p-6',
    lg:   'p-8',
  };

  return (
    <div
      className={twMerge(
        'bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm transition-all',
        paddings[padding],
        className
      )}
      {...props}
    >
      {accentColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-1" 
          style={{ backgroundColor: accentColor }} 
        />
      )}
      <div className="relative h-full">
        {children}
      </div>
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  uppercase?: boolean;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  uppercase = true,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div className={twMerge('mb-5', className)} {...props}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <div className="text-gray-400">{icon}</div>}
        <h3 className={twMerge(
          'text-[10px] font-black text-gray-400',
          uppercase && 'uppercase tracking-widest'
        )}>
          {title}
        </h3>
      </div>
      {subtitle && (
        <p className="text-sm font-bold text-gray-900 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
