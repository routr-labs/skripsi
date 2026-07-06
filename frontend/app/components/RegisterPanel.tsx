import { ChangeEvent, useEffect, useRef, useState } from 'react'

import { apiJson } from '../lib/api'
import { createHandLandmarker } from '../lib/mediapipe'

const REGISTRATION_CAPTURES_PER_HAND = 5
const REG_HOLD_MS = 1000
const REG_COOLDOWN_MS = 1500
const USB_PREVIEW_STREAM_URL = '/api/device-registration/preview.mjpg'

type Hand = 'left' | 'right'
type CapturedSample = { image: string; hand: Hand }
type Landmark = { x: number; y: number }

type DeviceRegistrationStatus = {
  active?: boolean
  current_hand?: Hand
  left_count?: number
  right_count?: number
  captured_count?: number
  total_required?: number
}

const ALL_HANDS: Hand[] = ['left', 'right']

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',', 2)[1] : value
}

function countHand(samples: CapturedSample[], hand: Hand) {
  return samples.filter((sample) => sample.hand === hand).length
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

export function RegisterPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const handLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const cooldownUntilRef = useRef(0)
  const activeRef = useRef(false)
  const captureSampleRef = useRef<() => void>(() => {})
  const [nim, setNim] = useState('')
  const [name, setName] = useState('')
  const [selectedHands, setSelectedHands] = useState<Hand[]>(ALL_HANDS)
  const [samples, setSamples] = useState<CapturedSample[]>([])
  const [usbDeviceMode, setUsbDeviceMode] = useState(false)
  const [devFeatures, setDevFeatures] = useState(false)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState<DeviceRegistrationStatus | null>(null)
  const [uploadFiles, setUploadFiles] = useState<Record<Hand, FileList | null>>({ left: null, right: null })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('Choose left, right, or both hands.')
  const [registrationQualityLine, setRegistrationQualityLine] = useState('Show your full palm to the camera.')

  activeRef.current = active

  useEffect(() => {
    let cancelled = false

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
        setRegistrationQualityLine(handFound ? 'Palm detected. Hold still.' : 'Show your full palm to the camera.')
        if (activeRef.current && handFound && ts >= cooldownUntilRef.current) {
          holdStartRef.current ??= ts
          if (ts - holdStartRef.current >= REG_HOLD_MS) {
            holdStartRef.current = null
            cooldownUntilRef.current = ts + REG_COOLDOWN_MS
            captureSampleRef.current()
          }
        } else {
          holdStartRef.current = null
        }
      } catch {
        setRegistrationQualityLine('Show your full palm to the camera.')
      }
    }

    async function boot() {
      try {
        const data = await apiJson<any>('/api/status')
        if (cancelled) return
        const usb = data.app?.camera_source === 'usb'
        setUsbDeviceMode(usb)
        setDevFeatures(data.app?.dev_features === true)
        if (!usb) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          streamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
          const { handLandmarker } = await createHandLandmarker()
          handLandmarkerRef.current = handLandmarker
          rafRef.current = requestAnimationFrame(detectLoop)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration camera unavailable')
      }
    }

    void boot()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (!active || !usbDeviceMode) return
    const id = window.setInterval(() => {
      void refreshUsbStatus()
    }, 1000)
    return () => window.clearInterval(id)
  }, [active, usbDeviceMode])

  function toggleHand(hand: Hand) {
    if (active) return
    setSelectedHands((current) => {
      const next = current.includes(hand) ? current.filter((item) => item !== hand) : [...current, hand]
      return next.length ? next : current
    })
  }

  function currentHand(nextSamples = samples) {
    return selectedHands.find((hand) => countHand(nextSamples, hand) < REGISTRATION_CAPTURES_PER_HAND)
  }

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current) throw new Error('Camera is not ready')
    const { videoWidth, videoHeight } = videoRef.current
    if (!videoWidth || !videoHeight) throw new Error('Camera is not ready')
    const canvas = canvasRef.current
    canvas.width = videoWidth
    canvas.height = videoHeight
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight)
    return stripDataUrl(canvas.toDataURL('image/jpeg', 0.9))
  }

  function startBrowserRegistration() {
    if (!nim.trim() || !name.trim()) {
      setError('NIM and full name are required')
      return
    }
    setSamples([])
    setActive(true)
    setError('')
    setMessage(`Registration started. Capture 5 samples for ${selectedHands.join(' and ')}.`)
  }

  function captureBrowserSample() {
    const hand = currentHand()
    if (!hand) return
    try {
      const next = [...samples, { image: captureFrame(), hand }]
      setSamples(next)
      setMessage(`Captured ${countHand(next, hand)} / ${REGISTRATION_CAPTURES_PER_HAND} for ${hand}.`)
      if (!currentHand(next)) setMessage('All samples captured. Finalize registration.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed')
    }
  }

  captureSampleRef.current = () => captureBrowserSample()

  async function finalizeBrowserRegistration() {
    try {
      await apiJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          nim,
          name,
          images: samples.map((sample) => sample.image),
          hands: samples.map((sample) => sample.hand),
          is_roi: false,
        }),
      })
      setActive(false)
      setSamples([])
      setMessage('Registration saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  async function startUsbRegistration() {
    if (!nim.trim() || !name.trim()) {
      setError('NIM and full name are required')
      return
    }
    try {
      await apiJson('/api/device-registration/start', {
        method: 'POST',
        body: JSON.stringify({ nim, name, hands: selectedHands }),
      })
      setActive(true)
      setError('')
      await refreshUsbStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USB registration failed')
    }
  }

  async function refreshUsbStatus() {
    const next = await apiJson<DeviceRegistrationStatus>('/api/device-registration/status')
    setStatus(next)
    setMessage(`USB captured ${next.captured_count ?? 0} / ${next.total_required ?? selectedHands.length * REGISTRATION_CAPTURES_PER_HAND}.`)
  }

  async function captureUsbSample() {
    try {
      await apiJson('/api/device-registration/capture', { method: 'POST' })
      await refreshUsbStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USB capture failed')
    }
  }

  async function finalizeUsbRegistration() {
    try {
      await apiJson('/api/device-registration/finalize', { method: 'POST' })
      setActive(false)
      setMessage('Registration saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USB finalize failed')
    }
  }

  async function cancelUsbRegistration() {
    try {
      await apiJson('/api/device-registration/cancel', { method: 'POST' })
    } finally {
      setActive(false)
      setStatus(null)
      setMessage('Registration cancelled.')
    }
  }

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(file)
    })
  }

  async function finalizeUploadRegistration() {
    const images: string[] = []
    const hands: Hand[] = []
    for (const hand of selectedHands) {
      const files = Array.from(uploadFiles[hand] ?? [])
      if (files.length !== REGISTRATION_CAPTURES_PER_HAND) {
        setError(`Select exactly 5 ${hand} hand photos.`)
        return
      }
      for (const file of files) {
        images.push(stripDataUrl(await fileToDataUrl(file)))
        hands.push(hand)
      }
    }
    try {
      await apiJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({ nim, name, images, hands, is_roi: false, source: 'upload' }),
      })
      setMessage('Upload registration saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload registration failed')
    }
  }

  const complete = selectedHands.every((hand) => countHand(samples, hand) === REGISTRATION_CAPTURES_PER_HAND)

  return (
    <section className="panel register-panel">
      <div className="panel-heading"><h2>Register</h2><span>{message}</span></div>
      {error && <p className="error-text">{error}</p>}
      <p id="registrationQualityLine" className="quality-line">{registrationQualityLine}</p>
      <div className="form-grid">
        <input aria-label="NIM" placeholder="NIM" value={nim} onChange={(event) => setNim(event.target.value)} />
        <input aria-label="Full name" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="hand-chips">
        {ALL_HANDS.map((hand) => (
          <button key={hand} type="button" className={selectedHands.includes(hand) ? 'active' : ''} onClick={() => toggleHand(hand)}>
            {hand} {usbDeviceMode ? status?.[`${hand}_count`] ?? 0 : countHand(samples, hand)} / {REGISTRATION_CAPTURES_PER_HAND}
          </button>
        ))}
      </div>
      <div className="camera-frame">
        {usbDeviceMode ? <img id="usbRegistrationPreview" src={USB_PREVIEW_STREAM_URL} alt="USB registration preview" /> : (
          <>
            <video ref={videoRef} id="videoReg" autoPlay playsInline muted />
            <canvas ref={overlayRef} id="overlayCanvasReg" />
          </>
        )}
      </div>
      <canvas ref={canvasRef} hidden />
      <div className="register-actions">
        {!active && <button type="button" onClick={() => void (usbDeviceMode ? startUsbRegistration() : startBrowserRegistration())}>Start registration</button>}
        {active && !usbDeviceMode && <button type="button" disabled={!currentHand()} onClick={() => captureBrowserSample()}>Capture sample</button>}
        {active && usbDeviceMode && <button type="button" onClick={() => void captureUsbSample()}>Capture sample</button>}
        {active && !usbDeviceMode && <button type="button" disabled={!complete} onClick={() => void finalizeBrowserRegistration()}>Finalize</button>}
        {active && usbDeviceMode && <button type="button" onClick={() => void finalizeUsbRegistration()}>Finalize</button>}
        {active && <button type="button" onClick={() => void (usbDeviceMode ? cancelUsbRegistration() : setActive(false))}>Cancel</button>}
      </div>
      {devFeatures && (
        <div className="upload-registration">
          <h3>Upload images</h3>
          {ALL_HANDS.map((hand) => (
            <label key={hand}>{hand} hand photos
              <input type="file" accept="image/*" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => setUploadFiles((current) => ({ ...current, [hand]: event.target.files }))} />
            </label>
          ))}
          <button type="button" onClick={() => void finalizeUploadRegistration()}>Upload register</button>
        </div>
      )}
    </section>
  )
}
