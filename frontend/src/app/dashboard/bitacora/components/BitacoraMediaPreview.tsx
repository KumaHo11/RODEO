'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Play, Camera, X, Mic, Volume2, ChevronDown, ChevronUp, ZoomIn } from 'lucide-react'
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
        {/* Close button */}
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

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
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
      <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
          aria-label="Cerrar imagen"
        >
          <X className="w-5 h-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Vista ampliada"
          className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
        />
      </div>
    </div>,
    document.body
  )
}

// ─── Video Preview ────────────────────────────────────────────────────────────
function VideoPreview({ note }: { note: BitacoraEntry }) {
  const [showModal, setShowModal] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoSrc = note.video_url!

  return (
    <>
      <div
        className="relative w-full max-h-64 aspect-video rounded-xl overflow-hidden bg-black/5 cursor-pointer group"
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={0}
        aria-label="Reproducir video"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowModal(true) }}
      >
        {note.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={note.thumbnailUrl}
            alt="Miniatura de video"
            className="w-full h-full object-cover"
          />
        ) : (
          /* Native video poster — browser grabs first frame */
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={videoSrc}
            preload="metadata"
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        )}

        {/* Dark overlay + Play button */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors flex items-center justify-center">
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

        {/* Camera icon fallback if no thumbnail */}
        {!note.thumbnailUrl && (
          <div className="absolute top-2 left-2">
            <Camera className="w-4 h-4 text-white/60" />
          </div>
        )}
      </div>

      {showModal && <VideoPlayerModal src={videoSrc} onClose={() => setShowModal(false)} />}
    </>
  )
}

// ─── Photo Preview ────────────────────────────────────────────────────────────
function PhotoPreview({ note }: { note: BitacoraEntry }) {
  const [showLightbox, setShowLightbox] = useState(false)
  const src = note.photo_url!

  return (
    <>
      <div
        className="relative w-full max-h-64 aspect-video rounded-xl overflow-hidden border border-gray-100 cursor-pointer group"
        onClick={() => setShowLightbox(true)}
        role="button"
        tabIndex={0}
        aria-label="Ver imagen ampliada"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowLightbox(true) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Foto de bitácora"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading="lazy"
        />
        {/* Zoom hint */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-2">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded-lg p-1.5">
            <ZoomIn className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {showLightbox && <ImageLightbox src={src} onClose={() => setShowLightbox(false)} />}
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
export function BitacoraMediaPreview({ note }: { note: BitacoraEntry }) {
  switch (note.mediaType) {
    case 'video': return <VideoPreview note={note} />
    case 'image': return <PhotoPreview note={note} />
    case 'audio': return <AudioPreview note={note} />
    default:      return <TextPreview note={note} />
  }
}
