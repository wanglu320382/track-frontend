/**
 * 查询文本对称加解密工具（与后端 StatCryptoUtil 保持一致）
 * 使用 AES/CBC/PKCS5Padding 算法
 */

const ALGORITHM = 'AES-CBC';
const AES_128_BYTES = 16;

// 从环境变量获取密钥和IV
const AES_KEY = import.meta.env.VITE_TRACK_STAT_AES_KEY || '';
const AES_IV = import.meta.env.VITE_TRACK_STAT_AES_IV || '';

/**
 * 检查密钥和IV是否为16字节
 */
function validateKeyAndIv() {
  if (!AES_KEY || !AES_IV) {
    throw new Error('缺少必要配置：AES密钥或IV');
  }
  
  const keyBytes = new TextEncoder().encode(AES_KEY);
  const ivBytes = new TextEncoder().encode(AES_IV);
  
  if (keyBytes.length !== AES_128_BYTES || ivBytes.length !== AES_128_BYTES) {
    throw new Error('AES密钥和IV必须为16字节');
  }
}

/**
 * 将字符串转换为 ArrayBuffer
 */
function stringToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

/**
 * 将 ArrayBuffer 转换为字符串
 */
function bufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

/**
 * 加密文本
 */
export async function encrypt(text: string): Promise<string> {
  validateKeyAndIv();
  
  try {
    // 生成密钥和IV
    const key = await crypto.subtle.importKey(
      'raw',
      stringToBuffer(AES_KEY),
      { name: ALGORITHM },
      false,
      ['encrypt']
    );
    
    const iv = stringToBuffer(AES_IV);
    
    // 加密（crypto.subtle.encrypt会自动处理PKCS5Padding填充）
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv },
      key,
      stringToBuffer(text)
    );
    
    // 转换为Base64（使用标准Base64编码，确保与后端兼容）
    const arrayBuffer = new Uint8Array(encrypted);
    let binary = '';
    for (let i = 0; i < arrayBuffer.length; i++) {
      binary += String.fromCharCode(arrayBuffer[i]);
    }
    // 直接使用标准Base64编码，不进行URL-safe转换
    return btoa(binary);
  } catch (error) {
    console.error('加密失败:', error);
    throw new Error('加密失败');
  }
}

/**
 * 解密文本
 */
export async function decrypt(cipherText: string): Promise<string> {
  validateKeyAndIv();
  
  try {
    // 生成密钥和IV
    const key = await crypto.subtle.importKey(
      'raw',
      stringToBuffer(AES_KEY),
      { name: ALGORITHM },
      false,
      ['decrypt']
    );
    
    const iv = stringToBuffer(AES_IV);
    
    // 解码Base64
    const binary = atob(cipherText);
    const arrayBuffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      arrayBuffer[i] = binary.charCodeAt(i);
    }
    const encrypted = arrayBuffer.buffer;
    
    // 解密（crypto.subtle.decrypt会自动处理PKCS5Padding填充）
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      key,
      encrypted
    );
    
    return bufferToString(decrypted);
  } catch (error) {
    console.error('解密失败:', error);
    throw new Error('解密失败');
  }
}