<template>
  <div class="home">
    <el-card>
      <template #header>
        <span>欢迎使用问题溯源系统</span>
      </template>
      <p>本系统用于定位不同系统的数据问题，支持：</p>
      <ul>
        <li><strong>数据源管理</strong>：配置 Oracle、MySQL、OceanBase、Redis 等数据源</li>
        <li><strong>表结构与注释</strong>：查看各数据源的表结构、字段类型、注释信息</li>
        <li><strong>灵活数据查询</strong>：根据表名灵活查询对应数据</li>
      </ul>
      <el-divider />
      <p>请从左侧菜单选择功能开始使用。</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.home ul {
  line-height: 2;
  color: #606266;
}
</style>
