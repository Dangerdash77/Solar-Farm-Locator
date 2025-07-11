const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const csv = require("csv-parser");

require("dotenv").config();

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(cors());

let cities = [];

// -------------------- Haversine Distance --------------------
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// -------------------- Load CSV on Startup --------------------
function loadCityData() {
  const results = [];
  const filePath = path.join(__dirname, "cities15000.csv");

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", data => results.push(data))
    .on("end", () => {
      cities = results;
      console.log(`✅ Loaded ${cities.length} cities from CSV`);
    });
}

// -------------------- POST /api/analyze --------------------
app.post("/api/analyze", async (req, res) => {
  const {
    city,
    lat,
    lon,
    powerScale,
    delta,
    scale,
    price,
    mode,
    year = 2023,
  } = req.body;

  console.log("📥 Incoming Request:", req.body);

  let centerLat = parseFloat(lat);
  let centerLon = parseFloat(lon);

  if (mode === "city") {
    const found = cities.find(c => c.asciiname.toLowerCase() === city.toLowerCase());
    if (!found) {
      console.warn(`❌ City not found: ${city}`);
      return res.status(404).json({ error: "City not found" });
    }

    centerLat = parseFloat(found.latitude);
    centerLon = parseFloat(found.longitude);
    console.log(`📌 Using city: ${found.name}, lat: ${centerLat}, lon: ${centerLon}`);
  }

  const results = {
    unfeasible: [],
    moderate: [],
    good: [],
    excellent: [],
    max: -Infinity,
    maxCoords: [],
    monthly: [],
  };

  const latStart = centerLat - parseFloat(delta);
  const lonStart = centerLon - parseFloat(delta);
  const latEnd = centerLat + parseFloat(delta);
  const lonEnd = centerLon + parseFloat(delta);

  console.log("📊 Starting irradiance analysis...");

  for (let i = latStart; i <= latEnd; i += parseFloat(scale)) {
    for (let j = lonStart; j <= lonEnd; j += parseFloat(scale)) {
      try {
        const baseURL = process.env.REACT_API_URL;
        const url = `${baseURL}?lat=${i}&lon=${j}&horirrad=1&startyear=${year}&outputformat=basic`;

        const resp = await axios.get(url);
        const match = resp.data.match(/\d+\.\d+/g);
        if (!match || match.length !== 12) continue;

        const monthly = match.map(Number);
        const avg = monthly.reduce((sum, val) => sum + val, 0) / 12;
        const point = [i, j, avg];

        if (avg < 100) results.unfeasible.push(point);
        else if (avg < 150) results.moderate.push(point);
        else if (avg < 200) results.good.push(point);
        else results.excellent.push(point);

        if (avg > results.max) {
          results.max = avg;
          results.maxCoords = [i, j];
          results.monthly = monthly;
        }
      } catch (err) {
        console.error(`⚠️ Failed irradiance for ${i},${j}: ${err.message}`);
      }
    }
  }

  const [bestLat, bestLon] = results.maxCoords;
  if (!bestLat || !bestLon) {
    return res.status(500).json({ error: "Irradiance data fetch failed." });
  }

  console.log(`🌞 Best irradiance at: [${bestLat}, ${bestLon}] = ${results.max.toFixed(2)} kWh/m²/mo`);

  // Fetch settlement details
  try {
    const nominatimURL = `https://nominatim.openstreetmap.org/reverse?lat=${bestLat}&lon=${bestLon}&format=json`;
    const resp = await axios.get(nominatimURL, {
      headers: { "User-Agent": process.env.USER_AGENT || "Default-Agent" }
    });

    const data = resp.data;
    const name =
      data.address.city ||
      data.address.town ||
      data.address.village ||
      data.address.hamlet ||
      "Unknown";

    const dist = haversineDistance(bestLat, bestLon, parseFloat(data.lat), parseFloat(data.lon));
    const capex = powerScale * 4.25;
    const recovery = (capex * 1e7) / (powerScale * 4 * 1000 * 365 * (price - 3.74) * 0.3);

    results.settlement = {
      name,
      lat: data.lat,
      lon: data.lon,
      distance: dist,
      capex,
      transmissionCost: dist * 1.8,
      recoveryYears: recovery,
    };
  } catch (err) {
    console.warn("⚠️ Could not fetch nearby settlement:", err.message);
  }

  console.log("✅ Completed analysis. Sending response.");
  res.json(results);
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  loadCityData();
});
