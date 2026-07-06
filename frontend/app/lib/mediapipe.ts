type MediaPipeVisionModule = any

const VISION_BUNDLE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const HAND_LANDMARKER_TASK_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export async function createHandLandmarker() {
  const mediapipe = (await import(/* @vite-ignore */ VISION_BUNDLE_URL)) as MediaPipeVisionModule
  const vision = await mediapipe.FilesetResolver.forVisionTasks(WASM_URL)
  const handLandmarker = await mediapipe.HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_LANDMARKER_TASK_URL },
    runningMode: 'VIDEO',
    numHands: 1,
  })
  return { handLandmarker, DrawingUtils: mediapipe.DrawingUtils }
}
