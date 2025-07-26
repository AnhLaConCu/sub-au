const Fastify = require("fastify");
const fetch = require("node-fetch");
const cors = require("@fastify/cors");

const fastify = Fastify();
fastify.register(cors);

// Endpoint trả về JSON đã xử lý
fastify.get("/taixiu", async (req, reply) => {
  try {
    const response = await fetch("https://saobody-lopq.onrender.com/api/taixiu/history");
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
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

    const result = data.map((item) => ({
      phien: item.session,
      xuc_xac_1: item.dice[0],
      xuc_xac_2: item.dice[1],
      xuc_xac_3: item.dice[2],
      Tong: item.total,
      Ket_qua: item.result
    }));

    return {
      status: "success",
      data: result
    };
  } catch (error) {
    console.error("Lỗi fetch:", error);
    reply.status(500).send({
      status: "error",
      message: "Không lấy được dữ liệu từ API nguồn"
    });
  }
});

// Khởi động server
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    console.log("Server running...");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
