// wsService.js
const WebSocket = require("ws");
const { updateRobotStatus, getAllRobots } = require("./robotService");

/**
 * 각 클라이언트(웹소켓)별로 구독 중인 machineId를 저장하기 위한 매핑.
 *   key: WebSocket 인스턴스
 *   value: 구독 중인 machineId (문자열) - 예: 'machine1'
 */
const subscriptions = new Map();

// 예) 평균 계산 함수
function getRobotAverages(robots) {
  const robotList = Object.values(robots); // { machine1: {...}, machine2: {...} } -> 배열로 변환
  
  if (robotList.length === 0) {
    return {
      avgBattery: 0,
      avgTemperature: 0,
      totalRobots: 0,
      chargingCount: 0,
      runningCount: 0,
    };
  }

  // 모든 로봇 배터리, 온도 합계
  const totalBattery = robotList.reduce((sum, r) => sum + r.battery, 0);
  const totalTemp = robotList.reduce((sum, r) => sum + r.temperature, 0);

  // 평균값
  const avgBattery = (totalBattery / robotList.length).toFixed(2);
  const avgTemperature = (totalTemp / robotList.length).toFixed(2);

  // 로봇 총 수
  const totalRobots = robotList.length;
  // charging === true 인 로봇 수
  const chargingCount = robotList.filter((r) => r.charging).length;
  // charging === false 인 로봇 수 (가동 중이라 가정)
  const runningCount = totalRobots - chargingCount;

  return {
    avgBattery,
    avgTemperature,
    totalRobots,
    chargingCount,
    runningCount,
  };
}

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  // 1) 서버 켜진 동안 일정 간격으로 로봇 상태 갱신 & 브로드캐스트
  const updateInterval = setInterval(() => {
    updateRobotStatus();
    
    // 전체 로봇 최신 상태
    const allRobots = getAllRobots();
    const { 
      avgBattery,
      avgTemperature,
      totalRobots,
      chargingCount,
      runningCount,
     } = getRobotAverages(allRobots);

    // 연결된 각 클라이언트에 대해
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // 2) 클라이언트 구독 ID 확인
        const subscribedMachineId = subscriptions.get(client);
        if (!subscribedMachineId) {
          // 구독 없음 → 아무것도 안 보내거나, 전체 전송하고 싶다면 여기서 처리
          client.send(JSON.stringify({
            robots: allRobots,
            totalRobots,
            chargingCount,
            runningCount,
            avgBattery,
            avgTemperature,
          }));
        } else {
          // 구독한 machineId만 전송
          const singleRobot = allRobots[subscribedMachineId];
          // 혹은, 만약 해당 로봇이 존재하지 않는다면?
          // singleRobot가 undefined일 수 있으므로 체크 필요
          if (singleRobot) {
            client.send(JSON.stringify({ robot: singleRobot }));
          } else {
            // 존재하지 않는 machineId 구독 → 에러 안내 등
            client.send(JSON.stringify({
              error: `No data for ${subscribedMachineId}`,
            }));
          }
        }
      }
    });
  }, 1000);

  // 3) 클라이언트 연결 시
  wss.on("connection", (ws) => {
    console.log("✅ WebSocket 클라이언트 연결됨");

    // 기본적으로 구독 없음 상태
    subscriptions.set(ws, null);

    ws.on("message", (message) => {
      // 클라이언트가 JSON 형태로 { type: 'subscribe', machineId: 'machine1' } 등 전송했다고 가정
      let parsed;
      try {
        parsed = JSON.parse(message);
      } catch (err) {
        console.error("Invalid JSON from client:", message);
        return;
      }

      if (parsed.type === "subscribe" && parsed.machineId) {
        // machineId 구독 등록
        subscriptions.set(ws, parsed.machineId);
        console.log(`Client subscribed to ${parsed.machineId}`);
      }
    });

    ws.on("close", () => {
      console.log("❌ WebSocket 클라이언트 연결 종료");
      // 종료된 소켓의 구독 정보 정리
      subscriptions.delete(ws);
    });
  });

  wss.on("close", () => {
    clearInterval(updateInterval);
  });

  return wss;
}

module.exports = { setupWebSocket };
