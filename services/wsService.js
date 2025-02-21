const WebSocket = require("ws");
const { updateRobotStatus } = require("./robotService");

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("✅ WebSocket 클라이언트 연결됨");

    const interval = setInterval(() => {
      // 로봇 상태를 업데이트하고, 운반 기록이 자동으로 생성됨.
      const robots = updateRobotStatus();
      ws.send(JSON.stringify({ robots }));
    }, 1000); // 5초마다 데이터 업데이트

    ws.on("close", () => {
      console.log("❌ WebSocket 클라이언트 연결 종료");
      clearInterval(interval);
    });
  });

  return wss;
}

module.exports = { setupWebSocket };
