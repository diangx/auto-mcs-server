const express = require("express");
const http = require("http");
const cors = require("cors");
const { setupWebSocket } = require("./services/wsService");
const apiRoutes = require("./routes/apiRoutes");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/api", apiRoutes);

setupWebSocket(server);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
