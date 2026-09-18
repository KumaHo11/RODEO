'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { MessageCircle, Mic, Camera, FileText, CheckCircle, XCircle, Loader2, Shield } from 'lucide-react'

interface InviteData {
  orgName: string
  operatorName: string | null
  waLink: string
  expiresAt: string | null
}

export default function JoinWhatsAppPage() {
  const params = useParams()
  const token  = params.token as string

  const [data,    setData]    = useState<InviteData | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/join-wa/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('No pudimos cargar la invitación. Intentá de nuevo.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Invitación inválida</h1>
          <p className="text-gray-500 text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const greeting = data.operatorName ? `¡Hola, ${data.operatorName.split(' ')[0]}!` : '¡Hola!'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #f0fdf4; }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .float { animation: float 3s ease-in-out infinite; }
        .fade-up { animation: fadeUp 0.5s ease-out forwards; }
        .fade-up-1 { animation-delay: 0.1s; opacity: 0; }
        .fade-up-2 { animation-delay: 0.2s; opacity: 0; }
        .fade-up-3 { animation-delay: 0.3s; opacity: 0; }
        .fade-up-4 { animation-delay: 0.4s; opacity: 0; }
        .btn-wa { background: #25D366; transition: all 0.2s; box-shadow: 0 8px 30px rgba(37,211,102,0.35); }
        .btn-wa:hover { background: #1ebe5d; transform: translateY(-2px); box-shadow: 0 12px 40px rgba(37,211,102,0.45); }
        .btn-wa:active { transform: translateY(0); }
        .card-permission { background: white; border-radius: 16px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #ecfdf5 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

        {/* Logo flotante */}
        <div className="float fade-up fade-up-1" style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #16a34a, #22c55e)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 8px 24px rgba(34,197,94,0.3)' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 28L20 8L32 28H8Z" fill="white" opacity="0.9"/>
              <circle cx="20" cy="22" r="6" fill="white"/>
            </svg>
          </div>
          <p style={{ fontSize: '13px', fontWeight: '800', color: '#16a34a', letterSpacing: '0.15em', textTransform: 'uppercase' }}>RODEO</p>
        </div>

        {/* Card principal */}
        <div className="fade-up fade-up-2" style={{ background: 'white', borderRadius: '28px', padding: '32px 28px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', textAlign: 'center' }}>

          {/* Encabezado */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '15px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>{greeting}</p>
            <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#111827', lineHeight: '1.2', margin: '0 0 10px' }}>
              Fuiste invitado a<br />
              <span style={{ color: '#16a34a' }}>{data.orgName}</span>
            </h1>
            <p style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '500', margin: 0 }}>
              Vinculá tu WhatsApp al campo en un toque
            </p>
          </div>

          {/* Permisos — qué puede hacer */}
          <div className="fade-up fade-up-3" style={{ marginBottom: '28px', textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Vas a poder enviar</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="card-permission">
                <div style={{ width: '36px', height: '36px', background: '#f0fdf4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mic style={{ width: '16px', height: '16px', color: '#16a34a' }} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#111827', margin: 0 }}>Audios</p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Notas de voz al campo</p>
                </div>
                <CheckCircle style={{ width: '16px', height: '16px', color: '#22c55e', marginLeft: 'auto', flexShrink: 0 }} />
              </div>
              <div className="card-permission">
                <div style={{ width: '36px', height: '36px', background: '#f0fdf4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Camera style={{ width: '16px', height: '16px', color: '#16a34a' }} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#111827', margin: 0 }}>Fotos</p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Imágenes desde el campo</p>
                </div>
                <CheckCircle style={{ width: '16px', height: '16px', color: '#22c55e', marginLeft: 'auto', flexShrink: 0 }} />
              </div>
              <div className="card-permission">
                <div style={{ width: '36px', height: '36px', background: '#f0fdf4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText style={{ width: '16px', height: '16px', color: '#16a34a' }} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#111827', margin: 0 }}>Mensajes de texto</p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Novedades escritas</p>
                </div>
                <CheckCircle style={{ width: '16px', height: '16px', color: '#22c55e', marginLeft: 'auto', flexShrink: 0 }} />
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="fade-up fade-up-4">
            <a
              href={data.waLink}
              className="btn-wa"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px 24px', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '16px', textDecoration: 'none', width: '100%' }}
            >
              <MessageCircle style={{ width: '20px', height: '20px' }} />
              Conectar mi WhatsApp
            </a>
            <p style={{ fontSize: '11px', color: '#d1d5db', marginTop: '12px', lineHeight: '1.5' }}>
              Al tocar el botón se abrirá WhatsApp con un mensaje de activación. Solo tenés que enviarlo.
            </p>
          </div>
        </div>

        {/* Footer seguridad */}
        <div className="fade-up fade-up-4" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.6 }}>
          <Shield style={{ width: '12px', height: '12px', color: '#6b7280' }} />
          <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, fontWeight: '500' }}>
            Acceso solo a Bitácora WhatsApp · RODEO AgTech
          </p>
        </div>
      </div>
    </>
  )
}
