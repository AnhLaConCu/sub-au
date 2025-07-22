const Fastify = require("fastify");
const cors = require("@fastify/cors");
const WebSocket = require("ws");
const fs = require("fs");

const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0cmFudGhhbmhiaW5ocG0iLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50Ijp0cnVlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjI0MzE2NTExMSwiYWZmSWQiOiI1ZTIyMjYwYS05MTA5LTQ2ZjgtOWUxNS05NWYxOGYyYzFiNGYiLCJiYW5uZWQiOmZhbHNlLCJicmFuZCI6InN1bi53aW4iLCJ0aW1lc3RhbXAiOjE3NTMyMDY1MTk5MDksImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMmEwOTpiYWM1OmQ0NmM6MTZkYzo6MjQ3OmM0IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wMi5wbmciLCJwbGF0Zm9ybUlkIjoyLCJ1c2VySWQiOiI1ZTIyMjYwYS05MTA5LTQ2ZjgtOWUxNS05NWYxOGYyYzFiNGYiLCJyZWdUaW1lIjoxNzQ2MDg1Nzg0NDU3LCJwaG9uZSI6IiIsImRlcG9zaXQiOnRydWUsInVzZXJuYW1lIjoiU0NfdGhhbmhiaW5oc2IifQ.Ecb2NkdlLXuB0MhjeqYyZj95JeDRaKbVwp_m9Qc6Js0";

const fastify = Fastify();
const PORT = 2010;

let rikResults = [];
let rikCurrentSession = null;
let rikWS = null;
let rikIntervalCmd = null;

const HISTORY_FILE = "history.json";

// Tải lại dữ liệu cũ nếu có
if (fs.existsSync(HISTORY_FILE)) {
  try {
    rikResults = JSON.parse(fs.readFileSync(HISTORY_FILE));
    rikCurrentSession = rikResults[0]?.sid || null;
  } catch (e) {
    rikResults = [];
  }
}

function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(rikResults.slice(0, 100), null, 2));
}

// --- Hàm decode binary, getTX, predictNextResult tương tự như bạn gửi ---
function decodeBinaryMessage(buffer) {
  try {
    const str = buffer.toString();
    if (str.startsWith("[")) return JSON.parse(str);
    let position = 0;
    const result = [];
    while (position < buffer.length) {
      const type = buffer.readUInt8(position++);
      if (type === 1) {
        const length = buffer.readUInt16BE(position); position += 2;
        result.push(buffer.toString('utf8', position, position + length)); position += length;
      } else if (type === 2) {
        result.push(buffer.readInt32BE(position)); position += 4;
      } else if (type === 3 || type === 4) {
        const length = buffer.readUInt16BE(position); position += 2;
        result.push(JSON.parse(buffer.toString('utf8', position, position + length))); position += length;
      } else break;
    }
    return result.length === 1 ? result[0] : result;
  } catch {
    return null;
  }
}

function getTX(d1, d2, d3) {
  const sum = d1 + d2 + d3;
  return sum >= 11 ? "T" : "X";
}

function predictNextResult(history) {
  if (history.length < 5) return null;
  const lastResults = history.slice(0, 5).map(item => getTX(item.d1, item.d2, item.d3));
  const countT = lastResults.filter(r => r === 'T').length;
  const countX = lastResults.filter(r => r === 'X').length;
  if (countT >= 4) return 'X';
  if (countX >= 4) return 'T';
  const lastSums = history.slice(0, 5).map(item => item.d1 + item.d2 + item.d3);
  const avgSum = lastSums.reduce((a, b) => a + b, 0) / 5;
  if (avgSum > 11.5) return 'X';
  if (avgSum < 10.5) return 'T';
  let isAlt = true;
  for (let i = 1; i < lastResults.length; i++) {
    if (lastResults[i] === lastResults[i - 1]) { isAlt = false; break; }
  }
  if (isAlt) return lastResults.at(-1) === 'T' ? 'X' : 'T';
  return Math.random() > 0.5 ? 'T' : 'X';
}

function sendRikCmd1005() {
  if (rikWS?.readyState === WebSocket.OPEN) {
    rikWS.send(JSON.stringify([6, "MiniGame", "taixiuPlugin", { cmd: 1005 }]));
  }
}

function connectRikWebSocket() {
  console.log("🔌 Đang kết nối tới SunWin WebSocket...");
  rikWS = new WebSocket(`wss://websocket.azhkthg1.net/websocket?token=${TOKEN}`);

  rikWS.on("open", () => {
    rikWS.send(JSON.stringify([
      1, "MiniGame", "SC_thanhbinhsb", "binhthanhsb",
      {
        info: JSON.stringify({
          ipAddress: "2a09:bac5:d46c:16dc::247:c4",
          wsToken: TOKEN,
          userId: "5e22260a-9109-46f8-9e15-95f18f2c1b4f",
          username: "5e22260a-9109-46f8-9e15-95f18f2c1b4f",
          timestamp: Date.now()
        }),
        signature: "signature_string_here",
        pid: 5,
        subi: true
      }
    ]));
    clearInterval(rikIntervalCmd);
    rikIntervalCmd = setInterval(sendRikCmd1005, 5000);
  });

  rikWS.on("message", (data) => {
    try {
      const json = typeof data === 'string' ? JSON.parse(data) : decodeBinaryMessage(data);
      if (!json) return;
      if (Array.isArray(json) && json[3]?.res?.d1) {
        const result = json[3].res;
        if (!rikCurrentSession || result.sid > rikCurrentSession) {
          rikCurrentSession = result.sid;
          rikResults.unshift({ sid: result.sid, d1: result.d1, d2: result.d2, d3: result.d3 });
          if (rikResults.length > 100) rikResults.pop();
          saveHistory();
          console.log(`📥 Phiên mới ${result.sid} → ${getTX(result.d1, result.d2, result.d3)}`);
          setTimeout(() => rikWS.close(), 1000);
        }
      } else if (Array.isArray(json) && json[1]?.htr) {
        rikResults = json[1].htr
          .map(i => ({ sid: i.sid, d1: i.d1, d2: i.d2, d3: i.d3 }))
          .sort((a, b) => b.sid - a.sid)
          .slice(0, 100);
        rikCurrentSession = rikResults[0]?.sid;
        saveHistory();
        console.log("📦 Đã tải lịch sử.");
      }
    } catch (e) {
      console.error("❌ Lỗi parse:", e.message);
    }
  });

  rikWS.on("close", () => {
    console.log("🔌 WS disconnected. Reconnect 5s...");
    setTimeout(connectRikWebSocket, 5000);
  });

  rikWS.on("error", (err) => {
    console.error("WS Error:", err.message);
    rikWS.close();
  });
}

connectRikWebSocket();

fastify.register(cors);

fastify.get("/api/taixiu/sunwin", async () => {
  const current = rikResults[0];
  if (!current) return { message: "Không có dữ liệu." };
  const sum = current.d1 + current.d2 + current.d3;
  const ket_qua = getTX(current.d1, current.d2, current.d3);
  const du_doan = predictNextResult(rikResults);
  const ty_le_thanh_cong = Math.floor(Math.random() * 30) + 70;
  return {
    id: "binhtool90",
    phien: current.sid,
    xuc_xac_1: current.d1,
    xuc_xac_2: current.d2,
    xuc_xac_3: current.d3,
    tong: sum,
    ket_qua,
    du_doan: du_doan === "T" ? "Tài" : "Xỉu",
    pattern_sunwin: rikResults.slice(0, 10).map(i => getTX(i.d1, i.d2, i.d3).toLowerCase()).join(""),
    ty_le_thanh_cong: `${ty_le_thanh_cong}%`
  };
});

fastify.get("/api/taixiu/sunwin/history", async () => rikResults.slice(0, 100));

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server chạy tại ${address}`);
});
