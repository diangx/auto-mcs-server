const express = require("express");
const fs = require("fs");
const path = require("path");
const { createRobots, getAllRobots } = require("../services/robotService");

const router = express.Router();
const DATA_DIR = path.join(__dirname, "../public/testdb");

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap
  }
  return array;
}

// 로봇 생성 API
router.post("/create-robots/:count", (req, res) => {
  const count = parseInt(req.params.count);
  if (isNaN(count) || count <= 0)
    return res.status(400).json({ error: "유효한 숫자를 입력하세요." });
  const robots = createRobots(count);
  res.json({ message: `✅ ${count}개의 로봇이 생성되었습니다.`, robots });
});

// 모든 로봇 상태 조회 API
router.get("/robots", (req, res) => res.json(getAllRobots()));

// 개별 로봇 조회 API (예: /api/robots/machine1)
router.get("/robots/:machineId", (req, res) => {
  const machineId = req.params.machineId;
  const filePath = path.join(DATA_DIR, `${machineId}/device_info.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      res.json(data);
    } catch (error) {
      console.error(`❌ JSON 파싱 오류: ${filePath}`);
      res.status(500).json({ error: "JSON 파싱 오류" });
    }
  } else {
    res.status(404).json({ error: "로봇을 찾을 수 없습니다." });
  }
});

// 전체 창고 상태 API (모든 로봇의 product_info.json 통합)
router.get("/warehouse", (req, res) => {
  let warehouseState = { "1층": [], "2층": [], "3층": [], "4층": [], "5층": [] };

  fs.readdirSync(DATA_DIR).forEach((robot) => {
    const filePath = path.join(DATA_DIR, robot, "product_info.json");
    if (fs.existsSync(filePath)) {
      try {
        const records = JSON.parse(fs.readFileSync(filePath, "utf8"));
        records.forEach((record) => {
          if (warehouseState[record.warehouse_floor]) {
            warehouseState[record.warehouse_floor].push(record);
          }
        });
      } catch (error) {
        console.error(`❌ JSON 파싱 오류: ${filePath}`, error);
      }
    }
  });

  // 모든 데이터를 하나의 배열로 평탄화 (1층, 2층 등의 구분 제거)
  let allRecords = Object.values(warehouseState).flat();

  // 데이터를 랜덤하게 섞기
  allRecords = shuffle(allRecords);

  // 검색 기능 추가 (예: ?search=ABC123)
  const searchQuery = req.query.search?.toLowerCase();
  if (searchQuery) {
    allRecords = allRecords.filter((record) =>
      record.code.toLowerCase().includes(searchQuery)
    );
  }

  // 페이징 기능 추가 (예: ?page=1&limit=10)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedRecords = allRecords.slice(startIndex, endIndex);

  // 응답 데이터 반환
  res.json({
    totalItems: allRecords.length, // 전체 데이터 개수
    totalPages: Math.ceil(allRecords.length / limit),
    currentPage: page,
    data: paginatedRecords, // 페이징 적용된 데이터 반환
  });
});

// 개별 로봇의 창고 기록 API (예: /api/warehouse/machine1)
router.get("/warehouse/:machineId", (req, res) => {
  const machineId = req.params.machineId;
  const filePath = path.join(DATA_DIR, `${machineId}/product_info.json`);
  if (fs.existsSync(filePath)) {
    try {
      const records = JSON.parse(fs.readFileSync(filePath, "utf8"));
      res.json(records);
    } catch (error) {
      console.error(`❌ JSON 파싱 오류: ${filePath}`);
      res.status(500).json({ error: "JSON 파싱 오류" });
    }
  } else {
    res.status(404).json({ error: "창고 기록이 존재하지 않습니다." });
  }
});

router.post("/update-firmware", async (req, res) => {
  try {
    const { macAddress, fileName } = req.body;

    if (!macAddress || !fileName) {
      return res.status(400).json({ message: "MAC address and fileName are required." });
    }

    const regex = /(cf|pt|hrf)_agv_v?(\d+\.\d+\.\d+)\.img/;
    const match = fileName.match(regex);

    if (!match) {
      return res.status(400).json({ message: "Invalid file format. Example: cf_agv_v1.0.2.img" });
    }

    const version = `v${match[2]}`;

    let foundMachine = null;

    fs.readdirSync(DATA_DIR).forEach(machine => {
      const deviceFile = path.join(DATA_DIR, machine, "device_info.json");
      if (fs.existsSync(deviceFile)) {
        const data = JSON.parse(fs.readFileSync(deviceFile, "utf-8"));
        if (data.macaddr === macAddress) {
          foundMachine = { machine, path: deviceFile, data };
        }
      }
    });

    if (!foundMachine) {
      return res.status(404).json({ message: "MAC address not found in database." });
    }

    foundMachine.data.version = version;
    fs.writeFileSync(foundMachine.path, JSON.stringify(foundMachine.data, null, 2));

    console.log(`🔄 Firmware updated for ${foundMachine.machine} to version ${version}`);

    return res.json({
      message: `Firmware version updated to ${version} for MAC: ${macAddress} (Machine: ${foundMachine.machine})`,
      updatedDevice: foundMachine.data
    });

  } catch (error) {
    console.error("Error in updateFirmware:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
