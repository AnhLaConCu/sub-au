const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/taixiu', async (req, res) => {
  try {
    // 1. Thêm try-catch riêng cho request API
    let response;
    try {
      response = await axios.get('https://saobody-lopq.onrender.com/api/taixiu/history', {
        timeout: 10000,
        responseType: 'text' // Nhận dạng text trước để tự parse thủ công
      });
    } catch (apiError) {
      console.error('API Request Error:', apiError.message);
      throw new Error(`Could not reach API: ${apiError.message}`);
    }

    // 2. Debug chi tiết response
    console.log('API Response:', {
      status: response.status,
      headers: response.headers,
      dataType: typeof response.data,
      first100Chars: String(response.data).substring(0, 100)
    });

    // 3. Xử lý dữ liệu thủ công
    let data;
    try {
      // Thử parse JSON nếu có thể
      data = typeof response.data === 'string' 
        ? JSON.parse(response.data) 
        : response.data;
      
      // Nếu là object đơn thì chuyển thành array
      if (data && !Array.isArray(data) {
        data = [data];
      }
    } catch (parseError) {
      console.error('Parse Error - Raw Data:', response.data);
      throw new Error(`Invalid JSON format: ${parseError.message}`);
    }

    // 4. Validate dữ liệu cuối cùng
    if (!Array.isArray(data)) {
      throw new Error('Final data is not an array');
    }

    // 5. Transform data an toàn
    const transformedData = data.map(item => {
      try {
        return {
          phien: Number(item.session) || 0,
          xuc_xac: item.dice || [0, 0, 0],
          Tong: Number(item.total) || 0,
          Ket_qua: item.result || 'Unknown',
          thoi_gian: item.timestamp || new Date().toISOString()
        };
      } catch (mapError) {
        console.error('Mapping Error:', mapError);
        return {
          phien: 0,
          xuc_xac: [0, 0, 0],
          Tong: 0,
          Ket_qua: 'Error',
          thoi_gian: new Date().toISOString()
        };
      }
    });

    // 6. Trả về kết quả
    res.json({
      status: 'success',
      data: transformedData,
      receivedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Final Error:', error.stack);
    res.status(500).json({
      status: 'error',
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error.stack
      } : undefined
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
