const Fastify = require("fastify");
const cors = require("@fastify/cors");
const { request } = require("undici"); // dùng undici thay fetch

const fastify = Fastify();
fastify.register(cors);

fastify.get("/taixiu", async (req, reply) => {
  try {
    const { body } = await request("https://saobody-lopq.onrender.com/api/taixiu/history");
    const data = await body.json();

    // Kiểm tra dữ liệu
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Dữ liệu trống hoặc sai định dạng");
    }

    // Chuyển đổi dữ liệu
    const result = data.map(item => ({
      phien: item.session,
      xuc_xac_1: item.dice?.[0] ?? 0,
      xuc_xac_2: item.dice?.[1] ?? 0,
      xuc_xac_3: item.dice?.[2] ?? 0,
      Tong: item.total ?? 0,
      Ket_qua: item.result ?? "Unknown"
    }));

    return {
      status: "success",
      data: result
    };
  } catch (err) {
    console.error("❌ Fetch thất bại:", err.message);
    return {
      status: "success",
      data: [
        {
          phien: 0,
          xuc_xac_1: 0,
          xuc_xac_2: 0,
          xuc_xac_3: 0,
          Tong: 0,
          Ket_qua: "Unknown"
        }
      ]
    };
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    console.log("✅ Server đang chạy: http://localhost:3000/taixiu");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
