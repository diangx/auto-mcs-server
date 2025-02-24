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
    currentPickupLocation: null
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

function logProductMove(robot, distanceTraveled, batteryConsumed) {
  const filePath = path.join(DATA_DIR, `${robot.id}/product_info.json`);
  let records = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : [];

  const warehouseFloor = `${Math.floor(Math.random() * 5) + 1}층`;
  const itemCode = `WH${warehouseFloor[0]}-HW${Math.floor(Math.random() * 100000)}`;

  const newRecord = {
    code: itemCode,
    date: new Date().toISOString().split("T")[0],
    distance: distanceTraveled.toFixed(2),
    energy_used: batteryConsumed.toFixed(2),
    est_time: Math.floor(Math.random() * 2000) + 500,
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
    // 충전 중인 경우 이동 불가
    if (robot.charging) {
      robot.battery = Math.min(100, robot.battery + 10);
      if (robot.battery >= 100) {
        robot.charging = false;
        console.log(`${robot.id}이(가) 충전 완료되었습니다.`);
      }
      saveRobotData(robot.id, robot);
      return;
    }

    // 현재 픽업 지점이 없다면 랜덤 픽업 지점 설정
    if (!robot.currentPickupLocation) {
      robot.currentPickupLocation = getRandomPickupLocation();
    }

    if (!robot.carryingProduct) {
      // 이동을 픽업 위치로 유도
      const dxPick = robot.currentPickupLocation.x - robot.location.x;
      const dyPick = robot.currentPickupLocation.y - robot.location.y;
      const distToPickup = Math.sqrt(dxPick * dxPick + dyPick * dyPick);

      // 픽업 위치로 50% 비율로 이동
      const fraction = 0.5;
      robot.location.x += fraction * dxPick;
      robot.location.y += fraction * dyPick;
      
      if (distToPickup < 10) {
        robot.carryingProduct = true;
        console.log(`${robot.id}이(가) 제품을 픽업했습니다.`);
      }
    } else {
      // 물건을 들고 있으면 창고 위치로 이동
      const dxWare = WAREHOUSE_LOCATION.x - robot.location.x;
      const dyWare = WAREHOUSE_LOCATION.y - robot.location.y;
      const distToWarehouse = Math.sqrt(dxWare * dxWare + dyWare * dyWare);
      
      const fraction = 0.5;
      robot.location.x += fraction * dxWare;
      robot.location.y += fraction * dyWare;
      
      if (distToWarehouse < 10) {
        // 픽업 지점 ~ 창고 사이 거리로 배터리 계산
        const dx = WAREHOUSE_LOCATION.x - robot.currentPickupLocation.x;
        const dy = WAREHOUSE_LOCATION.y - robot.currentPickupLocation.y;
        const pickupToWarehouseDistance = Math.sqrt(dx * dx + dy * dy);
        const batteryConsumed = Math.floor(pickupToWarehouseDistance * 1);
        logProductMove(robot, pickupToWarehouseDistance, batteryConsumed);
        robot.carryingProduct = false;
        // 배달 완료 후 다음 랜덤 위치로 바꿀 수 있게 null 처리
        robot.currentPickupLocation = null;
        console.log(`${robot.id}이(가) 제품을 창고에 전달했습니다.`);
      }
    }

    // 로봇 이동 후 배터리 소모 (추가적인 랜덤 이동)
    robot.previousLocation = { ...robot.location };
    robot.location.x += Math.random() * 5 - 2.5;
    robot.location.y += Math.random() * 5 - 2.5;

    const dx = robot.location.x - robot.previousLocation.x;
    const dy = robot.location.y - robot.previousLocation.y;
    const randomDistance = Math.sqrt(dx * dx + dy * dy);
    const randomBatteryConsumed = Math.floor(randomDistance * 1);
    robot.battery = Math.max(0, robot.battery - randomBatteryConsumed);

    if (robot.battery <= 20 && !robot.charging) {
      robot.charging = true;
      robot.location = { x: 0, y: 0 };
      console.log(`${robot.id}이(가) 충전 모드로 전환되었습니다.`);
    }

    saveRobotData(robot.id, robot);
  });

  return robots;
}

module.exports = { createRobots, getAllRobots, updateRobotStatus, logProductMove };
