/**
 * Backend API Server đơn giản để scrape data từ vbpl.vn
 * Chạy lệnh: node server.js
 * Server sẽ chạy tại http://localhost:3001
 */

const express = require('express')
const axios = require('axios')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = 3001

// Endpoint để scrape data từ vbpl.vn
app.get('/api/vbpl/data', async (req, res) => {
  try {
    const url = 'https://vbpl.vn/tw/Pages/home.aspx?dvid=13'
    
    console.log('Đang lấy dữ liệu từ:', url)
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 30000
    })
    
    const html = response.data
    console.log(`Đã nhận được HTML, độ dài: ${html.length} ký tự`)
    
    const documents = parseHtmlData(html)
    
    console.log(`Đã parse được ${documents.length} văn bản`)
    if (documents.length > 0) {
      console.log('Văn bản đầu tiên:', documents[0].title)
    }
    
    res.json(documents)
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu:', error.message)
    res.status(500).json({ 
      error: 'Không thể lấy dữ liệu từ website',
      message: error.message 
    })
  }
})

/**
 * Parse HTML để lấy thông tin các văn bản
 * Cấu trúc HTML thực tế:
 * <li>
 *   <div class="item">
 *     <p class="title">
 *       <a href="/TW/Pages/vbpq-toanvan.aspx?ItemID=...">Title</a>
 *     </p>
 *     <div class="left">
 *       <div class="des">
 *         <p>Trích yếu</p>
 *       </div>
 *     </div>
 *     <div class="right">
 *       <p class="green"><label>Ban hành:</label> DD/MM/YYYY</p>
 *       <p class="green"><label>Hiệu lực:</label> DD/MM/YYYY</p>
 *       <p class="red"><label>Trạng thái:</label> ...</p>
 *     </div>
 *   </div>
 * </li>
 */
function parseHtmlData(html) {
  const documents = []
  
  // Tìm phần "Văn bản mới"
  const vbMoiStart = html.indexOf('Văn bản mới')
  if (vbMoiStart === -1) {
    console.log('❌ Không tìm thấy phần "Văn bản mới" trong HTML')
    return documents
  }
  
  console.log(`✓ Tìm thấy "Văn bản mới" tại vị trí: ${vbMoiStart}`)
  
  // Tìm điểm kết thúc của phần "Văn bản mới"
  const vbMoiEnd = html.indexOf('Văn bản được xem nhiều', vbMoiStart)
  const contentToParse = vbMoiEnd !== -1 
    ? html.substring(vbMoiStart, vbMoiEnd)
    : html.substring(vbMoiStart, vbMoiStart + 100000)
  
  console.log(`✓ Độ dài phần cần parse: ${contentToParse.length} ký tự`)
  
  // Tìm tất cả các <li> chứa <div class="item">
  // Pattern: <li> ... <div class="item"> ... </div> ... </li>
  const itemPattern = /<li>\s*<div\s+class="item">([\s\S]*?)<\/div>\s*<\/li>/gi
  
  let itemMatch
  const seenTitles = new Set()
  
  while ((itemMatch = itemPattern.exec(contentToParse)) !== null) {
    const itemHtml = itemMatch[1]
    
    // Parse từng item
    const doc = parseDocumentItem(itemHtml)
    
    if (doc && doc.title && !seenTitles.has(doc.title)) {
      seenTitles.add(doc.title)
      documents.push(doc)
      console.log(`  ✓ Đã parse: ${doc.title}`)
    }
  }
  
  console.log(`✓ Đã parse thành công ${documents.length} văn bản`)
  
  return documents
}

/**
 * Parse một item HTML chứa thông tin một văn bản
 */
function parseDocumentItem(itemHtml) {
  // 1. Tìm title trong <p class="title"> > <a>...</a>
  const titleMatch = itemHtml.match(/<p\s+class="title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
  if (!titleMatch) {
    return null
  }
  
  const title = titleMatch[1].trim()
  
  // Kiểm tra xem có phải là tên văn bản không
  if (!title.match(/(Thông tư|Nghị định|Nghị quyết|Quyết định|Luật|Bộ luật|Pháp lệnh|Lệnh)\s+[\d\/\w-]+/i)) {
    return null
  }
  
  // 2. Tìm trích yếu trong <div class="des"> > <p>...</p>
  let summary = ''
  const desMatch = itemHtml.match(/<div\s+class="des">[\s\S]*?<p>([\s\S]*?)<\/p>/i)
  if (desMatch) {
    summary = desMatch[1]
      .replace(/<[^>]+>/g, ' ') // Loại bỏ HTML tags
      .replace(/\s+/g, ' ') // Chuẩn hóa whitespace
      .trim()
  }
  
  // 3. Tìm ngày ban hành trong <div class="right"> > <p class="green"> > <label>Ban hành:</label> DD/MM/YYYY
  let issuedDate = ''
  const banHanhMatch = itemHtml.match(/<label>\s*Ban hành:\s*<\/label>\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (banHanhMatch) {
    issuedDate = banHanhMatch[1]
  }
  
  // 4. Tìm ngày hiệu lực trong <div class="right"> > <p class="green"> > <label>Hiệu lực:</label> DD/MM/YYYY
  let effectiveDate = ''
  const hieuLucMatch = itemHtml.match(/<label>\s*Hiệu lực:\s*<\/label>\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (hieuLucMatch) {
    effectiveDate = hieuLucMatch[1]
  }
  
  // 5. Tìm trạng thái trong <div class="right"> > <p class="red"> > <label>Trạng thái:</label> ...
  let status = ''
  const trangThaiMatch = itemHtml.match(/<label>\s*Trạng thái:\s*<\/label>\s*([^<]+)/i)
  if (trangThaiMatch) {
    status = trangThaiMatch[1].trim()
  }
  
  return {
    title: title,
    summary: summary || 'Không có trích yếu',
    issuedDate: issuedDate,
    effectiveDate: effectiveDate,
    status: status
  }
}

// Endpoint debug để xem HTML của phần "Văn bản mới"
app.get('/api/vbpl/debug', async (req, res) => {
  try {
    const url = 'https://vbpl.vn/tw/Pages/home.aspx?dvid=13'
    
    console.log('Đang lấy dữ liệu từ:', url)
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 30000
    })
    
    const html = response.data
    
    // Tìm phần "Văn bản mới"
    const vbMoiStart = html.indexOf('Văn bản mới')
    const vbMoiEnd = html.indexOf('Văn bản được xem nhiều', vbMoiStart)
    const vbMoiSection = vbMoiEnd !== -1 
      ? html.substring(vbMoiStart, vbMoiEnd)
      : html.substring(vbMoiStart, vbMoiStart + 50000)
    
    // Lưu vào file để debug
    const debugFile = path.join(__dirname, 'debug-html.html')
    fs.writeFileSync(debugFile, vbMoiSection, 'utf8')
    
    console.log(`Đã lưu HTML debug vào: ${debugFile}`)
    console.log(`Độ dài phần "Văn bản mới": ${vbMoiSection.length} ký tự`)
    
    // Trả về một phần HTML để xem
    const preview = vbMoiSection.substring(0, Math.min(5000, vbMoiSection.length))
    
    res.json({
      message: 'Đã lưu HTML vào file debug-html.html',
      filePath: debugFile,
      preview: preview,
      fullLength: vbMoiSection.length
    })
  } catch (error) {
    console.error('Lỗi:', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`\n✅ Backend API Server đang chạy tại http://localhost:${PORT}`)
  console.log(`📡 Endpoint: http://localhost:${PORT}/api/vbpl/data`)
  console.log(`🐛 Debug endpoint: http://localhost:${PORT}/api/vbpl/debug\n`)
})
