import axios from 'axios'

// URL của backend API (nếu có)
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

/**
 * Service để lấy dữ liệu từ trang vbpl.vn
 * Sử dụng backend API để tránh CORS
 */
export async function downloadVbplData() {
  const url = 'https://vbpl.vn/tw/Pages/home.aspx?dvid=13'
  
  // Ưu tiên sử dụng backend API
  try {
    const backendUrl = `${BACKEND_API_URL}/api/vbpl/data`
    const response = await axios.get(backendUrl, {
      timeout: 30000 // 30 giây timeout
    })
    
    if (response.data && response.data.length > 0) {
      return response.data
    }
  } catch (backendError) {
    console.warn('Backend API không khả dụng, thử CORS proxy...', backendError.message)
  }
  
  // Fallback: Thử các CORS proxy
  const proxyServices = [
    {
      name: 'allorigins',
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      parser: (response) => JSON.parse(response.data.contents)
    },
    {
      name: 'corsproxy',
      url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
      parser: (response) => response.data
    },
    {
      name: 'cors-anywhere',
      url: `https://cors-anywhere.herokuapp.com/${url}`,
      parser: (response) => response.data
    }
  ]
  
  for (const proxy of proxyServices) {
    try {
      console.log(`Đang thử proxy: ${proxy.name}...`)
      const proxyResponse = await axios.get(proxy.url, {
        timeout: 30000,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      const htmlContent = proxy.parser(proxyResponse)
      const documents = parseHtmlData(htmlContent)
      
      if (documents && documents.length > 0) {
        console.log(`Thành công với proxy: ${proxy.name}`)
        return documents
      }
    } catch (proxyError) {
      console.warn(`Proxy ${proxy.name} thất bại:`, proxyError.message)
      continue
    }
  }
  
  throw new Error('Không thể truy cập website. Vui lòng chạy backend API (xem file server.js) hoặc kiểm tra kết nối internet.')
}

/**
 * Parse HTML để lấy thông tin các văn bản
 */
function parseHtmlData(html) {
  const documents = []
  
  // Sử dụng regex để parse từ HTML string (phương pháp đáng tin cậy hơn)
  // Tìm các block văn bản trong phần "Văn bản mới"
  const vbMoiSection = html.match(/Văn bản mới[\s\S]*?(?=Văn bản có hiệu lực|Văn bản được xem nhiều|<\/div>|$)/i)
  const contentToParse = vbMoiSection ? vbMoiSection[0] : html
  
  // Pattern để tìm từng văn bản: tên văn bản + trích yếu + thông tin ban hành/hiệu lực
  // Tìm các pattern như: "Thông tư 08/2026/TT-BCT" hoặc "Nghị định 59/2026/NĐ-CP"
  const documentBlocks = contentToParse.match(/(Thông tư|Nghị định|Nghị quyết|Quyết định|Luật|Bộ luật|Pháp lệnh|Lệnh)\s+[\d\/\w-]+[\s\S]*?(?=(?:Thông tư|Nghị định|Nghị quyết|Quyết định|Luật|Bộ luật|Pháp lệnh|Lệnh)\s+[\d\/\w-]+|Văn bản|$)/gi)
  
  if (documentBlocks && documentBlocks.length > 0) {
    documentBlocks.forEach(block => {
      const doc = parseDocumentBlock(block)
      if (doc) {
        documents.push(doc)
      }
    })
  }
  
  // Nếu không tìm thấy bằng cách trên, thử parse từ HTML DOM
  if (documents.length === 0) {
    return parseFromDom(html)
  }
  
  return documents
}

/**
 * Parse một block HTML chứa thông tin một văn bản
 */
function parseDocumentBlock(block) {
  // Tìm title (ví dụ: "Thông tư 08/2026/TT-BCT")
  const titleMatch = block.match(/(Thông tư|Nghị định|Nghị quyết|Quyết định|Luật|Bộ luật|Pháp lệnh|Lệnh)\s+[\d\/\w-]+/)
  if (!titleMatch) return null
  
  const title = titleMatch[0].trim()
  
  // Loại bỏ HTML tags để lấy text thuần
  const textContent = block.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Tìm trích yếu (phần text giữa title và "Ban hành")
  const banHanhIndex = textContent.indexOf('Ban hành:')
  let summary = ''
  if (banHanhIndex > 0) {
    const titleIndex = textContent.indexOf(title)
    if (titleIndex >= 0) {
      summary = textContent.substring(titleIndex + title.length, banHanhIndex).trim()
    }
  }
  
  // Tìm ngày ban hành
  const issuedMatch = block.match(/Ban hành:\s*(\d{2}\/\d{2}\/\d{4})/)
  const issuedDate = issuedMatch ? issuedMatch[1] : ''
  
  // Tìm ngày hiệu lực
  const effectiveMatch = block.match(/Hiệu lực:\s*(\d{2}\/\d{2}\/\d{4})/)
  const effectiveDate = effectiveMatch ? effectiveMatch[1] : ''
  
  // Tìm trạng thái
  const statusMatch = block.match(/Trạng thái:\s*([^<\n]+)/)
  const status = statusMatch ? statusMatch[1].trim() : ''
  
  return {
    title: title,
    summary: summary || 'Không có trích yếu',
    issuedDate: issuedDate,
    effectiveDate: effectiveDate,
    status: status
  }
}

/**
 * Parse từ DOM (fallback method)
 */
function parseFromDom(html) {
  const documents = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Tìm tất cả các text node chứa pattern văn bản
  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  )
  
  const textNodes = []
  let node
  while (node = walker.nextNode()) {
    if (node.textContent.match(/(Thông tư|Nghị định|Nghị quyết)\s+[\d\/\w-]+/)) {
      textNodes.push(node)
    }
  }
  
  textNodes.forEach(textNode => {
    const parent = textNode.parentElement
    if (parent) {
      const text = parent.textContent || ''
      const doc = extractDocumentInfo(parent, text)
      if (doc && !documents.find(d => d.title === doc.title)) {
        documents.push(doc)
      }
    }
  })
  
  return documents
}

/**
 * Extract thông tin từ một element HTML
 */
function extractDocumentInfo(element, textContent = null) {
  const text = textContent || (element.textContent || '')
  
  // Tìm title (ví dụ: "Thông tư 08/2026/TT-BCT")
  const titleMatch = text.match(/^(Thông tư|Nghị định|Nghị quyết|Quyết định|Luật|Bộ luật)\s+[\d\/\w-]+/)
  if (!titleMatch) return null
  
  const title = titleMatch[0].trim()
  
  // Tìm các thông tin khác
  const summaryMatch = text.match(/Ban hành:[\s\S]*?Hiệu lực:/)
  let summary = ''
  if (summaryMatch) {
    const beforeBanHanh = text.split('Ban hành:')[0]
    summary = beforeBanHanh.replace(title, '').trim()
  } else {
    // Lấy phần text sau title làm summary
    const parts = text.split(title)
    summary = parts[1] ? parts[1].split('Ban hành:')[0].trim() : ''
  }
  
  // Tìm ngày ban hành
  const issuedMatch = text.match(/Ban hành:\s*(\d{2}\/\d{2}\/\d{4})/)
  const issuedDate = issuedMatch ? issuedMatch[1] : ''
  
  // Tìm ngày hiệu lực
  const effectiveMatch = text.match(/Hiệu lực:\s*(\d{2}\/\d{2}\/\d{4})/)
  const effectiveDate = effectiveMatch ? effectiveMatch[1] : ''
  
  // Tìm trạng thái
  const statusMatch = text.match(/Trạng thái:\s*([^\n]+)/)
  const status = statusMatch ? statusMatch[1].trim() : ''
  
  return {
    title: title,
    summary: summary || 'Không có trích yếu',
    issuedDate: issuedDate,
    effectiveDate: effectiveDate,
    status: status
  }
}

/**
 * Parse từ HTML string sử dụng regex (fallback method)
 */
function parseFromHtmlString(html) {
  const documents = []
  
  // Pattern để tìm các văn bản trong HTML
  // Tìm các block chứa thông tin văn bản
  const documentPattern = /(Thông tư|Nghị định|Nghị quyết|Quyết định|Luật|Bộ luật)\s+[\d\/\w-]+[\s\S]*?Ban hành:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]*?Hiệu lực:\s*(\d{2}\/\d{2}\/\d{4})/g
  
  let match
  while ((match = documentPattern.exec(html)) !== null) {
    const fullText = match[0]
    const titleMatch = fullText.match(/^(Thông tư|Nghị định|Nghị quyết|Quyết định|Luật|Bộ luật)\s+[\d\/\w-]+/)
    
    if (titleMatch) {
      const title = titleMatch[0].trim()
      const summary = fullText.split(title)[1]?.split('Ban hành:')[0]?.trim() || 'Không có trích yếu'
      const issuedDate = match[2] || ''
      const effectiveDate = match[3] || ''
      
      const statusMatch = fullText.match(/Trạng thái:\s*([^\n<]+)/)
      const status = statusMatch ? statusMatch[1].trim() : ''
      
      documents.push({
        title,
        summary: summary.substring(0, 500), // Giới hạn độ dài
        issuedDate,
        effectiveDate,
        status
      })
    }
  }
  
  return documents
}
