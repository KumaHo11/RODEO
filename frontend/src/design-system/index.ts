/**
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  RODEO — Design System                                           │
 * │  Punto de entrada único para todos los componentes reutilizables │
 * │                                                                  │
 * │  Uso:                                                            │
 * │  import { Button, Card, FormField, ... } from '@/design-system'  │
 * │                                                                  │
 * │  Estructura (Atomic Design):                                     │
 * │    atoms/      → tokens + componentes base indivisibles          │
 * │    molecules/  → combinaciones de átomos                         │
 * │    organisms/  → secciones completas reutilizables               │
 * └──────────────────────────────────────────────────────────────────┘
 */

// ── ATOMS ────────────────────────────────────────────────────────────
export { Button }        from './atoms/Button';
export type { ButtonProps } from './atoms/Button';

export { Input }         from './atoms/Input';
export type { InputProps } from './atoms/Input';

export { Badge }         from './atoms/Badge';
export type { BadgeProps, BadgeVariant } from './atoms/Badge';

export { Toggle }        from './atoms/Toggle';
export type { ToggleProps } from './atoms/Toggle';

export { Tooltip }       from './atoms/Tooltip';
export type { TooltipProps } from './atoms/Tooltip';

// ── MOLECULES ────────────────────────────────────────────────────────
export { FormField }     from './molecules/FormField';
export type { FormFieldProps } from './molecules/FormField';

export { Tabs }          from './molecules/Tabs';
export type { TabsProps, TabItem } from './molecules/Tabs';

export { Modal }         from './molecules/Modal';
export type { ModalProps } from './molecules/Modal';

// ── ORGANISMS ────────────────────────────────────────────────────────
export { Card, CardHeader, CardSection, CardFooter } from './organisms/Card';
export type { CardProps, CardHeaderProps } from './organisms/Card';

export { EmptyState }    from './organisms/EmptyState';
export type { EmptyStateProps } from './organisms/EmptyState';
