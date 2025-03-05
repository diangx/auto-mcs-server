const express = require("express");
const fs = require("fs");
const path = require("path");
const { createRobots, getAllRobots } = require("../services/robotService");

const router = express.Router();
const DATA_DIR = path.join(__dirname, "../public/testdb");

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
        console.error(`❌ JSON 파싱 오류: ${filePath}`);
      }
    }
  });

  res.json(warehouseState);
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

module.exports = router;
