'use client'

import RodeoLogo from '@/components/RodeoLogo'

export default function LogoPreviewPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f4f6', padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 32 }}>
        Preview Isologotipo RODEO — fondo transparente
      </h1>

      {/* ── 1. Variante LIGHT sobre blanco puro ── */}
      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 12 }}>
          Variante LIGHT — sobre blanco (landing, login claro, header)
        </p>
        <div style={{ background: '#ffffff', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', gap: 28, alignItems: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div>
            <p style={{ fontSize: 9, color: '#9ca3af', marginBottom: 8 }}>login / registro — size=&quot;xl&quot; (+50%)</p>
            <RodeoLogo variant="light" size="xl" showTagline={true} />
          </div>
          <div>
            <p style={{ fontSize: 9, color: '#9ca3af', marginBottom: 8 }}>header principal — size=&quot;md&quot; (+20%)</p>
            <RodeoLogo variant="light" size="md" showTagline={false} />
          </div>
          <div>
            <p style={{ fontSize: 9, color: '#9ca3af', marginBottom: 8 }}>sidebar expandido — size=&quot;sm&quot;</p>
            <RodeoLogo variant="light" size="sm" showTagline={false} />
          </div>
          <div>
            <p style={{ fontSize: 9, color: '#9ca3af', marginBottom: 8 }}>solo ícono (favicon / colapsado)</p>
            <RodeoLogo variant="light" size="lg" iconOnly={true} />
          </div>
        </div>
      </section>

      {/* ── 2. Variante DARK sobre verde oscuro ── */}
      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 12 }}>
          Variante DARK — sobre verde oscuro (sidebar, login hero, dark header)
        </p>
        <div style={{ background: '#1b4332', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', gap: 28, alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 9, color: '#4ade80', marginBottom: 8 }}>login héroe — size=&quot;xl&quot; (+50%)</p>
            <RodeoLogo variant="dark" size="xl" showTagline={true} />
          </div>
          <div>
            <p style={{ fontSize: 9, color: '#4ade80', marginBottom: 8 }}>sidebar header — size=&quot;md&quot; (+20%)</p>
            <RodeoLogo variant="dark" size="md" showTagline={false} />
          </div>
          <div>
            <p style={{ fontSize: 9, color: '#4ade80', marginBottom: 8 }}>sidebar compacto — size=&quot;sm&quot;</p>
            <RodeoLogo variant="dark" size="sm" showTagline={false} />
          </div>
          <div>
            <p style={{ fontSize: 9, color: '#4ade80', marginBottom: 8 }}>solo ícono blanco — size=&quot;lg&quot; iconOnly</p>
            <RodeoLogo variant="dark" size="lg" iconOnly={true} />
          </div>
        </div>
      </section>

      {/* ── 3. Simulación Login ── */}
      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 12 }}>
          Simulación Login / Registro
        </p>
        <div style={{ background: '#fff', borderRadius: 24, padding: '56px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)', maxWidth: 420 }}>
          <RodeoLogo variant="light" size="xl" showTagline={true} />
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Ingresá a tu cuenta</p>
          <div style={{ width: '100%', height: 42, background: '#f3f4f6', borderRadius: 12, marginTop: 8 }} />
          <div style={{ width: '100%', height: 42, background: '#f3f4f6', borderRadius: 12 }} />
          <div style={{ width: '100%', height: 42, background: '#14532d', borderRadius: 12 }} />
        </div>
      </section>

      {/* ── 4. Simulación Sidebar oscuro ── */}
      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 12 }}>
          Simulación Sidebar
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ background: '#1b4332', borderRadius: 20, padding: '20px 16px', width: 220, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <RodeoLogo variant="dark" size="sm" showTagline={false} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['Panel', 'Mi Campo', 'Rebaños', 'Planificador', 'Bitácora'].map(n => (
                <div key={n} style={{ padding: '8px 12px', borderRadius: 10, color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600 }}>{n}</div>
              ))}
            </div>
          </div>
          <div style={{ background: '#1b4332', borderRadius: 20, padding: '20px 12px', width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <RodeoLogo variant="dark" size="xs" iconOnly={true} />
          </div>
        </div>
      </section>
    </div>
  )
}
