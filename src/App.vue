<template>
  <div class="app-container">
    <div class="header">
      <h1>Download Dữ liệu Văn bản Pháp luật</h1>
      <p>Tải dữ liệu từ mục "Văn bản mới" từ vbpl.vn</p>
    </div>
    
    <div class="content">
      <button 
        @click="downloadData" 
        :disabled="loading"
        class="download-btn"
      >
        <span v-if="!loading">📥 Tải Dữ liệu Excel</span>
        <span v-else>⏳ Đang tải...</span>
      </button>
      
      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
      
      <div v-if="data.length > 0" class="data-preview">
        <h3>Dữ liệu đã tải ({{ data.length }} văn bản):</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Tên văn bản</th>
                <th>Trích yếu</th>
                <th>Ban hành</th>
                <th>Hiệu lực</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in data.slice(0, 5)" :key="index">
                <td>{{ index + 1 }}</td>
                <td>{{ item.title }}</td>
                <td class="trich-yeu">{{ item.summary.substring(0, 100) }}...</td>
                <td>{{ item.issuedDate }}</td>
                <td>{{ item.effectiveDate }}</td>
                <td>{{ item.status || 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="data.length > 5" class="more-data">... và {{ data.length - 5 }} văn bản khác</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { downloadVbplData } from './services/vbplService'
import { exportToExcel } from './utils/excelExport'

export default {
  name: 'App',
  setup() {
    const loading = ref(false)
    const message = ref('')
    const messageType = ref('')
    const data = ref([])

    const downloadData = async () => {
      loading.value = true
      message.value = ''
      messageType.value = ''
      data.value = []

      try {
        message.value = 'Đang lấy dữ liệu từ website...'
        messageType.value = 'info'
        
        const documents = await downloadVbplData()
        
        if (documents.length === 0) {
          message.value = 'Không tìm thấy dữ liệu nào!'
          messageType.value = 'warning'
          loading.value = false
          return
        }

        data.value = documents
        message.value = `Đã tải thành công ${documents.length} văn bản. Đang xuất file Excel...`
        messageType.value = 'success'

        // Export to Excel
        await exportToExcel(documents)
        
        message.value = `Đã xuất thành công ${documents.length} văn bản ra file Excel!`
        messageType.value = 'success'
        
      } catch (error) {
        console.error('Error:', error)
        message.value = `Lỗi: ${error.message || 'Không thể tải dữ liệu. Có thể do CORS hoặc website không khả dụng.'}`
        messageType.value = 'error'
      } finally {
        loading.value = false
      }
    }

    return {
      loading,
      message,
      messageType,
      data,
      downloadData
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  text-align: center;
}

.header h1 {
  font-size: 28px;
  margin-bottom: 10px;
}

.header p {
  font-size: 16px;
  opacity: 0.9;
}

.content {
  padding: 40px;
}

.download-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 15px 40px;
  font-size: 18px;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  display: block;
  margin: 0 auto 30px;
}

.download-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.download-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: 500;
}

.message.info {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
}

.message.success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.message.warning {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffcc80;
}

.message.error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

.data-preview {
  margin-top: 30px;
}

.data-preview h3 {
  margin-bottom: 15px;
  color: #333;
}

.table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

thead {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
}

td {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
}

tbody tr:hover {
  background: #f5f5f5;
}

.trich-yeu {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-data {
  padding: 10px;
  text-align: center;
  color: #666;
  font-style: italic;
}
</style>
