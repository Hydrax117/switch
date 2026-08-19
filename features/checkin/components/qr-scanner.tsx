'use client'

/**
 * Universal QR scanner — works on Chrome, Firefox, Safari, Android, iOS.
 * Uses @zxing/browser which decodes via a <canvas> software loop,
 * with no dependency on BarcodeDetector or any native browser API.
 *
 * Strategy:
 *  1. Try the rear camera (environment) first.
 *  2. On permission denied / no camera, fall back to a manual text input.
 *  3. The "Manual entry" button is always visible so staff can type a code.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser'
import { Camera, CameraOff, Keyboard, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QrScannerProps {
  /** Called with the raw QR string on each successful scan. */
  onScan: (qrCode: string) => void
  /**
   * When true the scanner is accepting the next code.
   * Parent sets this to false while processing, then back to true to re-arm.
   */
  scanning: boolean
}

type CameraState = 'requesting' | 'active' | 'denied' | 'no-camera'

export function QrScanner({ onScan, scanning }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onScanRef = useRef(onScan)
  const scanningRef = useRef(scanning)
  const [cameraState, setCameraState] = useState<CameraState>('requesting')
  const [manualMode, setManualMode] = useState(false)
  const [manualValue, setManualValue] = useState('')

  // Keep refs in sync with latest props without restarting the camera
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { scanningRef.current = scanning }, [scanning])

  const startCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    setCameraState('requesting')

    try {
      const reader = new BrowserQRCodeReader()

      // Pick the rear camera if available
      const devices = await BrowserQRCodeReader.listVideoInputDevices()
      const rearDevice = devices.find((d) =>
        /back|rear|environment/i.test(d.label)
      )
      const deviceId = rearDevice?.deviceId ?? devices[0]?.deviceId

      const controls = await reader.decodeFromVideoDevice(
        deviceId,        // undefined = browser default (usually front on desktop)
        video,
        (result, err) => {
          // result is null on frames with no QR — ignore those
          if (!result) return
          if (!scanningRef.current) return

          // Disarm immediately to prevent double-fires
          scanningRef.current = false
          onScanRef.current(result.getText())
        }
      )

      controlsRef.current = controls
      setCameraState('active')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[QrScanner] camera error:', message)

      if (
        message.includes('Permission') ||
        message.includes('NotAllowed') ||
        message.includes('denied')
      ) {
        setCameraState('denied')
      } else {
        // No camera, HTTPS required, or other error
        setCameraState('no-camera')
        setManualMode(true)
      }
    }
  }, [])

  useEffect(() => {
    startCamera()

    return () => {
      controlsRef.current?.stop()
    }
  }, [startCamera])

  // ── Manual entry ─────────────────────────────────────────────────────────

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = manualValue.trim()
    if (!val || !scanningRef.current) return
    scanningRef.current = false
    onScanRef.current(val)
    setManualValue('')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Camera viewport — always rendered so the video ref is available */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl bg-black',
          manualMode && 'hidden'
        )}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-[300px] w-full object-cover sm:h-[360px]"
          aria-label="Camera feed for QR scanning"
        />

        {/* Requesting permission */}
        {cameraState === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <Camera className="h-8 w-8 animate-pulse text-white" />
            <p className="text-[13px] text-white/80">Starting camera…</p>
            <p className="text-[11.5px] text-white/50">Allow camera access when prompted</p>
          </div>
        )}

        {/* Denied overlay */}
        {cameraState === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
            <CameraOff className="h-8 w-8 text-red-400" />
            <p className="text-[14px] font-semibold text-white">Camera access denied</p>
            <p className="text-[12px] text-white/60">
              Allow camera access in your browser settings, then tap retry.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => startCamera()}
                className="rounded-lg bg-white/10 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-white/20"
              >
                Retry
              </button>
              <button
                onClick={() => setManualMode(true)}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-white/20"
              >
                <Keyboard className="h-3.5 w-3.5" />
                Manual entry
              </button>
            </div>
          </div>
        )}

        {/* Aim guide — shown when actively scanning */}
        {cameraState === 'active' && scanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* Dark vignette with a clear window */}
            <div className="h-56 w-56 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
        )}

        {/* Manual entry toggle */}
        {cameraState === 'active' && (
          <button
            onClick={() => setManualMode(true)}
            className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1.5 text-[11.5px] font-medium text-white backdrop-blur-sm hover:bg-black/70"
          >
            <Keyboard className="h-3 w-3" />
            Manual entry
          </button>
        )}
      </div>

      {/* Manual entry panel */}
      {manualMode && (
        <div className="border-border bg-surface rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Enter QR code manually</p>
            {cameraState === 'active' && (
              <button
                onClick={() => { setManualMode(false); setManualValue('') }}
                aria-label="Back to camera"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {cameraState === 'no-camera' && (
            <p className="text-[12px] text-amber-400">
              No camera detected. Paste the QR code value from another device.
            </p>
          )}

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Paste or type QR code value…"
              autoFocus
              className={cn(
                'border-border bg-background flex-1 rounded-xl border px-3.5 py-2.5 text-[13.5px] outline-none',
                'focus:border-brand-500 focus:ring-brand-500/20 transition-colors focus:ring-2'
              )}
            />
            <button
              type="submit"
              disabled={!manualValue.trim()}
              className="from-brand-600 rounded-xl bg-gradient-to-r to-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Check
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
