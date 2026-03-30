<template>
  <div class="datasource-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据源列表</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增数据源
          </el-button>
        </div>
      </template>
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="type" label="类型" min-width="120" />
        <el-table-column prop="host" label="主机" min-width="160" />
        <el-table-column prop="port" label="端口" min-width="80" />
        <el-table-column prop="databaseName" label="数据库" min-width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleTest(row)">测试</el-button>
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑数据源' : '新增数据源'" width="500px" @close="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="数据源名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="选择类型" style="width: 100%">
            <el-option label="MySQL" value="MYSQL" />
            <el-option label="Oracle" value="ORACLE" />
            <el-option label="OceanBase(MySQL)" value="OCEANBASE_MYSQL" />
            <el-option label="OceanBase(Oracle)" value="OCEANBASE_ORACLE" />
            <el-option label="Redis" value="REDIS" />
          </el-select>
        </el-form-item>
        <el-form-item label="主机" prop="host">
          <el-input v-model="form.host" placeholder="host 或 ip" />
        </el-form-item>
        <el-form-item label="端口" prop="port">
          <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 100%" />
        </el-form-item>
        <template v-if="form.type !== 'REDIS'">
          <el-form-item v-if="form.type === 'ORACLE'" label="连接方式">
            <el-radio-group v-model="form.oracleConnectMode">
              <el-radio value="SID">SID</el-radio>
              <el-radio value="SERVICE_NAME">Service Name</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="oracleDbLabel" prop="databaseName">
            <el-input
              v-model="form.databaseName"
              :placeholder="oracleDbPlaceholder"
            />
          </el-form-item>
        </template>
        <el-form-item label="用户名" prop="username" v-if="form.type !== 'REDIS'">
          <el-input v-model="form.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码（Redis 可选）" show-password />
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
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { listDatasources, saveDatasource, updateDatasource, removeDatasource, testDatasource } from '@/api/datasource'
import type { DatasourceConfig } from '@/types/datasource'

const list = ref<DatasourceConfig[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const form = ref<Partial<DatasourceConfig>>({
  name: '',
  type: 'MYSQL',
  host: '',
  port: 3306,
  databaseName: '',
  oracleConnectMode: 'SID',
  username: '',
  password: undefined
})

const oracleDbLabel = computed(() => {
  if (form.value.type === 'ORACLE') {
    return form.value.oracleConnectMode === 'SERVICE_NAME' ? 'Service Name' : 'SID'
  }
  return '数据库'
})

const oracleDbPlaceholder = computed(() => {
  if (form.value.type === 'ORACLE') {
    return form.value.oracleConnectMode === 'SERVICE_NAME' ? '如 ORCLPDB1 或 pdb.example.com' : '如 XE、ORCL'
  }
  return '数据库名 / schema'
})

watch(
  () => form.value.type,
  (t) => {
    if (t === 'ORACLE' && form.value.oracleConnectMode == null) {
      form.value.oracleConnectMode = 'SID'
    }
  }
)

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  host: [{ required: true, message: '请输入主机', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }]
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await listDatasources()
    list.value = res.data || []
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  isEdit.value = false
  form.value = {
    name: '',
    type: 'MYSQL',
    host: '',
    port: 3306,
    databaseName: '',
    oracleConnectMode: 'SID',
    username: '',
    password: undefined
  }
  dialogVisible.value = true
}

const handleEdit = (row: DatasourceConfig) => {
  isEdit.value = true
  form.value = {
    ...row,
    password: undefined,
    oracleConnectMode: row.type === 'ORACLE' ? row.oracleConnectMode ?? 'SID' : row.oracleConnectMode
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  try {
    if (isEdit.value && form.value.id) {
      await updateDatasource(form.value as import('@/api/datasource').DatasourceConfig)
      ElMessage.success('更新成功')
    } else {
      await saveDatasource(form.value as import('@/api/datasource').DatasourceConfig)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadList()
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '操作失败'
    ElMessage.error(msg)
  }
}

const handleTest = async (row: DatasourceConfig) => {
  try {
    const res = await testDatasource(row.id!)
    ElMessage[res.data ? 'success' : 'error'](res.data ? '连接成功' : '连接失败')
  } catch {
    ElMessage.error('连接失败')
  }
}

const handleDelete = async (row: DatasourceConfig) => {
  await ElMessageBox.confirm('确定删除该数据源？', '提示', { type: 'warning' })
  try {
    await removeDatasource(row.id!)
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
