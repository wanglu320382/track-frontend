<template>
  <div class="common-sql-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>常用 SQL 管理</span>
          <el-button type="primary" @click="openCreate">新增常用 SQL</el-button>
        </div>
      </template>
      <el-table :data="list" stripe border style="width: 100%" v-loading="loading">
        <el-table-column label="数据源" width="180">
          <template #default="{ row }">
            {{ getDatasourceName(row.datasourceId) }}
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="160" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="SQL" min-width="320">
          <template #default="{ row }">
            <el-tooltip placement="top-start">
              <template #content>
                <pre class="sql-pre">{{ row.sqlText }}</pre>
              </template>
              <span class="sql-short">{{ formatSqlShort(row.sqlText) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="180" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="数据源">
          <el-select v-model="form.datasourceId" placeholder="请选择数据源" filterable style="width: 100%">
            <el-option v-for="ds in datasources" :key="ds.id" :label="`${ds.name} (${ds.type})`" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="可选，简单说明用途" />
        </el-form-item>
        <el-form-item label="SQL">
          <el-input
            v-model="form.sqlText"
            type="textarea"
            :rows="10"
            placeholder="请输入要保存的 SQL，只支持 SELECT 查询"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="submit" :loading="saving">保 存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createCommonSql, deleteCommonSql, listCommonSql, updateCommonSql, type CommonSqlItem } from '@/api/commonSql'
import { listDatasources } from '@/api/datasource'
import type { DatasourceConfig } from '@/types/datasource'

const list = ref<CommonSqlItem[]>([])
const loading = ref(false)
const datasources = ref<DatasourceConfig[]>([])

const dialogVisible = ref(false)
const dialogTitle = ref('新增常用 SQL')
const saving = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  datasourceId: null as number | null,
  title: '',
  description: '',
  sqlText: ''
})

const loadList = async () => {
  loading.value = true
  try {
    const res = await listCommonSql(undefined)
    list.value = res.data || []
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '加载失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const loadDatasources = async () => {
  try {
    const res = await listDatasources()
    datasources.value = res.data || []
  } catch {
    datasources.value = []
  }
}

const getDatasourceName = (id: number | null | undefined) => {
  if (id == null) return '-'
  const ds = datasources.value.find((d) => d.id === id)
  return ds ? `${ds.name} (${ds.type})` : `ID:${id}`
}

const openCreate = () => {
  dialogTitle.value = '新增常用 SQL'
  editingId.value = null
  form.datasourceId = null
  form.title = ''
  form.description = ''
  form.sqlText = ''
  dialogVisible.value = true
}

const openEdit = (row: CommonSqlItem) => {
  dialogTitle.value = '编辑常用 SQL'
  editingId.value = row.id
  form.datasourceId = row.datasourceId ?? null
  form.title = row.title
  form.description = row.description || ''
  form.sqlText = row.sqlText
  dialogVisible.value = true
}

const submit = async () => {
  const sqlTrim = form.sqlText.trim()
  if (form.datasourceId == null) {
    ElMessage.warning('请选择数据源')
    return
  }
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!sqlTrim) {
    ElMessage.warning('请输入 SQL')
    return
  }
  if (!sqlTrim.toUpperCase().startsWith('SELECT')) {
    ElMessage.warning('仅支持 SELECT 查询')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateCommonSql(editingId.value, {
        datasourceId: form.datasourceId,
        title: form.title.trim(),
        sqlText: sqlTrim,
        description: form.description?.trim() || undefined
      })
    } else {
      await createCommonSql({
        datasourceId: form.datasourceId,
        title: form.title.trim(),
        sqlText: sqlTrim,
        description: form.description?.trim() || undefined
      })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadList()
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '保存失败'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}

const handleDelete = (row: CommonSqlItem) => {
  ElMessageBox.confirm(`确认删除常用 SQL「${row.title}」吗？`, '提示', {
    type: 'warning'
  })
    .then(async () => {
      await deleteCommonSql(row.id)
      ElMessage.success('删除成功')
      await loadList()
    })
    .catch(() => {})
}

const formatSqlShort = (sql: string) => {
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 80) return oneLine
  return `${oneLine.slice(0, 80)}...`
}

onMounted(() => {
  loadDatasources()
  loadList()
})
</script>

<style scoped>
.common-sql-manage {
  padding: 4px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sql-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
.sql-short {
  cursor: pointer;
}
</style>

