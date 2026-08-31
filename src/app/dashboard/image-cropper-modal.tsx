"use client"

import { useState, useRef, useCallback } from "react"

interface ImageCropperModalProps {
  isOpen: boolean
  imageSrc: string
  title?: string
  onClose: () => void
  onCropComplete: (croppedBlob: Blob) => Promise<void> | void
}

export function ImageCropperModal({
  isOpen,
  imageSrc,
  title = "Crop & Adjust Image (1:1 Square)",
  onClose,
  onCropComplete,
}: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Mouse & Touch Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    })
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.002
    setZoom((prev) => Math.min(Math.max(prev + delta, 0.8), 3.5))
  }

  // Perform canvas crop
  const handlePerformCrop = useCallback(async () => {
    if (!imageRef.current || !containerRef.current) return
    setIsProcessing(true)

    try {
      const img = imageRef.current
      const container = containerRef.current
      const containerRect = container.getBoundingClientRect()

      const outputSize = 800
      const canvas = document.createElement("canvas")
      canvas.width = outputSize
      canvas.height = outputSize
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      // Calculate source image display dimensions inside container
      const imgAspect = img.naturalWidth / img.naturalHeight
      let renderWidth = containerRect.width
      let renderHeight = containerRect.height

      if (imgAspect > 1) {
        // Landscape
        renderWidth = containerRect.height * imgAspect
      } else {
        // Portrait or square
        renderHeight = containerRect.width / imgAspect
      }

      // Apply zoom
      renderWidth *= zoom
      renderHeight *= zoom

      // Center offset + pan
      const centerX = (containerRect.width - renderWidth) / 2 + pan.x
      const centerY = (containerRect.height - renderHeight) / 2 + pan.y

      // Scale factor from container to outputSize canvas
      const scaleToCanvas = outputSize / containerRect.width

      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, outputSize, outputSize)

      ctx.drawImage(
        img,
        centerX * scaleToCanvas,
        centerY * scaleToCanvas,
        renderWidth * scaleToCanvas,
        renderHeight * scaleToCanvas
      )

      // Export as high-efficiency WebP (fallback to JPEG if needed)
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            await onCropComplete(blob)
          } else {
            canvas.toBlob(
              async (fallbackBlob) => {
                if (fallbackBlob) {
                  await onCropComplete(fallbackBlob)
                }
                setIsProcessing(false)
              },
              "image/jpeg",
              0.85
            )
            return
          }
          setIsProcessing(false)
        },
        "image/webp",
        0.85
      )
    } catch (err) {
      console.error("Crop error:", err)
      setIsProcessing(false)
    }
  }, [zoom, pan, onCropComplete])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-[#eef4ff] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#eef4ff]">
          <div className="flex items-center gap-2">
            <span className="text-lg">✂️</span>
            <h3 className="text-base font-bold text-[#0d1c2d]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-sm font-bold text-[#76777d] hover:text-[#0d1c2d] p-1"
          >
            ✕
          </button>
        </div>

        {/* Instructions */}
        <p className="text-[11px] text-[#76777d] my-2 text-center">
          Drag to reposition · Scroll or slide to zoom in/out
        </p>

        {/* Cropper Viewport (Square 1:1) */}
        <div className="flex justify-center my-2">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-slate-900 border-2 border-[#006c49] shadow-inner select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
          >
            {/* The Image being transformed */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isDragging ? "none" : "transform 0.05s ease-out",
              }}
              className="relative max-w-none max-h-none pointer-events-none flex items-center justify-center"
            >
              {/* Using native img for exact naturalWidth/naturalHeight access for canvas drawing */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop preview"
                crossOrigin="anonymous"
                className="max-w-none select-none"
                style={{
                  maxHeight: "320px",
                  maxWidth: "none",
                  objectFit: "contain",
                }}
              />
            </div>

            {/* Grid Lines Overlay */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/30">
              <div className="border-r border-b border-white/20"></div>
              <div className="border-r border-b border-white/20"></div>
              <div className="border-b border-white/20"></div>
              <div className="border-r border-b border-white/20"></div>
              <div className="border-r border-b border-white/20"></div>
              <div className="border-b border-white/20"></div>
              <div className="border-r border-white/20"></div>
              <div className="border-r border-white/20"></div>
              <div></div>
            </div>

            {/* 1:1 Badge Indicator */}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold pointer-events-none">
              1:1 Square Frame
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="mt-3 px-2 flex items-center gap-3">
          <span className="text-xs font-bold text-[#76777d]">🔍 Zoom</span>
          <input
            type="range"
            min="0.8"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[#006c49] cursor-pointer"
          />
          <button
            type="button"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            className="text-[11px] font-semibold text-[#006c49] bg-[#eef4ff] hover:bg-[#dbe9ff] px-2 py-1 rounded-lg"
          >
            Reset
          </button>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 mt-2 border-t border-[#eef4ff] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-[#76777d] hover:text-[#0d1c2d] rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePerformCrop}
            disabled={isProcessing}
            className="bg-[#006c49] hover:bg-[#005236] disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <span>{isProcessing ? "Processing & Uploading..." : "✓ Crop & Save"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
