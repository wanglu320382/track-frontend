<template>
  <div class="common-stat-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>常用查询管理</span>
          <el-button type="primary" @click="openCreate">新增常用查询</el-button>
        </div>
      </template>
      <el-form :inline="true" :model="queryForm" class="query-form">
        <el-form-item label="数据源">
          <el-select v-model="queryForm.datasourceId" clearable placeholder="全部数据源" style="width: 240px" filterable>
            <el-option v-for="ds in datasources" :key="ds.id" :label="`${ds.name} (${ds.type})`" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="queryForm.keyword"
            clearable
            placeholder="模糊匹配标题/描述/语句"
            style="width: 320px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" stripe border style="width: 100%" v-loading="loading">
        <el-table-column label="数据源" width="180">
          <template #default="{ row }">
            {{ getDatasourceName(row.datasourceId) }}
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="160" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="语句" min-width="320">
          <template #default="{ row }">
            <el-tooltip placement="top-start">
              <template #content>
                <pre class="stat-pre">{{ row.statText }}</pre>
              </template>
              <span class="stat-short">{{ formatStatShort(row.statText) }}</span>
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
      <div class="pager-wrap">
        <el-pagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
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
        <el-form-item label="语句">
          <el-input
            v-model="form.statText"
            type="textarea"
            :rows="10"
            placeholder="请输入要保存的查询语句，只支持 SELECT"
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
import { createCommonStat, deleteCommonStat, pageCommonStat, updateCommonStat, type CommonStatItem } from '@/api/commonStat'
import { listDatasources } from '@/api/datasource'
import type { DatasourceConfig } from '@/types/datasource'

const list = ref<CommonStatItem[]>([])
const loading = ref(false)
const datasources = ref<DatasourceConfig[]>([])
const total = ref(0)
const queryForm = reactive({
  datasourceId: null as number | null,
  keyword: ''
})
const page = reactive({
  current: 1,
  size: 10
})

const dialogVisible = ref(false)
const dialogTitle = ref('新增常用查询')
const saving = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  datasourceId: null as number | null,
  title: '',
  description: '',
  statText: ''
})

const loadList = async () => {
  loading.value = true
  try {
    const res = await pageCommonStat({
      datasourceId: queryForm.datasourceId,
      keyword: queryForm.keyword,
      pageNum: page.current,
      pageSize: page.size
    })
    list.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  page.current = 1
  await loadList()
}

const handleReset = async () => {
  queryForm.datasourceId = null
  queryForm.keyword = ''
  page.current = 1
  await loadList()
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
  dialogTitle.value = '新增常用查询'
  editingId.value = null
  form.datasourceId = null
  form.title = ''
  form.description = ''
  form.statText = ''
  dialogVisible.value = true
}

const openEdit = (row: CommonStatItem) => {
  dialogTitle.value = '编辑常用查询'
  editingId.value = row.id
  form.datasourceId = row.datasourceId ?? null
  form.title = row.title
  form.description = row.description || ''
  form.statText = row.statText
  dialogVisible.value = true
}

const submit = async () => {
  const statTrim = form.statText.trim()
  if (form.datasourceId == null) {
    ElMessage.warning('请选择数据源')
    return
  }
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!statTrim) {
    ElMessage.warning('请输入查询语句')
    return
  }
  if (!statTrim.toUpperCase().startsWith('SELECT')) {
    ElMessage.warning('仅支持 SELECT 查询')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateCommonStat(editingId.value, {
        datasourceId: form.datasourceId,
        title: form.title.trim(),
        statText: statTrim,
        description: form.description?.trim() || undefined
      })
    } else {
      await createCommonStat({
        datasourceId: form.datasourceId,
        title: form.title.trim(),
        statText: statTrim,
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

const handleDelete = (row: CommonStatItem) => {
  ElMessageBox.confirm(`确认删除常用查询「${row.title}」吗？`, '提示', {
    type: 'warning'
  })
    .then(async () => {
      await deleteCommonStat(row.id)
      ElMessage.success('删除成功')
      await loadList()
    })
    .catch(() => {})
}

const formatStatShort = (plain: string) => {
  const oneLine = plain.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 80) return oneLine
  return `${oneLine.slice(0, 80)}...`
}

onMounted(() => {
  loadDatasources()
  loadList()
})

const onPageChange = async (cur: number) => {
  page.current = cur
  await loadList()
}

const onSizeChange = async (size: number) => {
  page.size = size
  page.current = 1
  await loadList()
}
</script>

<style scoped>
.common-stat-manage {
  padding: 4px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.query-form {
  margin-bottom: 12px;
}
.pager-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.stat-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
.stat-short {
  cursor: pointer;
}
</style>
