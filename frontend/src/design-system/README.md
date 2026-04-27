# RODEO — Design System

> **Fuente Única de Verdad** visual del producto. Todo estilo, componente y token nace aquí.

---

## Estructura

```
src/design-system/
├── tokens/
│   └── tokens.css          ← CSS Variables (primitivos → semánticos → componente)
│
├── atoms/                  ← Unidades indivisibles
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   └── Toggle.tsx
│
├── molecules/              ← Combinaciones de átomos
│   ├── FormField.tsx       ← Label + Input + Error
│   ├── Tabs.tsx            ← Navegación por pestañas
│   └── Modal.tsx           ← Overlay + Panel + Header + Footer
│
├── organisms/              ← Secciones completas reutilizables
│   ├── Card.tsx            ← Card + CardHeader + CardSection + CardFooter
│   └── EmptyState.tsx      ← Estado vacío estándar
│
└── index.ts                ← Barrel export (punto de entrada único)
```

---

## Cómo importar

```tsx
// ✅ Correcto — siempre desde el alias principal
import { Button, Card, FormField, Badge, Toggle } from '@/design-system'

// ⛔ No hacer — evitar imports directos a subcarpetas
import { Button } from '@/design-system/atoms/Button'
```

---

## Catálogo de componentes

### 🔵 Átomos

#### `Button`
```tsx
<Button variant="primary" size="md" leftIcon={<Plus />} isLoading={false}>
  Nuevo Rebaño
</Button>
```
| Prop | Tipo | Default |
|---|---|---|
| `variant` | `primary \| secondary \| outline \| ghost \| danger` | `primary` |
| `size` | `sm \| md \| lg` | `md` |
| `isLoading` | `boolean` | `false` |
| `leftIcon` | `ReactNode` | — |
| `rightIcon` | `ReactNode` | — |

---

#### `Input`
```tsx
<Input
  leftIcon={<Mail className="w-4 h-4" />}
  placeholder="tu@email.com"
  error={hasError}
/>
```
| Prop | Tipo |
|---|---|
| `error` | `boolean` |
| `leftIcon` | `ReactNode` |
| `rightIcon` | `ReactNode` |

---

#### `Badge`
```tsx
<Badge variant="green" dot>Activo</Badge>
<Badge variant="amber" icon={<Clock />}>Pendiente</Badge>
```
| Prop | Tipo | Default |
|---|---|---|
| `variant` | `gray \| green \| amber \| red \| blue \| violet \| cyan \| orange \| indigo` | `gray` |
| `size` | `xs \| sm` | `xs` |
| `dot` | `boolean` | `false` |
| `uppercase` | `boolean` | `true` |

---

#### `Toggle`
```tsx
<Toggle on={isActive} onChange={() => setIsActive(v => !v)} />
```

---

### 🟡 Moléculas

#### `FormField`
Combina `Label` + `Input` + mensaje de error con `id` automático para accesibilidad:
```tsx
<FormField
  label="Email del invitado *"
  type="email"
  required
  value={email}
  onChange={e => setEmail(e.target.value)}
  errorText={errors.email}
/>
```

---

#### `Tabs`
```tsx
// Variante pill (default)
<Tabs
  items={[
    { id: 'perfil', label: 'Mi perfil' },
    { id: 'billing', label: 'Facturación', count: 2 },
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
/>

// Variante underline
<Tabs variant="underline" items={...} activeTab={...} onChange={...} />
```

---

#### `Modal`
```tsx
<Modal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  title="Nuevo Rebaño"
  subtitle="Datos del lote de animales"
  footer={
    <>
      <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
      <Button onClick={handleSave} isLoading={saving}>Crear Rebaño</Button>
    </>
  }
>
  {/* contenido del form */}
</Modal>
```

---

### 🔶 Organismos

#### `Card`
```tsx
<Card padding="md" accentColor="#16a34a" elevated>
  <CardHeader
    title="Mercado Ganadero"
    icon={<DollarSign />}
    action={<Button size="sm" variant="ghost">Ver más →</Button>}
  />
  <CardSection>
    contenido...
  </CardSection>
  <CardFooter>
    <Button>Acción</Button>
  </CardFooter>
</Card>
```

---

#### `EmptyState`
```tsx
<EmptyState
  emoji="🐄"
  title="No hay rebaños que mostrar"
  description="Creá tu primer rebaño o cambiá los filtros."
  action={<Button onClick={openCreate}>Nuevo Rebaño</Button>}
/>
```

---

## Tokens de Diseño

Los tokens están en `tokens/tokens.css` e importados globalmente desde `globals.css`.

### Escala semántica clave

| Token | Valor |
|---|---|
| `--color-brand` | `#16a34a` (green-600) |
| `--color-bg-base` | `#ffffff` |
| `--color-bg-subtle` | `#f9fafb` (gray-50) |
| `--color-text-main` | `#030712` (gray-950) |
| `--color-text-muted` | `#9ca3af` (gray-400) |
| `--card-radius` | `16px` |
| `--input-radius` | `12px` |
| `--btn-radius` | `12px` |

---

## Convenciones de estilo

| Elemento | Clase |
|---|---|
| Labels de formulario | `text-[10px] font-black text-gray-400 uppercase tracking-widest` |
| Títulos de card/sección | Igual que labels |
| Inputs | `bg-gray-50 border-gray-200 rounded-xl font-bold text-gray-800` |
| Botón primario | `bg-green-600 hover:bg-green-700 rounded-xl font-bold` |
| Botón cancelar | `bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl font-bold` |
| Badges | `text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest` |

---

## Reglas

1. **No crear estilos ad-hoc** para cosas que ya existen como componente.
2. **No repetir colores hex** — usar siempre los tokens CSS o las clases Tailwind estándar del sistema.
3. **No importar desde sub-paths** — usar siempre `from '@/design-system'`.
4. **Nuevos componentes** siguen la nomenclatura Atomic Design y se agregan al barrel.
