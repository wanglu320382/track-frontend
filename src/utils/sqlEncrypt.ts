import CryptoJS from 'crypto-js'

// TODO: 实际项目中请把秘钥放到安全配置中，通过环境变量注入，而不要写死在前端
const AES_KEY = CryptoJS.enc.Utf8.parse('track-backend-sq')   // 16 字节
const AES_IV = CryptoJS.enc.Utf8.parse('track-backend-iv')    // 16 字节

export const encryptSql = (plain: string): string => {
  if (!plain) return ''
  const encrypted = CryptoJS.AES.encrypt(plain, AES_KEY, {
    iv: AES_IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  })
  return encrypted.toString()
}

