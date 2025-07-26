const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/taixiu', async (req, res) => {
  try {
    // 1. Gọi API với timeout 5s và headers rõ ràng
    const response = await axios.get('https://saobody-lopq.onrender.com/api/taixiu/history', {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TaiXiu-API-Proxy/1.0'
      }
    });

    // 2. Debug: Log raw response để kiểm tra
    console.log('Raw API response:', {
      status: response.status,
      headers: response.headers,
      data: response.data
    });

    // 3. Xử lý response data
    let data = response.data;
    
    // Nếu data không phải array nhưng là object hợp lệ
    if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
      data = [data]; // Chuyển thành array
    }

    // 4. Kiểm tra dữ liệu cuối cùng
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format from API');
    }

    // 5. Transform data
    const transformedData = data.map(item => ({
      phien: item.session || 0,
      xuc_xac_1: item.dice?.[0] || 0,
      xuc_xac_2: item.dice?.[1] || 0,
      xuc_xac_3: item.dice?.[2] || 0,
      Tong: item.total || 0,
      Ket_qua: item.result || 'Unknown',
      thoi_gian: item.timestamp || new Date().toISOString()
    }));

    // 6. Trả về kết quả
    res.json({
      success: true,
      count: transformedData.length,
      data: transformedData
    });

  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(port, () => {
  console.log(`Server ready at http://localhost:${port}/taixiu`);
});
