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

type RegisterPanelProps = {
  active: boolean
}

type RegistrationMode = 'camera' | 'upload'
export type RegistrationBusyAction = 'start' | 'capture' | 'finalize' | 'upload' | null

type RegistrationButton = Exclude<RegistrationBusyAction, null>

const READY_REGISTRATION_LABELS: Record<RegistrationButton, string> = {
  start: 'Start registration',
  capture: 'Capture sample',
  finalize: 'Finalize',
  upload: 'Register from uploads',
}

const BUSY_REGISTRATION_LABELS: Record<RegistrationButton, string> = {
  start: 'Starting...',
  capture: 'Capturing...',
  finalize: 'Saving...',
  upload: 'Processing samples...',
}

export function registrationButtonText(button: RegistrationButton, busy: RegistrationBusyAction) {
  return busy === button ? BUSY_REGISTRATION_LABELS[button] : READY_REGISTRATION_LABELS[button]
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

export function RegisterPanel({ active: panelActive }: RegisterPanelProps) {
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
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('camera')
  const [status, setStatus] = useState<DeviceRegistrationStatus | null>(null)
  const [uploadFiles, setUploadFiles] = useState<Record<Hand, FileList | null>>({ left: null, right: null })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('Choose left, right, or both hands.')
  const [busyAction, setBusyAction] = useState<RegistrationBusyAction>(null)
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
      void refreshUsbStatus().catch(() => {})
    }, 1000)
    return () => window.clearInterval(id)
  }, [active, usbDeviceMode])

  function toggleHand(hand: Hand) {
    if (active || registrationBusy) return
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
    setBusyAction('finalize')
    setError('')
    setMessage('Processing samples on device...')
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
    } finally {
      setBusyAction(null)
    }
  }

  async function startUsbRegistration() {
    if (!nim.trim() || !name.trim()) {
      setError('NIM and full name are required')
      return
    }
    setBusyAction('start')
    setError('')
    setMessage('Starting registration on device...')
    try {
      await apiJson('/api/device-registration/start', {
        method: 'POST',
        body: JSON.stringify({ nim, name, hands: selectedHands }),
      })
      setActive(true)
      await refreshUsbStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USB registration failed')
    } finally {
      setBusyAction(null)
    }
  }

  async function refreshUsbStatus() {
    try {
      const next = await apiJson<DeviceRegistrationStatus>('/api/device-registration/status')
      setStatus(next)
      setMessage(`USB captured ${next.captured_count ?? 0} / ${next.total_required ?? selectedHands.length * REGISTRATION_CAPTURES_PER_HAND}.`)
    } catch (err) {
      setError(err instanceof Error ? `USB status refresh failed: ${err.message}` : 'USB status refresh failed')
      throw err
    }
  }

  async function captureUsbSample() {
    setBusyAction('capture')
    setError('')
    setMessage('Processing sample on device...')
    try {
      await apiJson('/api/device-registration/capture', { method: 'POST' })
      await refreshUsbStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USB capture failed')
    } finally {
      setBusyAction(null)
    }
  }

  async function finalizeUsbRegistration() {
    setBusyAction('finalize')
    setError('')
    setMessage('Processing samples on device...')
    try {
      await apiJson('/api/device-registration/finalize', { method: 'POST' })
      setActive(false)
      setMessage('Registration saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USB finalize failed')
    } finally {
      setBusyAction(null)
    }
  }

  async function cancelUsbRegistration() {
    try {
      await apiJson('/api/device-registration/cancel', { method: 'POST' })
    } catch (err) {
      setError(err instanceof Error ? `Cancel failed: ${err.message}` : 'Cancel failed')
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
    if (!nim.trim() || !name.trim()) {
      setError('NIM and full name are required')
      return
    }
    for (const hand of selectedHands) {
      const files = Array.from(uploadFiles[hand] ?? [])
      if (files.length !== REGISTRATION_CAPTURES_PER_HAND) {
        setError(`Select exactly 5 ${hand} hand photos.`)
        return
      }
    }

    setBusyAction('upload')
    setError('')
    setMessage('Processing uploaded samples on device...')
    try {
      const images: string[] = []
      const hands: Hand[] = []
      for (const hand of selectedHands) {
        const files = Array.from(uploadFiles[hand] ?? [])
        for (const file of files) {
          images.push(stripDataUrl(await fileToDataUrl(file)))
          hands.push(hand)
        }
      }
      await apiJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({ nim, name, images, hands, is_roi: false, source: 'upload' }),
      })
      setMessage('Upload registration saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload registration failed')
    } finally {
      setBusyAction(null)
    }
  }

  const registrationBusy = busyAction !== null
  const complete = selectedHands.every((hand) => countHand(samples, hand) === REGISTRATION_CAPTURES_PER_HAND)
  const leftCount = usbDeviceMode ? status?.left_count ?? 0 : countHand(samples, 'left')
  const rightCount = usbDeviceMode ? status?.right_count ?? 0 : countHand(samples, 'right')
  const current = currentHand()
  const currentCount = current ? countHand(samples, current) : 0
  const sampleTitle = current ? `${current[0].toUpperCase() + current.slice(1)} hand sample ${currentCount + 1}/${REGISTRATION_CAPTURES_PER_HAND}: Center palm` : 'All samples captured'
  const sampleDesc = current ? `Use your actual ${current} hand: palm facing camera, fingers up, wrist visible.` : 'Finalize registration to save this user.'
  const uploadLeftCount = Array.from(uploadFiles.left ?? []).length
  const uploadRightCount = Array.from(uploadFiles.right ?? []).length
  const handToggleLocked = active || registrationBusy
  const registrationQualityClass = error ? 'bad' : registrationQualityLine.includes('Palm detected') ? 'ok' : active ? 'warn' : 'neutral'

  return (
    <section className={`panel${panelActive ? ' active' : ''}`} id="panel-register">
      <div className="register-layout unified">
        <div className="register-camera-col">
          <div className="camera-frame reg-camera" id="regCameraFrame">
            {usbDeviceMode ? (
              <img id="usbRegistrationPreview" className="usb-preview" src={USB_PREVIEW_STREAM_URL} alt="USB camera preview" />
            ) : (
              <video ref={videoRef} id="videoReg" autoPlay playsInline muted />
            )}
            <canvas ref={overlayRef} id="overlayCanvasReg" className="overlay-canvas" />
            <svg className="hand-guide-overlay" id="handGuideOverlay" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <circle className="guide-size-ring" id="guideSizeRing" cx="50" cy="50" r="35" fill="none" strokeWidth="2" strokeDasharray="4 2" />
              <line className="guide-crosshair" id="guideCrossH" x1="45" y1="50" x2="55" y2="50" strokeWidth="1" />
              <line className="guide-crosshair" id="guideCrossV" x1="50" y1="45" x2="50" y2="55" strokeWidth="1" />
              <path className="guide-rotation-arc" id="guideRotationArc" d="" fill="none" strokeWidth="2" />
            </svg>
            <div className="autoscan-ring" id="autoscanRingReg" style={{ display: panelActive ? undefined : 'none' }}>
              <svg viewBox="0 0 100 100" className="ring-svg" aria-hidden="true">
                <circle className="ring-track" cx="50" cy="50" r="42" />
                <circle className="ring-fill" cx="50" cy="50" r="42" id="ringFillReg" />
              </svg>
              <span className="ring-label" id="ringLabelReg">Hold</span>
            </div>
            <div className="palm-guide" id="palmGuideReg">
              <div className="guide-ring outer" />
              <div className="guide-label">Align palm</div>
            </div>
            <div className="capture-flash" id="captureFlashReg" />
            <div className="brightness-badge" id="brightnessBadgeReg" style={{ display: 'none' }} />
          </div>

          <div className="guidance-metrics" id="guidanceMetrics">
            <div className="metric-item" id="metricSize"><span className="metric-icon">↕</span> Size: <strong>--</strong></div>
            <div className="metric-item" id="metricRotation"><span className="metric-icon">↺</span> Rotation: <strong>--</strong></div>
            <div className="metric-item" id="metricPosition"><span className="metric-icon">↔</span> Position: <strong>--</strong></div>
          </div>
        </div>

        <div className="register-form-col">
          <div className="form-block">
            <h2 className="form-title">Register new user</h2>
            <p className="form-desc">Choose left, right, or both. Default captures 5 left-hand and 5 right-hand samples so either hand can unlock.</p>

            <div className="field-group">
              <label className="field-label" htmlFor="userNim">NIM</label>
              <input className="field-input" type="text" id="userNim" placeholder="Enter NIM…" autoComplete="off" spellCheck="false" value={nim} onChange={(event) => setNim(event.target.value)} />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="userName">Full name</label>
              <input className="field-input" type="text" id="userName" placeholder="Enter name…" autoComplete="off" spellCheck="false" value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div className="registration-mode-tabs" id="registrationModeTabs" role="tablist" aria-label="Registration method">
              <button className={`registration-mode-tab${registrationMode === 'camera' ? ' active' : ''}`} id="cameraRegistrationTab" type="button" role="tab" aria-selected={registrationMode === 'camera'} aria-controls="cameraRegistrationPanel" data-registration-mode="camera" onClick={() => setRegistrationMode('camera')}>
                <strong>Camera capture</strong>
                <span>Guided live captures</span>
              </button>
              <button className={`registration-mode-tab dev-only${registrationMode === 'upload' ? ' active' : ''}`} id="uploadRegistrationTab" type="button" role="tab" aria-selected={registrationMode === 'upload'} aria-controls="uploadRegistrationPanel" data-registration-mode="upload" hidden={!devFeatures} onClick={() => setRegistrationMode('upload')}>
                <strong>Upload images</strong>
                <span>Selected hands · 5 photos each</span>
              </button>
            </div>

            <div className={`registration-mode-panel${registrationMode === 'camera' ? ' active' : ''}`} id="cameraRegistrationPanel" data-registration-mode-panel="camera" role="tabpanel" aria-labelledby="cameraRegistrationTab">
              <div className="registration-status" id="registrationStatus">
                <div className="registration-hand-select" aria-label="Hands to register">
                  <button className={`registration-hand-chip${selectedHands.includes('left') ? ' active' : ''}`} id="registrationLeftHand" type="button" data-hand-toggle="left" aria-pressed={selectedHands.includes('left')} disabled={handToggleLocked || (selectedHands.includes('left') && selectedHands.length === 1)} onClick={() => toggleHand('left')}>Left <span id="registrationLeftCount">{leftCount}/5</span></button>
                  <button className={`registration-hand-chip${selectedHands.includes('right') ? ' active' : ''}`} id="registrationRightHand" type="button" data-hand-toggle="right" aria-pressed={selectedHands.includes('right')} disabled={handToggleLocked || (selectedHands.includes('right') && selectedHands.length === 1)} onClick={() => toggleHand('right')}>Right <span id="registrationRightCount">{rightCount}/5</span></button>
                </div>
                <div className="sample-title" id="regSampleTitle">{sampleTitle}</div>
                <div className="sample-desc" id="regSampleDesc">{sampleDesc}</div>
                <div className="capture-dots hand-dots" id="captureDots">
                  {ALL_HANDS.map((hand) => (
                    <div key={hand} className={`capture-dot-group${selectedHands.includes(hand) ? '' : ' muted'}`} data-hand={hand}>
                      <span className="dot-label">{hand[0].toUpperCase() + hand.slice(1)}</span>
                      {[0, 1, 2, 3, 4].map((index) => <span key={index} className={`dot${countHand(samples, hand) > index || (usbDeviceMode && ((hand === 'left' ? status?.left_count : status?.right_count) ?? 0) > index) ? ' filled' : ''}`} data-hand={hand} data-i={index} />)}
                    </div>
                  ))}
                </div>
                <div className={`registration-quality-line ${registrationQualityClass}`} id="registrationQualityLine">{error || registrationQualityLine}</div>
              </div>

              <div className="register-hint" id="registerHint">{message}</div>
              <div className="register-actions">
                <button className="btn btn-primary" id="btnStartRegistration" type="button" disabled={active || registrationBusy} onClick={() => void (usbDeviceMode ? startUsbRegistration() : startBrowserRegistration())}>{registrationButtonText('start', busyAction)}</button>
                <button className="btn btn-secondary" id="btnCaptureSample" type="button" disabled={!active || registrationBusy || (!usbDeviceMode && !currentHand())} onClick={() => void (usbDeviceMode ? captureUsbSample() : captureBrowserSample())}>{registrationButtonText('capture', busyAction)}</button>
                <button className="btn btn-primary" id="btnFinalizeRegistration" type="button" disabled={!active || registrationBusy || (!usbDeviceMode && !complete)} onClick={() => void (usbDeviceMode ? finalizeUsbRegistration() : finalizeBrowserRegistration())}>{registrationButtonText('finalize', busyAction)}</button>
                <button className="btn btn-ghost" id="btnCancelRegistration" type="button" disabled={!active || registrationBusy} onClick={() => void (usbDeviceMode ? cancelUsbRegistration() : setActive(false))}>Cancel</button>
              </div>
            </div>

            <div className={`registration-mode-panel dev-only${registrationMode === 'upload' ? ' active' : ''}`} id="uploadRegistrationPanel" data-registration-mode-panel="upload" role="tabpanel" aria-labelledby="uploadRegistrationTab" hidden={!devFeatures}>
              <div className="registration-hand-select upload-hand-select" aria-label="Hands to upload">
                <button className={`registration-hand-chip${selectedHands.includes('left') ? ' active' : ''}`} id="uploadRegistrationLeftHand" type="button" data-hand-toggle="left" aria-pressed={selectedHands.includes('left')} disabled={handToggleLocked || (selectedHands.includes('left') && selectedHands.length === 1)} onClick={() => toggleHand('left')}>Left <span id="uploadRegistrationLeftCount">{uploadLeftCount}/5</span></button>
                <button className={`registration-hand-chip${selectedHands.includes('right') ? ' active' : ''}`} id="uploadRegistrationRightHand" type="button" data-hand-toggle="right" aria-pressed={selectedHands.includes('right')} disabled={handToggleLocked || (selectedHands.includes('right') && selectedHands.length === 1)} onClick={() => toggleHand('right')}>Right <span id="uploadRegistrationRightCount">{uploadRightCount}/5</span></button>
              </div>
              <div className="upload-registration-grid">
                {ALL_HANDS.map((hand) => {
                  const selected = selectedHands.includes(hand)
                  const files = Array.from(uploadFiles[hand] ?? [])
                  const uploadDisabled = busyAction === 'upload' || !selected
                  return (
                    <div key={hand} className={`upload-picker${files.length === REGISTRATION_CAPTURES_PER_HAND ? ' ok' : files.length ? ' bad' : ''}${uploadDisabled ? ' disabled' : ''}`} id={hand === 'left' ? 'uploadLeftPicker' : 'uploadRightPicker'}>
                      <div className="upload-picker-head"><strong>{hand[0].toUpperCase() + hand.slice(1)} hand photos</strong><span className="upload-count" id={hand === 'left' ? 'uploadLeftCount' : 'uploadRightCount'}>{files.length}/5</span></div>
                      <label className="upload-file-label" htmlFor={hand === 'left' ? 'uploadLeftFiles' : 'uploadRightFiles'}>
                        <input className="upload-file-input" id={hand === 'left' ? 'uploadLeftFiles' : 'uploadRightFiles'} type="file" accept="image/*" multiple disabled={uploadDisabled} onChange={(event: ChangeEvent<HTMLInputElement>) => setUploadFiles((current) => ({ ...current, [hand]: event.target.files }))} />
                        <span>Select exactly 5 full-hand photos</span>
                      </label>
                      <div className="upload-file-list" id={hand === 'left' ? 'uploadLeftList' : 'uploadRightList'}>{files.length ? files.map((file) => file.name).join(', ') : 'No files selected.'}</div>
                    </div>
                  )
                })}
              </div>
              <div className="register-hint" id="uploadRegisterHint">Selected hands need exactly 5 full-hand photos each. PalmGate will detect the palm ROI with the same runtime MediaPipe path.</div>
              <div className="register-actions upload-register-actions">
                <button className="btn btn-primary" id="btnUploadRegister" type="button" disabled={!nim.trim() || !name.trim() || busyAction === 'upload'} onClick={() => void finalizeUploadRegistration()}>{registrationButtonText('upload', busyAction)}</button>
                <button className="btn btn-ghost" id="btnClearUploadFiles" type="button" disabled={busyAction === 'upload'} onClick={() => setUploadFiles({ left: null, right: null })}>Clear files</button>
              </div>
            </div>

            <div className={`register-feedback${error ? ' error' : message.includes('saved') ? ' success' : ''}`} id="registerFeedback">{error || message}</div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} hidden />
    </section>
  )
}
