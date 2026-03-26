import CryptoJS from 'crypto-js'

const readEnv = (key: string): string | undefined => {
  const env = import.meta.env as unknown as Record<string, unknown>
  const v = env[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

const getKeyAndIv = (): { key: CryptoJS.lib.WordArray; iv: CryptoJS.lib.WordArray } | null => {
  const keyRaw = readEnv('VITE_TRACK_STAT_AES_KEY')
  const ivRaw = readEnv('VITE_TRACK_STAT_AES_IV')
  if (!keyRaw || !ivRaw) return null
  if (new TextEncoder().encode(keyRaw).length !== 16) return null
  if (new TextEncoder().encode(ivRaw).length !== 16) return null
  return {
    key: CryptoJS.enc.Utf8.parse(keyRaw),
    iv: CryptoJS.enc.Utf8.parse(ivRaw),
  }
}

export const encryptStat = (plain: string): string | undefined => {
  if (!plain) return undefined
  const secret = getKeyAndIv()
  if (!secret) return undefined
  const encrypted = CryptoJS.AES.encrypt(plain, secret.key, {
    iv: secret.iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  })
  return encrypted.toString()
}
