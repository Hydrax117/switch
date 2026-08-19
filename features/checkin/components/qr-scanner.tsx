'use client'

/**
 * Camera-based QR scanner using html5-qrcode.
 * Fires onScan(qrCode) exactly once per successful decode, then pauses
 * until the parent re-enables it by flipping scanning → false → true.
 */

import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QrScannerProps {
  onScan: (qrCode: string) => void
  /** When true the scanner will fire onScan on the next decoded frame.
   *  Parent sets this to false after a scan is received, then back to true
   *  when ready for the next one. */
  scanning: boolean
}

const SCANNER_ID = 'switch-qr-scanner'

export function QrScanner({ onScan, scanning }: QrScannerProps) {
  // Keep a stable ref to the latest onScan callback so the camera
  // effect never needs to re-run (which would restart the camera).
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  })

  // Armed = ready to fire. Start armed so the very first scan works.
  const armedRef = useRef(true)

  // Sync armed state with the scanning prop.
  // When parent flips scanning back to true we re-arm.
  useEffect(() => {
    if (scanning) {
      armedRef.current = true
    }
  }, [scanning])

  // Start the camera once on mount, stop on unmount.
  useEffect(() => {
    // html5-qrcode requires the element to already exist in the DOM
    const scanner = new Html5Qrcode(SCANNER_ID)

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Only fire if we're armed — prevents double-fires on the same code
          if (!armedRef.current) return
          armedRef.current = false          // disarm until parent re-arms
          onScanRef.current(decodedText)    // call the latest callback
        },
        undefined // suppress per-frame "no QR code" errors
      )
      .catch((err) => {
        // Camera permission denied or not available
        console.error('[QrScanner] failed to start camera:', err)
      })

    return () => {
      scanner.stop().catch(() => {})
    }
    // Intentionally empty deps — camera only mounts/unmounts once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overflow-hidden rounded-2xl">
      {/* html5-qrcode mounts the <video> element inside this div */}
      <div id={SCANNER_ID} className="w-full" />
    </div>
  )
}
