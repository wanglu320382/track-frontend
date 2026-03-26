/**
 * 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAdmin?: boolean
  }
}
import Layout from '../views/Layout.vue'
import Login from '../views/Login.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { title: '登录' },
    },
    {
      path: '/',
      component: Layout,
      redirect: '/datasource',
      children: [
        { path: 'datasource', name: 'Datasource', component: () => import('../views/DatasourceList.vue'), meta: { title: '数据源管理' } },
        { path: 'metadata', name: 'Metadata', component: () => import('../views/MetadataView.vue'), meta: { title: '表结构与注释' } },
        { path: 'query', name: 'DataQuery', component: () => import('../views/DataQuery.vue'), meta: { title: '数据查询' } },
        {
          path: 'common-stat',
          name: 'CommonStatManage',
          component: () => import('../views/CommonStatManage.vue'),
          meta: { title: '常用查询管理' },
        },
        {
          path: 'users',
          name: 'UserManage',
          component: () => import('../views/UserManage.vue'),
          meta: { title: '用户管理', requiresAdmin: true },
        },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  if (to.path === '/login') {
    next()
    return
  }
  const token = localStorage.getItem('auth_token')
  if (!token) {
    next({ path: '/login' })
    return
  }
  const userStr = localStorage.getItem('auth_user')
  if (to.matched.some((record) => record.meta.requiresAdmin)) {
    try {
      const user = userStr ? JSON.parse(userStr) : null
      if (!user || user.role !== 'ADMIN') {
        next({ path: '/datasource' })
        return
      }
    } catch {
      next({ path: '/datasource' })
      return
    }
  }
  next()
})

export default router
