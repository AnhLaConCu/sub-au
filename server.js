const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/taixiu', async (req, res) => {
  try {
    const response = await axios.get('https://saobody-lopq.onrender.com/api/taixiu/history', {
      timeout: 10000,
      responseType: 'json' // Yêu cầu trả về JSON
    });

    // Kiểm tra và chuẩn hóa dữ liệu
    let data = response.data;
    
    // Sửa lỗi cú pháp: thêm dấu ngoặc đóng
    if (data && !Array.isArray(data)) {
      data = [data]; // Chuyển object thành array
    }

    // Xử lý dữ liệu
    const transformedData = data.map(item => ({
      phien: item.session || 0,
      xuc_xac_1: item.dice?.[0] || 0,
      xuc_xac_2: item.dice?.[1] || 0,
      xuc_xac_3: item.dice?.[2] || 0,
      Tong: item.total || 0,
      Ket_qua: item.result || 'Unknown'
    }));

    res.json({
      status: 'success',
      data: transformedData
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
