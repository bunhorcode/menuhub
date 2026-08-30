"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
}: BarcodeScannerModalProps) {
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [supportsTorch, setSupportsTorch] = useState(false)
  const [detectedCode, setDetectedCode] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState("")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Audio feedback on scan
  const playScanBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(1200, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.12)
    } catch {
      // AudioContext might be blocked, ignore safely
    }
  }

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }, [])

  // Start camera and continuous detection
  const startCamera = useCallback(async () => {
    setErrorMessage(null)
    setDetectedCode(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false)
      setErrorMessage("Camera access is not supported by your browser.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      setHasCamera(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsScanning(true)

        // Check torch support
        const track = stream.getVideoTracks()[0]
        const capabilities = track.getCapabilities ? (track.getCapabilities() as { torch?: boolean }) : {}
        if (capabilities.torch) {
          setSupportsTorch(true)
        }

        // Initialize BarcodeDetector if available
        let detector: unknown = null
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
            detector = new BarcodeDetectorClass({
              formats: [
                "code_128",
                "code_39",
                "code_93",
                "ean_13",
                "ean_8",
                "upc_a",
                "upc_e",
                "qr_code",
                "data_matrix",
                "itf",
                "codabar",
              ],
            })
          } catch (e) {
            console.warn("BarcodeDetector init warning:", e)
          }
        }

        // Detection loop
        const scanFrame = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animationFrameRef.current = requestAnimationFrame(scanFrame)
            return
          }

          if (detector) {
            try {
              const barcodes = await (detector as { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> }).detect(videoRef.current)
              if (barcodes && barcodes.length > 0) {
                const code = barcodes[0].rawValue
                if (code) {
                  playScanBeep()
                  setDetectedCode(code)
                  stopCamera()
                  setTimeout(() => {
                    onScan(code)
                    onClose()
                  }, 400)
                  return
                }
              }
            } catch {
              // frame skip, continue scanning
            }
          }

          animationFrameRef.current = requestAnimationFrame(scanFrame)
        }

        animationFrameRef.current = requestAnimationFrame(scanFrame)
      }
    } catch (err: unknown) {
      console.error("Camera access error:", err)
      setHasCamera(false)
      const errName = (err as Error)?.name || ""
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setErrorMessage("Camera permission denied. Please allow camera access in your browser.")
      } else {
        setErrorMessage("Could not start camera. You can type or upload an image of the barcode.")
      }
    }
  }, [onClose, onScan, stopCamera])

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return
    try {
      const newTorchState = !torchOn
      await (track as MediaStreamTrack & { applyConstraints: (constraints: { advanced: Array<{ torch: boolean }> }) => Promise<void> }).applyConstraints({
        advanced: [{ torch: newTorchState }],
      })
      setTorchOn(newTorchState)
    } catch (err) {
      console.warn("Could not toggle torch:", err)
    }
  }

  // Handle barcode image upload detection
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorMessage(null)

    try {
      const bitmap = await createImageBitmap(file)
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
        const detector = new BarcodeDetectorClass()
        const barcodes = await detector.detect(bitmap)
        if (barcodes && barcodes.length > 0) {
          const code = barcodes[0].rawValue
          playScanBeep()
          setDetectedCode(code)
          stopCamera()
          setTimeout(() => {
            onScan(code)
            onClose()
          }, 300)
          return
        }
      }
      setErrorMessage("No barcode could be detected in this photo. Please try a clearer picture or enter manually.")
    } catch (err) {
      console.error("Image scan error:", err)
      setErrorMessage("Could not scan image. Please enter barcode manually.")
    }
  }

  useEffect(() => {
    if (!isOpen) return

    let active = true
    const init = async () => {
      if (active) {
        await startCamera()
      }
    }
    init().catch(console.error)

    return () => {
      active = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [isOpen, startCamera])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white text-[#0d1c2d] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#eef4ff] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="text-lg">📷</span>
            <div>
              <h3 className="text-sm font-bold text-[#0d1c2d]">Scan Barcode / SKU</h3>
              <p className="text-[11px] text-[#76777d]">Point camera at barcode or upload image</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f8f9ff] hover:bg-[#eef4ff] text-[#76777d] hover:text-[#0d1c2d] flex items-center justify-center text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          {/* Scanner Overlay Frame */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
              <div className="relative w-64 h-36 border-2 border-[#006c49]/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-emerald-400 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br" />

                {/* Laser scan line animation */}
                <div className="absolute left-1 right-1 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />

                <div className="absolute bottom-2 inset-x-0 text-center">
                  <span className="text-[10px] bg-black/60 text-white/90 px-2 py-0.5 rounded-full font-medium">
                    Align barcode inside frame
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Torch toggle button on video */}
          {supportsTorch && isScanning && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all ${
                torchOn ? "bg-amber-400 text-slate-900" : "bg-black/40 text-white"
              }`}
              title="Toggle Flashlight"
            >
              {torchOn ? "🔦 ON" : "🔦 Flash"}
            </button>
          )}

          {/* Detected code popup alert */}
          {detectedCode && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-white text-center animate-in zoom-in-90">
              <span className="text-3xl mb-1">✓</span>
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Barcode Detected!</p>
              <p className="text-lg font-mono font-black mt-1 bg-white/10 px-3 py-1 rounded-lg border border-emerald-400">
                {detectedCode}
              </p>
            </div>
          )}

          {/* Fallback / Error message */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white">
              <span className="text-2xl mb-2">⚠️</span>
              <p className="text-xs font-semibold text-slate-200 mb-3">{errorMessage}</p>
              <button
                type="button"
                onClick={() => startCamera()}
                className="text-xs font-bold bg-[#006c49] text-white px-3 py-1.5 rounded-xl hover:bg-[#005236]"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 space-y-3 bg-[#f8f9ff]">
          <div className="flex items-center gap-2">
            {/* Upload image fallback */}
            <label className="flex-1 cursor-pointer bg-white hover:bg-slate-50 border border-[#ccdbf2] text-[#0d1c2d] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center">
              <span>🖼️</span>
              <span>Upload Photo / Image</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            {hasCamera === false && (
              <button
                type="button"
                onClick={() => startCamera()}
                className="bg-[#006c49] text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>🔄 Restart Camera</span>
              </button>
            )}
          </div>

          {/* Quick Manual Entry */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#eef4ff]">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type barcode number manually..."
              className="flex-1 h-9 px-3 bg-white border border-[#c6c6cd] rounded-xl text-xs text-[#0d1c2d] outline-none focus:border-[#006c49]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualCode.trim()) {
                  e.preventDefault()
                  onScan(manualCode.trim())
                  onClose()
                }
              }}
            />
            <button
              type="button"
              disabled={!manualCode.trim()}
              onClick={() => {
                if (manualCode.trim()) {
                  onScan(manualCode.trim())
                  onClose()
                }
              }}
              className="h-9 px-4 bg-[#006c49] hover:bg-[#005236] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all"
            >
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Realistic SVG Barcode Visualizer ──────────────────────────────────────────
export function BarcodeVisualPreview({ barcode }: { barcode: string }) {
  if (!barcode) return null

  // Generate deterministic bar widths based on input string
  const bars: Array<{ width: number; isSpace: boolean }> = []
  let hash = 0
  for (let i = 0; i < barcode.length; i++) {
    hash = (hash * 31 + barcode.charCodeAt(i)) & 0xffffffff
  }

  // Start guard bars
  bars.push({ width: 2, isSpace: false }, { width: 1, isSpace: true }, { width: 2, isSpace: false })

  for (let i = 0; i < barcode.length; i++) {
    const charCode = barcode.charCodeAt(i)
    const pattern = (charCode * 7 + i * 13 + Math.abs(hash)) % 16
    bars.push(
      { width: (pattern % 3) + 1, isSpace: false },
      { width: ((pattern >> 1) % 2) + 1, isSpace: true },
      { width: ((pattern >> 2) % 3) + 1, isSpace: false },
      { width: 1, isSpace: true }
    )
  }

  // Stop guard bars
  bars.push({ width: 2, isSpace: false }, { width: 1, isSpace: true }, { width: 2, isSpace: false })

  return (
    <div className="flex flex-col items-center bg-white p-2.5 rounded-xl border border-[#ccdbf2] shadow-2xs select-all">
      <svg
        className="h-10 w-full max-w-[220px]"
        viewBox={`0 0 ${bars.reduce((acc, b) => acc + b.width, 0)} 40`}
        preserveAspectRatio="none"
      >
        {(() => {
          let currentX = 0
          return bars.map((bar, idx) => {
            const x = currentX
            currentX += bar.width
            if (bar.isSpace) return null
            return (
              <rect
                key={idx}
                x={x}
                y="0"
                width={bar.width}
                height="40"
                fill="#0d1c2d"
              />
            )
          })
        })()}
      </svg>
      <span className="font-mono text-[11px] font-bold text-[#0d1c2d] tracking-[0.2em] mt-1">
        {barcode}
      </span>
    </div>
  )
}

// ── Standard Auto-Generator Helper ───────────────────────────────────────────
export function generateStandardBarcode(prefix = "200"): string {
  // Generate 12-digit EAN-13 formatted string with valid check digit
  let code = prefix
  while (code.length < 11) {
    code += Math.floor(Math.random() * 10).toString()
  }
  // Compute EAN-13 check digit
  let sum = 0
  for (let i = 0; i < code.length; i++) {
    const digit = parseInt(code[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return code + checkDigit.toString()
}
