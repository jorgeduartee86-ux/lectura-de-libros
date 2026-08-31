import { useSyncExternalStore } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type InstallResult = 'accepted' | 'dismissed' | 'unavailable' | 'installed'

interface InstallSnapshot {
  available: boolean
  installed: boolean
}

let installPrompt: BeforeInstallPromptEvent | null = null
let initialized = false
let snapshot: InstallSnapshot = {
  available: false,
  installed: window.matchMedia('(display-mode: standalone)').matches,
}
const listeners = new Set<() => void>()

function publish(next: InstallSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

export function initializePwaInstall() {
  if (initialized) return
  initialized = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt = event as BeforeInstallPromptEvent
    publish({ available: true, installed: false })
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    publish({ available: false, installed: true })
  })
}

export async function promptPwaInstall(): Promise<InstallResult> {
  if (snapshot.installed) return 'installed'
  if (!installPrompt) return 'unavailable'
  await installPrompt.prompt()
  const choice = await installPrompt.userChoice
  installPrompt = null
  publish({ available: false, installed: choice.outcome === 'accepted' })
  return choice.outcome
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePwaInstall() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}
