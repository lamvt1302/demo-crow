/**
 * Ví dụ Backend API sử dụng Node.js + Express
 * File này chỉ để tham khảo, không chạy trực tiếp trong Vue app
 * 
 * Cài đặt:
 * npm install express axios cheerio cors
 * 
 * Chạy:
 * node backend-example.js
 */

const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = 3001

// Endpoint để scrape data từ vbpl.vn
app.get('/api/vbpl/data', async (req, res) => {
  try {
    const url = 'https://vbpl.vn/tw/Pages/home.aspx?dvid=13'
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    const $ = cheerio.load(response.data)
    const documents = []
    
    // Parse HTML sử dụng cheerio
    // Tìm các phần tử chứa thông tin văn bản
    $('body').find('*').each((i, elem) => {
      const text = $(elem).text()
      
      // Tìm các văn bản có pattern
      if (text.match(/^(Thông tư|Nghị định|Nghị quyết)\s+[\d\/\w-]+/)) {
        const titleMatch = text.match(/(Thông tư|Nghị định|Nghị quyết)\s+[\d\/\w-]+/)
        const issuedMatch = text.match(/Ban hành:\s*(\d{2}\/\d{2}\/\d{4})/)
        const effectiveMatch = text.match(/Hiệu lực:\s*(\d{2}\/\d{2}\/\d{4})/)
        const statusMatch = text.match(/Trạng thái:\s*([^\n]+)/)
        
        if (titleMatch) {
          const title = titleMatch[0].trim()
          const summary = text.split(title)[1]?.split('Ban hành:')[0]?.trim() || ''
          
          documents.push({
            title,
            summary: summary.substring(0, 500),
            issuedDate: issuedMatch ? issuedMatch[1] : '',
            effectiveDate: effectiveMatch ? effectiveMatch[1] : '',
            status: statusMatch ? statusMatch[1].trim() : ''
          })
        }
      }
    })
    
    // Loại bỏ duplicates
    const uniqueDocs = documents.filter((doc, index, self) =>
      index === self.findIndex(d => d.title === doc.title)
    )
    
    res.json(uniqueDocs)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Không thể lấy dữ liệu từ website' })
  }
})

app.listen(PORT, () => {
  console.log(`Backend API đang chạy tại http://localhost:${PORT}`)
  console.log(`Endpoint: http://localhost:${PORT}/api/vbpl/data`)
})
