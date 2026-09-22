'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Play, Camera, X, Mic, Volume2, ChevronDown, ChevronUp, ZoomIn, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react'
import type { BitacoraEntry } from '@/types/bitacora'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDuration = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

// ─── Video Player Modal ───────────────────────────────────────────────────────
function VideoPlayerModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
          aria-label="Cerrar video"
        >
          <X className="w-5 h-5" />
        </button>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={src}
          controls
          autoPlay
          className="w-full max-h-[80vh] bg-black"
          playsInline
        />
      </div>
    </div>,
    document.body
  )
}

// ─── Image Lightbox (navigable) ──────────────────────────────────────────────
function ImageLightbox({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: string[]
  initialIndex?: number
  onClose: () => void
}) {
  const [current, setCurrent] = useState(initialIndex)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setCurrent(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setCurrent(i => Math.min(photos.length - 1, i + 1))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, photos.length])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
          aria-label="Cerrar imagen"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Prev / Next arrows — only when multiple photos */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setCurrent(i => Math.max(0, i - 1))}
              disabled={current === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all disabled:opacity-30"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrent(i => Math.min(photos.length - 1, i + 1))}
              disabled={current === photos.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all disabled:opacity-30"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photos[current]}
          src={photos[current]}
          alt={`Foto ${current + 1} de ${photos.length}`}
          className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
        />

        {/* Counter */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white' : 'bg-white/40'}`}
                aria-label={`Foto ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ─── Single photo with loading/error state ───────────────────────────────────
function LazyPhoto({
  src,
  alt,
  className,
  onClick,
}: {
  src: string
  alt: string
  className?: string
  onClick?: () => void
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  return (
    <div className="relative w-full h-full" onClick={onClick}>
      {/* Skeleton shimmer while loading */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-inherit" />
      )}

      {/* Error placeholder */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-2">
          <ImageOff className="w-7 h-7 text-gray-300" />
          <span className="text-[10px] text-gray-400">Sin preview</span>
        </div>
      )}

      {/* Actual image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        className={`${className ?? ''} transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setStatus('loaded')}
        onError={() => {
          // Retry without crossOrigin in case the server doesn't return CORS headers yet
          setStatus('error')
        }}
      />
    </div>
  )
}

// ─── Video Preview ────────────────────────────────────────────────────────────
function VideoPreview({ note }: { note: BitacoraEntry }) {
  const [showModal, setShowModal] = useState(false)
  const [thumbError, setThumbError] = useState(false)
  const videoSrc = note.video_url!

  const hasThumbnail = !!note.thumbnailUrl && !thumbError

  return (
    <>
      <div
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-900 cursor-pointer group"
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={0}
        aria-label="Reproducir video"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowModal(true) }}
      >
        {/* Thumbnail if available */}
        {hasThumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={note.thumbnailUrl!}
            alt="Miniatura de video"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setThumbError(true)}
          />
        )}

        {/* Placeholder gradient when no thumbnail */}
        {!hasThumbnail && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center gap-2">
            <Camera className="w-8 h-8 text-gray-500" />
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Video</span>
          </div>
        )}

        {/* Dark overlay + Play button */}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/90 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 text-gray-900 ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Duration badge */}
        {note.audio_duration_secs != null && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums">
            {fmtDuration(note.audio_duration_secs)}
          </span>
        )}

        {/* Video label badge */}
        <span className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
          <Camera className="w-2.5 h-2.5" /> VIDEO
        </span>
      </div>

      {showModal && <VideoPlayerModal src={videoSrc} onClose={() => setShowModal(false)} />}
    </>
  )
}

// ─── Photo Preview (single or gallery) ───────────────────────────────────────
function PhotoPreview({ note }: { note: BitacoraEntry }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Determine photo list: grouped album or single
  const photos: string[] = note.groupedPhotos?.length
    ? note.groupedPhotos
    : note.photo_url
      ? [note.photo_url]
      : []

  if (photos.length === 0) return null

  const openLightbox = (idx: number) => setLightboxIndex(idx)
  const closeLightbox = () => setLightboxIndex(null)

  // ── Single photo ──
  if (photos.length === 1) {
    return (
      <>
        <div
          className="relative w-full max-h-64 aspect-video rounded-xl overflow-hidden border border-gray-100 cursor-pointer group"
          role="button"
          tabIndex={0}
          aria-label="Ver imagen ampliada"
          onClick={() => openLightbox(0)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(0) }}
        >
          <LazyPhoto
            src={photos[0]}
            alt="Foto de bitácora"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          {/* Zoom hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-2">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded-lg p-1.5">
              <ZoomIn className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {lightboxIndex !== null && (
          <ImageLightbox photos={photos} initialIndex={lightboxIndex} onClose={closeLightbox} />
        )}
      </>
    )
  }

  // ── Gallery (2–4+ photos) ──
  const visible = photos.slice(0, 4)
  const extra = photos.length - 4

  return (
    <>
      <div
        className={`grid gap-1 rounded-xl overflow-hidden ${
          visible.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
        }`}
        style={{ maxHeight: '256px' }}
      >
        {visible.map((url, idx) => (
          <div
            key={`${url}-${idx}`}
            className="relative cursor-pointer group overflow-hidden"
            style={{ aspectRatio: visible.length <= 2 ? '16/9' : '1/1' }}
            role="button"
            tabIndex={0}
            aria-label={`Ver foto ${idx + 1}`}
            onClick={() => openLightbox(idx)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(idx) }}
          >
            <LazyPhoto
              src={url}
              alt={`Foto ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
            />
            {/* +N overlay on last visible if there are more */}
            {idx === 3 && extra > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-xl font-black">+{extra + 1}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Album badge */}
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          {photos.length} fotos · álbum WA
        </span>
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox photos={photos} initialIndex={lightboxIndex} onClose={closeLightbox} />
      )}
    </>
  )
}

// ─── Audio Preview ────────────────────────────────────────────────────────────
function AudioPreview({ note }: { note: BitacoraEntry }) {
  const [expanded, setExpanded] = useState(false)
  const transcript = note.content || note.transcription
  const hasTranscript = !!transcript && !transcript.startsWith('[')

  return (
    <div className="space-y-2">
      {/* Stylized player */}
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
        <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
          <Volume2 className="w-4 h-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <audio
            src={note.audio_url}
            controls
            preload="none"
            className="w-full h-8"
            style={{ accentColor: '#ef4444' }}
          />
        </div>
        {note.audio_duration_secs != null && (
          <span className="text-[10px] text-gray-400 font-bold tabular-nums shrink-0">
            {fmtDuration(note.audio_duration_secs)}
          </span>
        )}
      </div>

      {/* Transcript */}
      {hasTranscript && (
        <div>
          <p className={`text-sm text-gray-700 leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}
            style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            {transcript}
          </p>
          {(transcript?.length ?? 0) > 150 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 hover:text-gray-600 transition-colors"
            >
              {expanded ? <><ChevronUp className="w-3 h-3" />Ver menos</> : <><ChevronDown className="w-3 h-3" />Ver más</>}
            </button>
          )}
        </div>
      )}
      {!hasTranscript && (
        <p className="text-xs text-gray-400 italic">Sin transcripción disponible</p>
      )}
    </div>
  )
}

// ─── Text Preview ─────────────────────────────────────────────────────────────
function TextPreview({ note }: { note: BitacoraEntry }) {
  const [expanded, setExpanded] = useState(false)
  const text = note.content || note.text
  if (!text || text.startsWith('[')) return null

  return (
    <div>
      <p className={`text-sm text-gray-700 leading-relaxed ${!expanded ? 'line-clamp-4' : ''}`}
        style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
        {text}
      </p>
      {text.length > 200 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 hover:text-gray-600 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" />Ver menos</> : <><ChevronDown className="w-3 h-3" />Ver más</>}
        </button>
      )}
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
// Only show AI actions for IMAGE entries.
// Videos require still photos for Gemini analysis — not yet supported from video frames.
export function BitacoraMediaPreview({ note }: { note: BitacoraEntry }) {
  switch (note.mediaType) {
    case 'video': return <VideoPreview note={note} />
    case 'image': return <PhotoPreview note={note} />
    case 'audio': return <AudioPreview note={note} />
    default:      return <TextPreview note={note} />
  }
}
