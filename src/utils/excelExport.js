import * as XLSX from 'xlsx'

/**
 * Export dữ liệu ra file Excel
 */
export function exportToExcel(data) {
  if (!data || data.length === 0) {
    throw new Error('Không có dữ liệu để xuất')
  }

  // Chuẩn bị dữ liệu cho Excel
  const excelData = data.map((item, index) => ({
    'STT': index + 1,
    'Tên văn bản': item.title || '',
    'Trích yếu': item.summary || '',
    'Ngày ban hành': item.issuedDate || '',
    'Ngày hiệu lực': item.effectiveDate || '',
    'Trạng thái': item.status || ''
  }))

  // Tạo workbook và worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Văn bản mới')

  // Điều chỉnh độ rộng cột
  const columnWidths = [
    { wch: 5 },   // STT
    { wch: 30 },  // Tên văn bản
    { wch: 80 },  // Trích yếu
    { wch: 15 },  // Ngày ban hành
    { wch: 15 },  // Ngày hiệu lực
    { wch: 20 }   // Trạng thái
  ]
  worksheet['!cols'] = columnWidths

  // Tạo tên file với timestamp
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = `Van_ban_moi_${timestamp}.xlsx`

  // Xuất file
  XLSX.writeFile(workbook, filename)
  
  return filename
}
