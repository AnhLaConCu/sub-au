const Fastify = require("fastify");
const cors = require("@fastify/cors");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0YW9sYXRvcDFzdiIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjI5MjI0MDM4NiwiYWZmSWQiOiJhMTE3YzY5MC1lOGY0LTQ5ZTUtOTUwYS00NmRkZWRlMDY1NDIiLCJiYW5uZWQiOmZhbHNlLCJicmFuZCI6InN1bi53aW4iLCJ0aW1lc3RhbXAiOjE3NTMyNDYzOTMzNTYsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjAwMTplZTA6NTcwODo3NzAwOjI4Y2Y6OTNjZDphNDZkOjZiYWQiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzE0LnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6ImExMTdjNjkwLWU4ZjQtNDllNS05NTBhLTQ2ZGRlZGUwNjU0MiIsInJlZ1RpbWUiOjE3NTMyMTM0ODM2NTksInBob25lIjoiIiwiZGVwb3NpdCI6ZmFsc2UsInVzZXJuYW1lIjoiU0Nfc3Vud2lubG92YyJ9";

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 2010;
const HISTORY_FILE = path.join(__dirname, 'taixiu_history.json');

let rikResults = [];
let rikCurrentSession = null;
let rikWS = null;
let rikIntervalCmd = null;

// Load history from file if exists
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      rikResults = JSON.parse(data);
      console.log(`📚 Loaded ${rikResults.length} history records`);
    }
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

// Save history to file
function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(rikResults), 'utf8');
  } catch (err) {
    console.error('Error saving history:', err);
  }
}

// Binary message decoder
function decodeBinaryMessage(buffer) {
  try {
    const str = buffer.toString();
    if (str.startsWith("[")) {
      return JSON.parse(str);
    }
    
    let position = 0;
    const result = [];
    
    while (position < buffer.length) {
      const type = buffer.readUInt8(position++);
      
      if (type === 1) {
        const length = buffer.readUInt16BE(position);
        position += 2;
        const str = buffer.toString('utf8', position, position + length);
        position += length;
        result.push(str);
      } 
      else if (type === 2) {
        const num = buffer.readInt32BE(position);
        position += 4;
        result.push(num);
      }
      else if (type === 3) {
        const length = buffer.readUInt16BE(position);
        position += 2;
        const objStr = buffer.toString('utf8', position, position + length);
        position += length;
        result.push(JSON.parse(objStr));
      }
      else if (type === 4) {
        const length = buffer.readUInt16BE(position);
        position += 2;
        const arrStr = buffer.toString('utf8', position, position + length);
        position += length;
        result.push(JSON.parse(arrStr));
      }
      else {
        console.warn("Unknown binary type:", type);
        break;
      }
    }
    
    return result.length === 1 ? result[0] : result;
  } catch (e) {
    console.error("Binary decode error:", e);
    return null;
  }
}

function getTX(d1, d2, d3) {
  const sum = d1 + d2 + d3;
  return sum >= 11 ? "T" : "X";
}

// Analyze patterns in history
function analyzePatterns(history) {
  if (history.length < 5) return null;
  
  const patternHistory = history.slice(0, 30).map(item => 
    getTX(item.d1, item.d2, item.d3)
  ).join('');
  
  // Check for known patterns
  const knownPatterns = {
    'ttxtttttxtxtxttxtxtxtxtxtxxttxt': 'Pattern thường xuất hiện sau chuỗi Tài-Tài-Xỉu-Tài...',
    'ttttxxxx': '4 Tài liên tiếp thường đi kèm 4 Xỉu',
    'xtxtxtxt': 'Xen kẽ Tài Xỉu ổn định',
    'ttxxttxxttxx': 'Chu kỳ 2 Tài 2 Xỉu'
  };
  
  for (const [pattern, description] of Object.entries(knownPatterns)) {
    if (patternHistory.includes(pattern)) {
      return {
        pattern,
        description,
        confidence: Math.floor(Math.random() * 20) + 80 // 80-99%
      };
    }
  }
  
  return null;
}

// Prediction algorithm
function predictNextResult(history) {
  if (history.length < 5) return null;

  // 1. Check for known patterns first
  const patternAnalysis = analyzePatterns(history);
  if (patternAnalysis) {
    const lastChar = patternAnalysis.pattern.slice(-1);
    return {
      prediction: lastChar === 'T' ? 'X' : 'T', // Predict opposite of last in pattern
      reason: `Phát hiện mẫu: ${patternAnalysis.description}`,
      confidence: patternAnalysis.confidence
    };
  }

  // 2. Analyze recent T/X sequence
  const lastResults = history.slice(0, 5).map(item => 
    getTX(item.d1, item.d2, item.d3)
  );
  
  // 3. Count T/X in last 5 sessions
  const countT = lastResults.filter(r => r === 'T').length;
  const countX = lastResults.filter(r => r === 'X').length;

  // 4. Trend analysis (if 4-5 same type)
  if (countT >= 4) return {
    prediction: 'X',
    reason: 'Xu hướng Tài nhiều (4/5 phiên), dự đoán Xỉu',
    confidence: 85
  };
  
  if (countX >= 4) return {
    prediction: 'T',
    reason: 'Xu hướng Xỉu nhiều (4/5 phiên), dự đoán Tài',
    confidence: 85
  };

  // 5. Analyze sum averages
  const lastSums = history.slice(0, 5).map(item => item.d1 + item.d2 + item.d3);
  const avgSum = lastSums.reduce((a, b) => a + b, 0) / 5;
  
  if (avgSum > 11.5) return {
    prediction: 'X',
    reason: `Tổng điểm trung bình cao (${avgSum.toFixed(1)}), dự đoán Xỉu`,
    confidence: 75
  };
  
  if (avgSum < 10.5) return {
    prediction: 'T',
    reason: `Tổng điểm trung bình thấp (${avgSum.toFixed(1)}), dự đoán Tài`,
    confidence: 75
  };

  // 6. Check for alternating pattern
  let isAlternating = true;
  for (let i = 1; i < lastResults.length; i++) {
    if (lastResults[i] === lastResults[i-1]) {
      isAlternating = false;
      break;
    }
  }
  
  if (isAlternating) {
    const nextPred = lastResults[lastResults.length-1] === 'T' ? 'X' : 'T';
    return {
      prediction: nextPred,
      reason: 'Xu hướng xen kẽ Tài/Xỉu',
      confidence: 70
    };
  }

  // 7. Fallback to random with probability
  return {
    prediction: Math.random() > 0.5 ? 'T' : 'X',
    reason: 'Không có mẫu rõ ràng, dự đoán ngẫu nhiên',
    confidence: 60
  };
}

function sendRikCmd1005() {
  if (rikWS && rikWS.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
    rikWS.send(JSON.stringify(payload));
  }
}

function connectRikWebSocket() {
  console.log("🔌 Connecting to SunWin WebSocket...");
  rikWS = new WebSocket(`wss://websocket.azhkthg1.net/websocket?token=${TOKEN}`);

  rikWS.on("open", () => {
    const authPayload = [
      1,
      "MiniGame",
      "SC_sunwinlovc",
      "taolatrum",
      {
        "info": JSON.stringify({
          ipAddress: "2001:ee0:5708:7700:28cf:93cd:a46d:6bad",
          wsToken: TOKEN,
          userId: "a117c690-e8f4-49e5-950a-46ddede06542",
          username: "SC_sunwinlovc",
          timestamp: 1753246393356
        }),
        "signature": "145F536E40A0CF3C44B5DE2466B5B02FA477B65FC1D02D35F58F6D7F75EA5CB7CFCCC52F7E873D22D22FFE8C0556AA34FE2E71E38ACD354F9200F58D569B302B6CB1CE724C000844E7382225023C5B1A3F65C9A1759D41D4CF4790900F6B54FB0C497942B4E17650E7F47AD35F3C19C9BF3B82A0F8E161F74540D6C8F463CBD1",
        "pid": 5,
        "subi": true
      }
    ];
    rikWS.send(JSON.stringify(authPayload));
    clearInterval(rikIntervalCmd);
    rikIntervalCmd = setInterval(sendRikCmd1005, 5000);
  });

  rikWS.on("message", (data) => {
    try {
      const json = typeof data === 'string' ? JSON.parse(data) : decodeBinaryMessage(data);

      if (!json) return;

      if (Array.isArray(json) && json[3]?.res?.d1 && json[3]?.res?.sid) {
        const result = json[3].res;
        
        if (!rikCurrentSession || result.sid > rikCurrentSession) {
          rikCurrentSession = result.sid;

          const newResult = {
            sid: result.sid,
            d1: result.d1,
            d2: result.d2,
            d3: result.d3,
            timestamp: Date.now()
          };

          rikResults.unshift(newResult);

          // Keep only last 100 results
          if (rikResults.length > 100) rikResults.pop();

          // Save to file
          saveHistory();

          console.log(`📥 Phiên mới ${result.sid} → ${getTX(result.d1, result.d2, result.d3)}`);
          
          setTimeout(() => {
            if (rikWS) rikWS.close();
            connectRikWebSocket();
          }, 1000);
        }
      }

      else if (Array.isArray(json) && json[1]?.htr) {
        const history = json[1].htr
          .map((item) => ({
            sid: item.sid,
            d1: item.d1,
            d2: item.d2,
            d3: item.d3,
            timestamp: Date.now()
          }))
          .sort((a, b) => b.sid - a.sid);

        rikResults = history.slice(0, 100);
        saveHistory();
        console.log("📦 Đã tải lịch sử các phiên gần nhất.");
      }

    } catch (e) {
      console.error("❌ Parse error:", e.message);
    }
  });

  rikWS.on("close", () => {
    console.log("🔌 WebSocket disconnected. Reconnecting...");
    setTimeout(connectRikWebSocket, 5000);
  });

  rikWS.on("error", (err) => {
    console.error("🔌 WebSocket error:", err.message);
    rikWS.close();
  });
}

// Load history when starting
loadHistory();
connectRikWebSocket();

fastify.register(cors);

// Current result endpoint
fastify.get("/api/taixiu/sunwin", async () => {
  const validResults = rikResults.filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length === 0) {
    return { message: "Không có dữ liệu." };
  }

  const current = validResults[0];
  const sum = current.d1 + current.d2 + current.d3;
  const ket_qua = sum >= 11 ? "Tài" : "Xỉu";

  // Predict next result
  const prediction = predictNextResult(validResults);

  return {
    phien: current.sid,
    xuc_xac_1: current.d1,
    xuc_xac_2: current.d2,
    xuc_xac_3: current.d3,
    tong: sum,
    ket_qua: ket_qua,
    du_doan: prediction.prediction === 'T' ? 'Tài' : 'Xỉu',
    ty_le_thanh_cong: `${prediction.confidence}%`,
    giai_thich: prediction.reason,
    pattern: analyzePatterns(validResults)?.description || "Không phát hiện mẫu cụ thể"
  };
});

// History endpoint
fastify.get("/api/taixiu/history", async () => {
  const validResults = rikResults.filter(item => item.d1 && item.d2 && item.d3);
  
  if (validResults.length === 0) {
    return { message: "Không có dữ liệu lịch sử." };
  }

  // Format history as requested
  const historyText = validResults.map(item => {
    const sum = item.d1 + item.d2 + item.d3;
    return {
      session: item.sid,
      dice: [item.d1, item.d2, item.d3],
      total: sum,
      result: sum >= 11 ? "Tài" : "Xỉu"
    };
  }).map(item => JSON.stringify(item)).join('\n');

  return historyText;
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 API chạy tại ${address}`);
  } catch (err) {
    console.error("❌ Server error:", err);
    process.exit(1);
  }
};

start();
