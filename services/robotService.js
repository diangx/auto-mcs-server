const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../public/testdb");

// 고정된 위치
const PICKUP_LOCATIONS = [
  { x: 50, y: 50 },
  { x: 100, y: 100 },
  { x: 200, y: 50 },
  { x: 50, y: 200 },
  { x: 150, y: 150 }
];

// 창고 위치
const WAREHOUSE_LOCATION = { x: 500, y: 500 };

const machineNames = [
  "Counter-Balance Forklift Type AGV",
  "Pallet Truck Type AGV",
  "High-mast Reach Forklift Type AGV"
];

function generateMacAddress() {
  return Array.from({ length: 6 }, () => 
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join(':');
}

function getRandomPickupLocation() {
  return PICKUP_LOCATIONS[Math.floor(Math.random() * PICKUP_LOCATIONS.length)];
}

function clearOldRobots() {
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function generateMacAddress() {
  return Array.from({ length: 6 }, () => 
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join(':');
}

/**
 * 로봇 데이터 생성
 * - pickupStartTime: 픽업 후 경과 시간을 측정하기 위한 시작 시점 (ms)
 */
function generateRobotData(id) {
  return {
    id: `machine${id}`,
    name: machineNames[Math.floor(Math.random() * machineNames.length)],
    version: "v1.0.1",
    macaddr: generateMacAddress(),
    battery: 100,
    temperature: Math.floor(Math.random() * 30) + 20,
    location: { x: 0, y: 0 },
    previousLocation: { x: 0, y: 0 },
    charging: false,
    carryingProduct: false,
    currentPickupLocation: null,

    // 제품 픽업 시점 배터리 기록 (에너지 소모량 계산용)
    batteryAtPickup: null,

    // 제품을 픽업한 순간 Date.now() 저장
    pickupStartTime: null
  };
}

function createRobots(count) {
  clearOldRobots();
  const robots = {};
  for (let i = 1; i <= count; i++) {
    const robotId = `machine${i}`;
    const data = generateRobotData(i);
    saveRobotData(robotId, data);
    robots[robotId] = data;
  }
  return robots;
}

function saveRobotData(robotId, data) {
  const filePath = path.join(DATA_DIR, `${robotId}/device_info.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * 배달 완료 시 로그 기록
 * - distanceTraveled: 픽업 지점 ~ 창고까지의 직선 거리
 * - batteryConsumed: (픽업 배터리 - 도착 배터리) 등 실제 배터리 소모량
 * - timeSpentSec: 실제 경과 시간(초)
 */
function logProductMove(robot, distanceTraveled, batteryConsumed, timeSpentSec) {
  if (batteryConsumed == null) batteryConsumed = 0;
  if (timeSpentSec == null) timeSpentSec = 0;

  const filePath = path.join(DATA_DIR, `${robot.id}/product_info.json`);
  let records = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : [];

  const warehouseFloor = `${Math.floor(Math.random() * 5) + 1}층`;
  const itemCode = `WH${warehouseFloor[0]}-HW${Math.floor(Math.random() * 100000)}`;

  const newRecord = {
    code: itemCode,
    // 날짜 YYYY-MM-DD HH:MM:SS
    date: new Date().toISOString().slice(0, 19).replace('T',' '),
    // 이동 거리
    distance: distanceTraveled.toFixed(2),
    // 배터리 소모량
    energy_used: batteryConsumed.toFixed(2),
    // 실제 걸린 시간(초)
    est_time: timeSpentSec.toString(), 
    // 로봇 정보
    id: robot.id,
    name: robot.name,
    macaddr: robot.macaddr,
    warehouse_floor: warehouseFloor
  };

  records.push(newRecord);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), "utf8");
}

function getAllRobots() {
  if (!fs.existsSync(DATA_DIR)) return {};
  return fs.readdirSync(DATA_DIR)
    .filter((dir) => dir.startsWith("machine"))
    .reduce((robots, dir) => {
      const filePath = path.join(DATA_DIR, `${dir}/device_info.json`);
      if (fs.existsSync(filePath)) {
        robots[dir] = JSON.parse(fs.readFileSync(filePath, "utf8"));
      }
      return robots;
    }, {});
}

function updateRobotStatus() {
  const robots = getAllRobots();

  Object.values(robots).forEach((robot) => {
    // 1) 충전 중인 경우 이동 불가
    if (robot.charging) {
      robot.battery = Math.min(100, robot.battery + 10);
      if (robot.battery >= 100) {
        robot.charging = false;
        console.log(`${robot.id}이(가) 충전 완료되었습니다.`);
      }
      saveRobotData(robot.id, robot);
      return;
    }

    // 2) 현재 픽업 지점이 없다면 랜덤 픽업 지점 설정
    if (!robot.currentPickupLocation) {
      robot.currentPickupLocation = getRandomPickupLocation();
    }

    // 3) 로봇이 제품을 안 들고 있다면 => 픽업 위치로 이동
    if (!robot.carryingProduct) {
      const dxPick = robot.currentPickupLocation.x - robot.location.x;
      const dyPick = robot.currentPickupLocation.y - robot.location.y;
      const distToPickup = Math.sqrt(dxPick * dxPick + dyPick * dyPick);

      // 이동
      const fraction = 0.5;
      robot.location.x += fraction * dxPick;
      robot.location.y += fraction * dyPick;
      
      // 픽업 완료
      if (distToPickup < 10) {
        robot.batteryAtPickup = robot.battery;         // 배터리 기록
        robot.pickupStartTime = Date.now();            // 픽업 시점
        robot.carryingProduct = true;
        console.log(`${robot.id}이(가) 제품을 픽업했습니다. (배터리: ${robot.battery}%)`);
      }
    } else {
      // 4) 로봇이 제품을 들고 있다면 => 창고로 이동
      const dxWare = WAREHOUSE_LOCATION.x - robot.location.x;
      const dyWare = WAREHOUSE_LOCATION.y - robot.location.y;
      const distToWarehouse = Math.sqrt(dxWare * dxWare + dyWare * dyWare);
      
      const fraction = 0.5;
      robot.location.x += fraction * dxWare;
      robot.location.y += fraction * dyWare;
      
      if (distToWarehouse < 10) {
        // 픽업 지점 ~ 창고 사이 거리
        const dx = WAREHOUSE_LOCATION.x - robot.currentPickupLocation.x;
        const dy = WAREHOUSE_LOCATION.y - robot.currentPickupLocation.y;
        const pickupToWarehouseDistance = Math.sqrt(dx * dx + dy * dy);

        // 실질적 배터리 소모량
        let batteryUsed = robot.batteryAtPickup - robot.battery;
        if (batteryUsed < 0) batteryUsed = 0; // 중간 충전 시 음수 방지

        // 실제 걸린 시간 (초)
        let timeSpentSec = 0;
        if (robot.pickupStartTime) {
          const now = Date.now();
          timeSpentSec = Math.floor((now - robot.pickupStartTime) / 1000);
        }

        logProductMove(robot, pickupToWarehouseDistance, batteryUsed, timeSpentSec);

        // 상태 초기화
        robot.carryingProduct = false;
        robot.currentPickupLocation = null;
        robot.batteryAtPickup = null;
        robot.pickupStartTime = null;

        console.log(`${robot.id}이(가) 제품을 창고에 전달했습니다. (소모: ${batteryUsed}%, 시간: ${timeSpentSec}s)`);
      }
    }

    // 5) 추가 무작위 이동 -> 배터리 소모
    robot.previousLocation = { ...robot.location };
    robot.location.x += Math.random() * 5 - 2.5;
    robot.location.y += Math.random() * 5 - 2.5;

    const dx = robot.location.x - robot.previousLocation.x;
    const dy = robot.location.y - robot.previousLocation.y;
    const randomDistance = Math.sqrt(dx * dx + dy * dy);
    const randomBatteryConsumed = Math.floor(randomDistance);
    robot.battery = Math.max(0, robot.battery - randomBatteryConsumed);

    // 6) 배터리가 20 이하 => 충전 모드 전환 (중간에도 고려)
    if (robot.battery <= 20 && !robot.charging) {
      robot.charging = true;
      robot.location = { x: 0, y: 0 }; // 충전소로 이동(단순화)
      console.log(`${robot.id}이(가) 충전 모드로 전환되었습니다. (현재 배터리: ${robot.battery}%)`);
    }

    saveRobotData(robot.id, robot);
  });

  return robots;
}

module.exports = { createRobots, getAllRobots, updateRobotStatus, logProductMove };
