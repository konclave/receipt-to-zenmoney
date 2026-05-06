<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { captureStore } from '$lib/stores/capture'

  let videoEl = $state<HTMLVideoElement | null>(null)
  let canvasEl = $state<HTMLCanvasElement | null>(null)
  let stream = $state<MediaStream | null>(null)
  let cameraError = $state<string | null>(null)
  let useFileInput = $state(false)

  onMount(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      if (videoEl) videoEl.srcObject = stream
    } catch {
      cameraError = 'Camera not available — use the file picker below.'
      useFileInput = true
    }
  })

  onDestroy(() => stream?.getTracks().forEach((t) => t.stop()))

  async function compressToJpeg(base64: string, mimeType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1280
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width)
            width = MAX
          } else {
            width = Math.round((width * MAX) / height)
            height = MAX
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.onerror = reject
      img.src = `data:${mimeType};base64,${base64}`
    })
  }

  async function captureFromVideo() {
    if (!videoEl || !canvasEl) return
    canvasEl.width = videoEl.videoWidth
    canvasEl.height = videoEl.videoHeight
    canvasEl.getContext('2d')!.drawImage(videoEl, 0, 0)
    const rawBase64 = canvasEl.toDataURL('image/jpeg', 1).split(',')[1]
    stream?.getTracks().forEach((t) => t.stop())
    const imageBase64 = await compressToJpeg(rawBase64, 'image/jpeg')
    captureStore.set({ imageBase64, mimeType: 'image/jpeg' })
    goto('/review')
  }

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataUrl = reader.result
        if (typeof dataUrl !== 'string') return
        const imageBase64 = await compressToJpeg(dataUrl.split(',')[1], file.type)
        captureStore.set({ imageBase64, mimeType: 'image/jpeg' })
        goto('/review')
      } catch {
        cameraError = 'Could not process the selected image. Please try another file.'
      }
    }
    reader.readAsDataURL(file)
  }
</script>

<div class="capture-page">
  {#if !useFileInput}
    <div class="viewfinder">
      <video bind:this={videoEl} autoplay playsinline muted class="video"></video>
    </div>
  {/if}

  {#if cameraError}
    <p class="camera-error">{cameraError}</p>
  {/if}

  {#if !useFileInput}
    <div class="controls">
      <button class="capture-btn" onclick={captureFromVideo} aria-label="Take photo">
        <span class="shutter"></span>
      </button>
    </div>
  {/if}

  <div class="file-area" class:prominent={useFileInput}>
    <label for="receipt-file" class="file-label">
      {useFileInput ? '📁 Choose a receipt photo' : 'or upload from gallery'}
    </label>
    <input id="receipt-file" type="file" accept="image/*"
      onchange={handleFileChange} class="file-input" />
  </div>

  <canvas bind:this={canvasEl} style="display:none"></canvas>
</div>

<style>
  .capture-page { display: flex; flex-direction: column; height: calc(100dvh - var(--nav-height)); background: #000; }
  .viewfinder { flex: 1; overflow: hidden; }
  .video { width: 100%; height: 100%; object-fit: cover; }
  .controls { display: flex; justify-content: center; padding: 24px; background: rgba(0,0,0,0.6); }
  .capture-btn { width: 72px; height: 72px; border-radius: 50%; border: 4px solid white; background: transparent; display: flex; align-items: center; justify-content: center; }
  .shutter { width: 56px; height: 56px; border-radius: 50%; background: white; display: block; transition: transform 0.1s; }
  .capture-btn:active .shutter { transform: scale(0.9); }
  .file-area { padding: 12px 16px; text-align: center; background: rgba(0,0,0,0.6); }
  .file-area.prominent { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-bg); gap: 16px; }
  .file-label { display: block; color: rgba(255,255,255,0.7); font-size: 13px; cursor: pointer; }
  .prominent .file-label { color: var(--color-primary); font-size: 18px; font-weight: 500; }
  .file-input { display: none; }
  .camera-error { color: rgba(255,255,255,0.7); font-size: 13px; padding: 8px 16px; text-align: center; background: rgba(0,0,0,0.6); }
</style>
