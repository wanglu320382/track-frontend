<template>
  <div class="optimization-suggestion-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>优化建议</span>
          <el-button type="primary" @click="openCreate">新增建议</el-button>
        </div>
      </template>
      <el-form :inline="true" :model="queryForm" class="query-form">
        <el-form-item label="状态">
          <el-select v-model="queryForm.status" clearable placeholder="全部状态" style="width: 140px">
            <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="queryForm.keyword"
            clearable
            placeholder="模糊匹配标题/痛点/改善建议/提出人"
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
        <el-table-column prop="title" label="标题" min-width="140" show-overflow-tooltip />
        <el-table-column label="痛点" min-width="180">
          <template #default="{ row }">
            <el-tooltip placement="top-start" :show-after="400">
              <template #content>
                <pre class="cell-pre">{{ row.painPoint }}</pre>
              </template>
              <span class="cell-short">{{ formatShort(row.painPoint) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="改善建议" min-width="180">
          <template #default="{ row }">
            <el-tooltip placement="top-start" :show-after="400">
              <template #content>
                <pre class="cell-pre">{{ row.improvementSuggestion }}</pre>
              </template>
              <span class="cell-short">{{ formatShort(row.improvementSuggestion) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="proposer" label="提出人" width="110" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="提出时间" width="180" />
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
      <el-form :model="form" label-width="88px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="痛点">
          <el-input v-model="form.painPoint" type="textarea" :rows="4" placeholder="请描述痛点" />
        </el-form-item>
        <el-form-item label="改善建议">
          <el-input v-model="form.improvementSuggestion" type="textarea" :rows="4" placeholder="请填写改善建议" />
        </el-form-item>
        <el-form-item label="提出人">
          <el-input v-model="form.proposer" placeholder="提出人姓名" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item v-if="editingId" label="状态">
          <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
            <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-alert v-else type="info" :closable="false" show-icon title="新建后状态默认为「审核中」，保存后可在编辑中修改状态。" />
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
import {
  OPTIMIZATION_STATUSES,
  pageOptimizationSuggestion,
  createOptimizationSuggestion,
  updateOptimizationSuggestion,
  deleteOptimizationSuggestion,
  type OptimizationSuggestionItem
} from '@/api/optimizationSuggestion'

const statusOptions = [...OPTIMIZATION_STATUSES]

const list = ref<OptimizationSuggestionItem[]>([])
const loading = ref(false)
const total = ref(0)
const queryForm = reactive({
  status: '' as string,
  keyword: ''
})
const page = reactive({
  current: 1,
  size: 10
})

const dialogVisible = ref(false)
const dialogTitle = ref('新增建议')
const saving = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  title: '',
  painPoint: '',
  improvementSuggestion: '',
  proposer: '',
  status: '审核中' as string
})

const statusTagType = (status: string) => {
  switch (status) {
    case '审核中':
      return 'warning'
    case '开发中':
      return 'primary'
    case '已上线':
      return 'success'
    case '不优化':
      return 'info'
    default:
      return undefined
  }
}

const formatShort = (text: string) => {
  const oneLine = (text || '').replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 64) return oneLine || '—'
  return `${oneLine.slice(0, 64)}...`
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await pageOptimizationSuggestion({
      keyword: queryForm.keyword,
      status: queryForm.status || undefined,
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
  queryForm.status = ''
  queryForm.keyword = ''
  page.current = 1
  await loadList()
}

const openCreate = () => {
  dialogTitle.value = '新增建议'
  editingId.value = null
  form.title = ''
  form.painPoint = ''
  form.improvementSuggestion = ''
  form.proposer = ''
  form.status = '审核中'
  dialogVisible.value = true
}

const openEdit = (row: OptimizationSuggestionItem) => {
  dialogTitle.value = '编辑建议'
  editingId.value = row.id
  form.title = row.title
  form.painPoint = row.painPoint
  form.improvementSuggestion = row.improvementSuggestion
  form.proposer = row.proposer
  form.status = row.status || '审核中'
  dialogVisible.value = true
}

const submit = async () => {
  const title = form.title.trim()
  const pain = form.painPoint.trim()
  const improve = form.improvementSuggestion.trim()
  const proposer = form.proposer.trim()
  if (!title) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!pain) {
    ElMessage.warning('请输入痛点')
    return
  }
  if (!improve) {
    ElMessage.warning('请输入改善建议')
    return
  }
  if (!proposer) {
    ElMessage.warning('请输入提出人')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateOptimizationSuggestion(editingId.value, {
        title,
        painPoint: pain,
        improvementSuggestion: improve,
        proposer,
        status: form.status
      })
    } else {
      await createOptimizationSuggestion({
        title,
        painPoint: pain,
        improvementSuggestion: improve,
        proposer
      })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadList()
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = (row: OptimizationSuggestionItem) => {
  ElMessageBox.confirm(`确认删除建议「${row.title}」吗？`, '提示', {
    type: 'warning'
  })
    .then(async () => {
      await deleteOptimizationSuggestion(row.id)
      ElMessage.success('删除成功')
      await loadList()
    })
    .catch(() => {})
}

onMounted(() => {
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
.optimization-suggestion-manage {
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
.cell-pre {
  margin: 0;
  max-width: 480px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
}
.cell-short {
  cursor: default;
}
</style>
