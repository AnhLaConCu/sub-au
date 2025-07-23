const Fastify = require("fastify");
const cors = require("@fastify/cors");
const WebSocket = require("ws");

const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0YW9sYXRvcDFzdiIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjI5MjI0MDM4NiwiYWZmSWQiOiJhMTE3YzY5MC1lOGY0LTQ5ZTUtOTUwYS00NmRkZWRlMDY1NDIiLCJiYW5uZWQiOmZhbHNlLCJicmFuZCI6InN1bi53aW4iLCJ0aW1lc3RhbXAiOjE3NTMyNDYzOTMzNTYsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjAwMTplZTA6NTcwODo3NzAwOjI4Y2Y6OTNjZDphNDZkOjZiYWQiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzE0LnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6ImExMTdjNjkwLWU4ZjQtNDllNS05NTBhLTQ2ZGRlZGUwNjU0MiIsInJlZ1RpbWUiOjE3NTMyMTM0ODM2NTksInBob25lIjoiIiwiZGVwb3NpdCI6ZmFsc2UsInVzZXJuYW1lIjoiU0Nfc3Vud2lubG92YyJ9.QJhaUaU4pzbcDd30DyZ_3meeSuFzgPZV3aKjqQ5Gjgc";

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3001;

let rikResults = [];
let rikCurrentSession = null;
let rikWS = null;
let rikIntervalCmd = null;
const HISTORY_LIMIT = 100;

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
  return sum >= 11 ? "Tài" : "Xỉu";
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
        "info": "{\"ipAddress\":\"2001:ee0:5708:7700:28cf:93cd:a46d:6bad\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0YW9sYXRvcDFzdiIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjI5MjI0MDM4NiwiYWZmSWQiOiJhMTE3YzY5MC1lOGY0LTQ5ZTUtOTUwYS00NmRkZWRlMDY1NDIiLCJiYW5uZWQiOmZhbHNlLCJicmFuZCI6InN1bi53aW4iLCJ0aW1lc3RhbXAiOjE3NTMyNDYzOTMzNTYsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjAwMTplZTA6NTcwODo3NzAwOjI4Y2Y6OTNjZDphNDZkOjZiYWQiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzE0LnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6ImExMTdjNjkwLWU4ZjQtNDllNS05NTBhLTQ2ZGRlZGUwNjU0MiIsInJlZ1RpbWUiOjE3NTMyMTM0ODM2NTksInBob25lIjoiIiwiZGVwb3NpdCI6ZmFsc2UsInVzZXJuYW1lIjoiU0Nfc3Vud2lubG92YyJ9.QJhaUaU4pzbcDd30DyZ_3meeSuFzgPZV3aKjqQ5Gjgc\",\"userId\":\"a117c690-e8f4-49e5-950a-46ddede06542\",\"username\":\"SC_sunwinlovc\",\"timestamp\":1753246393356}",
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

          rikResults.unshift({
            sid: result.sid,
            d1: result.d1,
            d2: result.d2,
            d3: result.d3
          });

          if (rikResults.length > HISTORY_LIMIT) {
            rikResults.pop();
          }

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
          }))
          .sort((a, b) => b.sid - a.sid);

        rikResults = history.slice(0, HISTORY_LIMIT);
        console.log(`📦 Đã tải lịch sử ${rikResults.length} phiên gần nhất.`);
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

connectRikWebSocket();

fastify.register(cors);

// API 1: Kết quả mới nhất
fastify.get("/api/taixiu/sunwin", async () => {
  const validResults = rikResults.filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length === 0) {
    return { message: "Không có dữ liệu." };
  }

  const current = validResults[0];
  const sum = current.d1 + current.d2 + current.d3;

  return {
    Phien: current.sid,
    Xuc_xac_1: current.d1,
    Xuc_xac_2: current.d2,
    Xuc_xac_3: current.d3,
    Tong: sum,
    Ket_qua: getTX(current.d1, current.d2, current.d3)
  };
});

// API 2: Lịch sử 100 phiên
fastify.get("/api/taixiu/history", async () => {
  const validResults = rikResults.filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length === 0) {
    return { message: "Không có dữ liệu." };
  }

  return validResults.map(item => {
    const sum = item.d1 + item.d2 + item.d3;
    return {
      Phien: item.sid,
      Xuc_xac_1: item.d1,
      Xuc_xac_2: item.d2,
      Xuc_xac_3: item.d3,
      Tong: sum,
      Ket_qua: getTX(item.d1, item.d2, item.d3)
    };
  });
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 API chạy tại ${address}`);
    console.log("👉 GET /api/taixiu/sunwin - Kết quả mới nhất");
    console.log("👉 GET /api/taixiu/history - Lịch sử 100 phiên");
  } catch (err) {
    console.error("❌ Server error:", err);
    process.exit(1);
  }
};

start();
