<template>
  <div class="login-page">
    <el-card class="login-card">
      <h2 class="title">问题溯源系统</h2>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="验证码" prop="captcha">
          <div class="captcha-row">
            <el-input
              v-model="form.captcha"
              placeholder="请输入验证码"
              maxlength="4"
              style="flex: 1"
              @keyup.enter="handleLogin"
            />
            <div class="captcha-box" @click="refreshCaptcha">
              <canvas ref="canvasRef" width="120" height="40" title="点击刷新验证码" />
            </div>
          </div>
          <div class="captcha-tip">
            <span class="captcha-refresh" @click="refreshCaptcha">看不清？换一张</span>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="handleLogin">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { login } from '@/api/auth'
import { encryptStat } from '@/utils/statEncrypt'

const router = useRouter()
const formRef = ref<FormInstance>()
const canvasRef = ref<HTMLCanvasElement>()
const loading = ref(false)
const captchaAnswer = ref('')
const form = ref({
  username: '',
  password: undefined as string | undefined,
  captcha: '',
})

const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'

function randomCode(len = 4) {
  let code = ''
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function drawCaptcha() {
  const canvas = canvasRef.value
  if (!canvas) return
  const code = randomCode(4)
  captchaAnswer.value = code
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = '#f0f2f5'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '24px Arial'
  for (let i = 0; i < code.length; i++) {
    ctx.save()
    ctx.fillStyle = `hsl(${Math.random() * 60 + 200}, 60%, 35%)`
    ctx.translate(20 + i * 26, 28)
    ctx.rotate((Math.random() - 0.5) * 0.4)
    ctx.fillText(code[i], 0, 0)
    ctx.restore()
  }
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.2 + 0.1})`
    ctx.beginPath()
    ctx.moveTo(Math.random() * w, Math.random() * h)
    ctx.lineTo(Math.random() * w, Math.random() * h)
    ctx.stroke()
  }
}

function refreshCaptcha() {
  form.value.captcha = ''
  drawCaptcha()
}

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value && value.toLowerCase() !== captchaAnswer.value.toLowerCase()) {
          callback(new Error('验证码错误'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

const handleLogin = async () => {
  await formRef.value?.validate()
  const rawPassword = form.value.password
  if (!rawPassword) {
    ElMessage.error('请输入密码')
    return
  }
  loading.value = true
  try {
    const encryptedPassword = encryptStat(rawPassword)
    if (!encryptedPassword) {
      ElMessage.error('加密配置异常，请检查环境变量 VITE_TRACK_STAT_AES_KEY / VITE_TRACK_STAT_AES_IV')
      return
    }
    const res = await login({
      username: form.value.username,
      password: encryptedPassword,
    })
    const data = res.data
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_user', JSON.stringify(data))
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '登录失败'
    ElMessage.error(msg)
    refreshCaptcha()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  drawCaptcha()
})
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1f2933, #111827);
}
.login-card {
  width: 460px;
  padding: 32px 40px;
}
.title {
  text-align: center;
  margin-bottom: 28px;
  font-size: 22px;
}
.captcha-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.captcha-box {
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
  background: #f0f2f5;
}
.captcha-box:hover {
  border-color: var(--el-color-primary);
}
.captcha-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.captcha-refresh {
  cursor: pointer;
  color: var(--el-color-primary);
}
.captcha-refresh:hover {
  text-decoration: underline;
}
</style>

