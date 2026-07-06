import { ChangeEvent, useEffect, useRef, useState } from 'react'

import { apiJson } from '../lib/api'
import { createHandLandmarker } from '../lib/mediapipe'

const SCAN_HOLD_MS = 800
const USB_PREVIEW_STREAM_URL = '/api/device-registration/preview.mjpg'

type Landmark = { x: number; y: number }

type RecognizeResult = {
  status?: string
  name?: string
  similarity?: number
  roi_image?: string
}

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',', 2)[1] : value
}

function drawHandOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks: Landmark[]) {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) return
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  if (!landmarks.length) return
  ctx.fillStyle = '#22c55e'
  for (const point of landmarks) {
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function ScanPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const usbPreviewRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const eventsRef = useRef<EventSource | null>(null)
  const handLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const triggerScanRef = useRef<() => void>(() => {})
  const autoModeRef = useRef(true)
  const busyRef = useRef(false)
  const [usbDeviceMode, setUsbDeviceMode] = useState(false)
  const [devFeatures, setDevFeatures] = useState(false)
  const [autoMode, setAutoMode] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [guidance, setGuidance] = useState('Show your palm to the camera.')
  const [result, setResult] = useState('Ready')
  const [roiImage, setRoiImage] = useState('')

  autoModeRef.current = autoMode
  busyRef.current = busy

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    }

    function detectLoop(ts: number) {
      rafRef.current = requestAnimationFrame(detectLoop)
      const video = videoRef.current
      const overlay = overlayRef.current
      const detector = handLandmarkerRef.current
      if (!video || !overlay || !detector || video.readyState < 2) return
      try {
        const detection = detector.detectForVideo(video, ts)
        const landmarks = detection.landmarks?.[0] ?? []
        drawHandOverlay(overlay, video, landmarks)
        const handFound = landmarks.length > 0
        setGuidance(handFound ? 'Palm detected. Hold still.' : 'Show your palm to the camera.')
        if (autoModeRef.current && handFound && !busyRef.current) {
          holdStartRef.current ??= ts
          if (ts - holdStartRef.current >= SCAN_HOLD_MS) {
            holdStartRef.current = null
            triggerScanRef.current()
          }
        } else {
          holdStartRef.current = null
        }
      } catch {
        setGuidance('Show your palm to the camera.')
      }
    }

    async function boot() {
      try {
        const data = await apiJson<any>('/api/status')
        if (cancelled) return
        const usb = data.app?.camera_source === 'usb'
        setUsbDeviceMode(usb)
        setDevFeatures(data.app?.dev_features === true)
        if (usb) {
          eventsRef.current = new EventSource('/api/device-registration/scan-events')
          eventsRef.current.onmessage = (event) => setResult(event.data)
        } else {
          const { handLandmarker } = await createHandLandmarker()
          handLandmarkerRef.current = handLandmarker
          await startCamera()
          rafRef.current = requestAnimationFrame(detectLoop)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Manual scan mode')
      }
    }

    void boot()
    return () => {
      cancelled = true
      eventsRef.current?.close()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function captureFrame(source: HTMLVideoElement | HTMLImageElement | null) {
    if (!source || !canvasRef.current) throw new Error('No camera frame available')
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight
    if (!width || !height) throw new Error('Camera is not ready')
    const canvas = canvasRef.current
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')?.drawImage(source, 0, 0, width, height)
    return stripDataUrl(canvas.toDataURL('image/jpeg', 0.9))
  }

  async function submitRecognitionImage(image: string) {
    const data = await apiJson<RecognizeResult>('/api/recognize', {
      method: 'POST',
      body: JSON.stringify({ image, is_roi: false, debug_roi: devFeatures }),
    })
    setRoiImage(data.roi_image ?? '')
    setResult(`${data.status ?? 'DONE'} ${data.name ?? ''}`.trim())
  }

  async function triggerScan() {
    if (busyRef.current) return
    setBusy(true)
    setError('')
    try {
      const scanSource = usbDeviceMode ? usbPreviewRef.current : videoRef.current
      await submitRecognitionImage(captureFrame(scanSource))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setBusy(false)
    }
  }

  triggerScanRef.current = () => { void triggerScan() }

  async function handleScanUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    setBusy(true)
    setError('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Failed to read image'))
        reader.readAsDataURL(file)
      })
      await submitRecognitionImage(stripDataUrl(dataUrl))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload scan failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel scan-panel">
      <div className="panel-heading">
        <h2>Scan</h2>
        <button type="button" onClick={() => setAutoMode((value) => !value)}>Mode: {autoMode ? 'Auto' : 'Manual'}</button>
        <button id="btnScan" type="button" disabled={busy} onClick={() => void triggerScan()}>Scan</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <p className="quality-line">{guidance}</p>
      <div className="camera-frame">
        {usbDeviceMode ? (
          <img id="usbPreview" ref={usbPreviewRef} src={USB_PREVIEW_STREAM_URL} alt="USB camera preview" />
        ) : (
          <>
            <video ref={videoRef} id="video" autoPlay playsInline muted />
            <canvas ref={overlayRef} id="overlayCanvas" />
          </>
        )}
      </div>
      <canvas ref={canvasRef} id="canvas" hidden />
      {devFeatures && <input id="scanUploadFile" type="file" accept="image/*" onChange={handleScanUpload} />}
      <div className="result-card">{result}</div>
      {devFeatures && roiImage && <img id="roiPreviewImage" src={roiImage} alt="ROI used for embedding" />}
    </section>
  )
}
