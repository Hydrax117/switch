'use client'

/**
 * Camera-based QR scanner using html5-qrcode.
 * Fires onScan(qrCode) once per successful decode, then pauses
 * until the parent resets it (via the `scanning` prop).
 */

import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QrScannerProps {
  onScan: (qrCode: string) => void
  scanning: boolean // parent controls resume/pause
}

const SCANNER_ID = 'switch-qr-scanner'

export function QrScanner({ onScan, scanning }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const activeRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (!activeRef.current) return
          activeRef.current = false
          onScan(decodedText)
        },
        undefined // ignore per-frame errors
      )
      .catch(console.error)

    return () => {
      scanner.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resume scanning when parent sets scanning=true
  useEffect(() => {
    if (scanning) {
      activeRef.current = true
    }
  }, [scanning])

  return (
    <div className="overflow-hidden rounded-2xl">
      <div id={SCANNER_ID} className="w-full" />
    </div>
  )
}
