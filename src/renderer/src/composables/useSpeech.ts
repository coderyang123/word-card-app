import { ref } from 'vue'

/**
 * 系统 Speech API 朗读封装（Electron 走系统 TTS）。
 * getVoices() 在部分平台异步加载，这里做一次预热。
 */
export function useSpeech() {
  const supported = ref(typeof window !== 'undefined' && 'speechSynthesis' in window)
  const speaking = ref(false)

  function speak(text: string, lang = 'en-US'): void {
    if (!supported.value || text.trim().length === 0) return
    const synth = window.speechSynthesis
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.9

    const voices = synth.getVoices()
    const voice =
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('en'))
    if (voice) utterance.voice = voice

    utterance.onstart = () => {
      speaking.value = true
    }
    utterance.onend = () => {
      speaking.value = false
    }
    utterance.onerror = () => {
      speaking.value = false
    }

    synth.speak(utterance)
  }

  function stop(): void {
    if (!supported.value) return
    window.speechSynthesis.cancel()
    speaking.value = false
  }

  if (supported.value) {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      window.speechSynthesis.getVoices()
    })
  }

  return { supported, speaking, speak, stop }
}
