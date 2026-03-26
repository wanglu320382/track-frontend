<template>
  <div class="user-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增用户
          </el-button>
        </div>
      </template>
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
        <el-table-column prop="role" label="角色" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="handleResetPassword(row)">重置密码</el-button>
            <el-button link type="danger" :disabled="row.username === 'admin'" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="500px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="显示昵称" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" placeholder="选择角色" style="width: 100%">
            <el-option label="管理员" value="ADMIN" />
            <el-option label="普通用户" value="USER" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="初始密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { listUsers, createUser, updateUser, resetPassword, deleteUser, type SysUser } from '@/api/user'

const list = ref<SysUser[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const form = ref<Partial<SysUser> & { password?: string }>({
  username: '',
  nickname: '',
  role: 'ADMIN',
  status: 1,
  password: undefined,
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [
    {
      required: () => !isEdit.value,
      message: '请输入密码',
      trigger: 'blur',
    } as unknown as import('async-validator').RuleItem,
  ],
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await listUsers()
    list.value = res.data || []
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  isEdit.value = false
  form.value = { username: '', nickname: '', role: 'ADMIN', status: 1, password: undefined }
  dialogVisible.value = true
}

const handleEdit = (row: SysUser) => {
  isEdit.value = true
  form.value = { id: row.id, username: row.username, nickname: row.nickname, role: row.role, status: row.status }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  try {
    if (isEdit.value && form.value.id) {
      await updateUser({
        id: form.value.id,
        nickname: form.value.nickname || '',
        role: form.value.role as string,
        status: form.value.status as number,
      })
      ElMessage.success('更新成功')
    } else {
      if (!form.value.password) {
        ElMessage.warning('请输入密码')
        return
      }
      await createUser({
        username: form.value.username as string,
        password: form.value.password as string,
        nickname: form.value.nickname || '',
        role: form.value.role as string,
        status: form.value.status as number,
      })
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadList()
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '操作失败'
    ElMessage.error(msg)
  }
}

const handleResetPassword = async (row: SysUser) => {
  const { value } = await ElMessageBox.prompt('请输入新密码', '重置密码', {
    inputType: 'password',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
  if (!value) return
  try {
    await resetPassword(row.id!, value)
    ElMessage.success('密码已重置')
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '重置失败'
    ElMessage.error(msg)
  }
}

const handleDelete = async (row: SysUser) => {
  await ElMessageBox.confirm('确定删除该用户？', '提示', { type: 'warning' })
  try {
    await deleteUser(row.id!)
    ElMessage.success('删除成功')
    loadList()
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '删除失败'
    ElMessage.error(msg)
  }
}

const resetForm = () => {
  formRef.value?.resetFields()
}

onMounted(loadList)
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

