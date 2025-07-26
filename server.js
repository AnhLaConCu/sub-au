// server.js
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware để cho phép truy cập từ các domain khác (CORS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Endpoint mới cho dữ liệu tài xỉu
app.get('/taixiu', async (req, res) => {
  try {
    // Fetch dữ liệu từ API gốc
    const response = await axios.get('https://saobody-lopq.onrender.com/api/taixiu/history');
    
    // Chuyển đổi dữ liệu sang định dạng mong muốn
    const transformedData = response.data.map(item => ({
      phien: item.session,
      xuc_xac_1: item.dice[0],
      xuc_xac_2: item.dice[1],
      xuc_xac_3: item.dice[2],
      Tong: item.total,
      Ket_qua: item.result
    }));
    
    // Trả về dữ liệu đã chuyển đổi
    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
