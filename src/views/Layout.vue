<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">问题溯源系统</div>
      <el-menu
        :default-active="$route.path"
        router
        background-color="#1a1d24"
        text-color="#a3a6ad"
        active-text-color="#409eff"
      >
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/datasource">
          <el-icon><Connection /></el-icon>
          <span>数据源管理</span>
        </el-menu-item>
        <el-menu-item index="/metadata">
          <el-icon><Document /></el-icon>
          <span>表结构与元数据</span>
        </el-menu-item>
        <el-menu-item index="/json-parse">
          <el-icon><Document /></el-icon>
          <span>json解析</span>
        </el-menu-item>
        <el-menu-item index="/query">
          <el-icon><Search /></el-icon>
          <span>数据查询</span>
        </el-menu-item>
        <el-menu-item index="/common-stat">
          <el-icon><Document /></el-icon>
          <span>常用查询管理</span>
        </el-menu-item>
        <el-menu-item index="/optimization-suggestion">
          <el-icon><ChatDotRound /></el-icon>
          <span>优化建议</span>
        </el-menu-item>
        <el-menu-item v-if="currentUserRole === 'ADMIN'" index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="title">{{ routeMeta?.title || '问题溯源系统' }}</span>
        <div class="header-right">
          <span class="user-name">{{ currentUserName }}</span>
          <el-button type="text" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { House, Connection, Document, Search, User, ChatDotRound } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const routeMeta = computed(() => route.meta)

type UserRole = 'ADMIN' | 'USER'

interface AuthUser {
  nickname?: string
  username?: string
  role?: UserRole
}

const VALID_ROLES: ReadonlySet<UserRole> = new Set(['ADMIN', 'USER'])

const getStoredAuthUser = (): AuthUser | null => {
  const userStr = localStorage.getItem('auth_user')
  if (!userStr) return null
  try {
    const rawUser = JSON.parse(userStr) as Partial<AuthUser>
    if (!rawUser || typeof rawUser !== 'object') return null
    const role = typeof rawUser.role === 'string' && VALID_ROLES.has(rawUser.role as UserRole) ? (rawUser.role as UserRole) : undefined
    const nickname = typeof rawUser.nickname === 'string' ? rawUser.nickname : undefined
    const username = typeof rawUser.username === 'string' ? rawUser.username : undefined
    return { nickname, username, role }
  } catch {
    return null
  }
}

const currentUserName = computed(() => {
  const user = getStoredAuthUser()
  return user?.nickname || user?.username || ''
})

const currentUserRole = computed(() => getStoredAuthUser()?.role || '')

const handleLogout = () => {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  ElMessage.success('已退出登录')
  router.push('/login')
}

onMounted(() => {
  const token = localStorage.getItem('auth_token')
  const user = getStoredAuthUser()
  if (!token || !user?.role) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    router.replace('/login')
  }
})
</script>

<style scoped>
.layout {
  height: 100vh;
}
.aside {
  background: #1a1d24;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
.header {
  background: #fff;
  border-bottom: 1px solid #e6e8eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 18px;
  font-weight: 500;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  color: #606266;
}
.main {
  background: #f5f7fa;
  padding: 20px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
