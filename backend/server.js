const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;
app.use(cors());
app.use(express.json());

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = deg => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const cities = [];
fs.createReadStream(path.join(__dirname, "cities15000.csv"))
  .pipe(csv())
  .on("data", row => cities.push(row))
  .on("end", () => console.log("✅ Loaded city data"));

app.post("/analyze", async (req, res) => {
  const {
    method,
    city,
    latitude,
    longitude,
    delta,
    scale,
    price,
    powerScale,
    year
  } = req.body;

  let baseLat = latitude;
  let baseLon = longitude;

  if (method === "city") {
    const cityRow = cities.find(row => row.asciiname?.toLowerCase() === city?.toLowerCase());
    if (!cityRow) {
      return res.status(404).json({ error: "City not found in dataset" });
    }
    baseLat = parseFloat(cityRow.latitude);
    baseLon = parseFloat(cityRow.longitude);
    console.log(`📍 Using city \"${city}\" at [${baseLat}, ${baseLon}]`);
  }

  if (!baseLat || !baseLon || isNaN(baseLat) || isNaN(baseLon)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  const ranges = { unfeasible: [], moderate: [], good: [], excellent: [] };
  let max = -1, maxLat = 0, maxLon = 0;

  for (let i = baseLat - delta; i <= baseLat + delta; i += scale) {
    for (let j = baseLon - delta; j <= baseLon + delta; j += scale) {
      const url = `https://re.jrc.ec.europa.eu/api/MRcalc?lat=${i}&lon=${j}&horirrad=1&startyear=${year}&outputformat=basic`;
      try {
        const response = await axios.get(url);
        const matches = response.data.match(/\d+\.\d+/g);
        const sum = matches.reduce((acc, val) => acc + parseFloat(val), 0);
        const avg = sum / 12;
        if (avg > max) {
          max = avg;
          maxLat = i;
          maxLon = j;
        }
        const point = { lat: i, lon: j, avg };
        if (avg < 100) ranges.unfeasible.push(point);
        else if (avg < 150) ranges.moderate.push(point);
        else if (avg < 200) ranges.good.push(point);
        else ranges.excellent.push(point);
      } catch (e) {
        console.error("❌ Failed to fetch irradiance for", i, j);
      }
    }
  }

  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${maxLat}&lon=${maxLon}&format=json`;
  let settlement = {};
  try {
    const result = await axios.get(nominatimUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = result.data;
    const name = data.address.city || data.address.town || data.address.village || data.address.hamlet || "Unknown";
    const dist = haversineDistance(maxLat, maxLon, baseLat, baseLon);
    const capex = powerScale * 4.25;
    const transmissionCost = dist * 1.8;
    settlement = {
      name,
      lat: data.lat,
      lon: data.lon,
      capex,
      transmissionCost,
      recoveryYears: capex * 1e7 / (powerScale * 4 * 1000 * 365 * (price - 3.74) * 0.3)
    };
  } catch (e) {
    console.error("❌ Settlement lookup failed");
  }

  res.json({
    max: { value: max, lat: maxLat, lon: maxLon },
    base: { lat: baseLat, lon: baseLon },
    ranges,
    settlement
  });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));