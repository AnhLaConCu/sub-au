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
    const response = await axios.get('https://saobody-lopq.onrender.com/api/taixiu/history', {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Parse dữ liệu nếu cần (trường hợp API trả về text)
    let data = response.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (parseError) {
        throw new Error('Failed to parse API response');
      }
    }

    // Kiểm tra nếu data không phải là mảng
    if (!Array.isArray(data)) {
      // Nếu là object đơn lẻ, chuyển thành mảng 1 phần tử
      if (typeof data === 'object' && data !== null) {
        data = [data];
      } else {
        throw new Error('API response format is invalid');
      }
    }
    
    const transformedData = data.map(item => ({
      phien: item.session,
      xuc_xac_1: item.dice[0],
      xuc_xac_2: item.dice[1],
      xuc_xac_3: item.dice[2],
      Tong: item.total,
      Ket_qua: item.result,
      timestamp: item.timestamp // Giữ nguyên timestamp nếu cần
    }));
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
