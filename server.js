const Fastify = require("fastify");
const cors = require("@fastify/cors");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const fastify = Fastify();
fastify.register(cors);

const historyFile = path.join(__dirname, "taixiu_history.json");
let history = [];

try {
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
  }
} catch (e) {
  console.error("Lỗi đọc history:", e);
}

const ID = "binhtool90";
let current = null;

function saveHistory() {
  fs.writeFileSync(historyFile, JSON.stringify(history.slice(-100), null, 2));
}

function predictNext(history) {
  if (history.length < 6) return "Đợi thêm dữ liệu";

  const lastPatterns = history.slice(-6).map(h => h.result[0].toLowerCase()).join('');
  const pattern = lastPatterns;

  // Giả lập mẫu cầu đơn giản dựa trên tần suất
  const count = { t: 0, x: 0 };
  pattern.split("").forEach(p => (count[p]++));
  return count.t > count.x ? "Xỉu" : "Tài";
}

function getPattern(history, length = 10) {
  return history.slice(-length).map(h => h.result[0].toLowerCase()).join("");
}

// Cập nhật WebSocket
const ws = new WebSocket("wss://websocket.azhkthg1.net/websocket");

ws.on("open", () => {
  console.log("Đã kết nối WebSocket");

  const loginData = [
    1,
    "",
    "SC_sunwinlovc",
    "taolatrum",
    {
      info: "{\"ipAddress\":\"2001:ee0:5708:7700:28cf:93cd:a46d:6bad\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJ0YW9sYXRvcDFzdiIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjI5MjI0MDM4NiwiYWZmSWQiOiJhMTE3YzY5MC1lOGY0LTQ5ZTUtOTUwYS00NmRkZWRlMDY1NDIiLCJiYW5uZWQiOmZhbHNlLCJicmFuZCI6InN1bi53aW4iLCJ0aW1lc3RhbXAiOjE3NTMyNDYzOTMzNTYsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjAwMTplZTA6NTcwODo3NzAwOjI4Y2Y6OTNjZDphNDZkOjZiYWQiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzE0LnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6ImExMTdjNjkwLWU4ZjQtNDllNS05NTBhLTQ2ZGRlZGUwNjU0MiIsInJlZ1RpbWUiOjE3NTMyMTM0ODM2NTksInBob25lIjoiIiwiZGVwb3NpdCI6ZmFsc2UsInVzZXJuYW1lIjoiU0Nfc3Vud2lubG92YyJ9.QJhaUaU4pzbcDd30DyZ_3meeSuFzgPZV3aKjqQ5Gjgc\",\"locale\":\"vi\",\"userId\":\"a117c690-e8f4-49e5-950a-46ddede06542\",\"username\":\"SC_sunwinlovc\",\"timestamp\":1753246393356,\"refreshToken\":\"430500baa6c8436d9a0d5cef4e2a0297.c87b018b1daf44cb94685efc5b87ef54\"}",
      signature: "145F536E40A0CF3C44B5DE2466B5B02FA477B65FC1D02D35F58F6D7F75EA5CB7CFCCC52F7E873D22D22FFE8C0556AA34FE2E71E38ACD354F9200F58D569B302B6CB1CE724C000844E7382225023C5B1A3F65C9A1759D41D4CF4790900F6B54FB0C497942B4E17650E7F47AD35F3C19C9BF3B82A0F8E161F74540D6C8F463CBD1",
      pid: 5,
      subi: true,
    },
  ];

  ws.send(JSON.stringify(loginData));
});

ws.on("message", (data) => {
  try {
    const parsed = JSON.parse(data);

    if (
      Array.isArray(parsed) &&
      parsed[2]?.d1 &&
      parsed[2]?.d2 &&
      parsed[2]?.d3 &&
      parsed[2]?.sid
    ) {
      const d1 = parsed[2].d1;
      const d2 = parsed[2].d2;
      const d3 = parsed[2].d3;
      const sid = parsed[2].sid;
      const sum = d1 + d2 + d3;
      const ket_qua = sum >= 11 ? "Tài" : "Xỉu";

      const du_doan = predictNext(history);
      const pattern_sunwin = getPattern(history);

      current = {
        id: ID,
        phien: sid,
        xuc_xac_1: d1,
        xuc_xac_2: d2,
        xuc_xac_3: d3,
        tong: sum,
        ket_qua,
        du_doan,
        pattern_sunwin,
      };

      history.push({
        session: sid,
        dice: [d1, d2, d3],
        total: sum,
        result: ket_qua,
      });

      saveHistory();
      console.log(`Phiên ${sid} - ${ket_qua} (${d1},${d2},${d3})`);
    }
  } catch (err) {
    console.error("Lỗi xử lý message:", err);
  }
});

fastify.get("/api/taixiu/sunwin", async (req, reply) => {
  if (!current) return reply.send({ message: "Chưa có dữ liệu" });
  reply.send(current);
});

fastify.get("/api/taixiu/history", async (req, reply) => {
  reply.send(history.slice(-100).reverse());
});

fastify.listen({ port: 2010 }, (err, address) => {
  if (err) throw err;
  console.log("Server đang chạy tại", address);
});
