import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '../atoms/Button';

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
  type: 'starter' | 'pro' | 'enterprise';
}

export interface PricingCardsProps extends React.HTMLAttributes<HTMLDivElement> {
  plans: PricingPlan[];
  onSelectPlan?: (planId: string) => void;
}

export function PricingCards({ plans, onSelectPlan, className, ...props }: PricingCardsProps) {
  return (
    <div className={twMerge('grid grid-cols-1 md:grid-cols-3 gap-6', className)} {...props}>
      {plans.map((plan) => (
        <PricingCard 
          key={plan.id} 
          plan={plan} 
          onSelect={() => onSelectPlan?.(plan.id)} 
        />
      ))}
    </div>
  );
}

function PricingCard({ plan, onSelect }: { plan: PricingPlan; onSelect: () => void }) {
  const isStarter = plan.type === 'starter';
  const isPro = plan.type === 'pro';
  const isEnterprise = plan.type === 'enterprise';

  return (
    <div
      className={twMerge(
        'relative flex flex-col p-6 rounded-2xl transition-all',
        isStarter && 'bg-[var(--color-surface-light)] border border-[var(--color-earth-neutral)]',
        isPro && 'bg-[var(--color-surface-light)] border-2 border-[var(--color-brand-primary)] shadow-md',
        isEnterprise && 'bg-[var(--color-brand-dark)] text-[var(--color-surface-light)] border border-[var(--color-brand-dark)]'
      )}
    >
      {plan.recommended && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="bg-[var(--color-brand-vibrant)] text-[var(--color-surface-light)] font-display font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
            Recomendado
          </span>
        </div>
      )}

      <div className="mb-6 text-center mt-2">
        <h3 className={twMerge(
          'text-xl font-display font-bold mb-2',
          isEnterprise ? 'text-[var(--color-surface-light)]' : 'text-[var(--color-text-main)]'
        )}>
          {plan.name}
        </h3>
        <p className={twMerge(
          'text-sm mb-4',
          isEnterprise ? 'text-[var(--color-earth-neutral)]' : 'text-[var(--color-earth-neutral)]'
        )}>
          {plan.description}
        </p>
        <div className="text-3xl font-display font-bold">
          {plan.price}
        </div>
      </div>

      <ul className="flex-1 space-y-3 mb-8">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <svg 
              className={twMerge(
                "w-5 h-5 shrink-0", 
                isEnterprise ? "text-[var(--color-brand-vibrant)]" : "text-[var(--color-brand-primary)]"
              )} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className={isEnterprise ? 'text-[var(--color-surface-light)]' : 'text-[var(--color-text-main)]'}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Button
        variant={isPro || isEnterprise ? 'primary' : 'secondary'}
        className="w-full"
        onClick={onSelect}
      >
        Elegir {plan.name}
      </Button>
    </div>
  );
}
