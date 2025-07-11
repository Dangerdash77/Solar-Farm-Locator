import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle
} from "react-leaflet";
import { Bar } from "react-chartjs-2";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "./App.css";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const heat = window.L.heatLayer(points, {
      radius: 35,
      blur: 30,
      maxZoom: 17,
      gradient: {
        0.0: "#0000ff",
        0.2: "#00ffff",
        0.4: "#00ff00",
        0.6: "#ffff00",
        0.8: "#ff9900",
        1.0: "#ff0000",
      },
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [points, map]);

  return null;
}

function App() {
  const [form, setForm] = useState({
    city: "",
    lat: "",
    lon: "",
    powerScale: 1,
    delta: 0.2,
    scale: 0.05,
    price: 5,
    mode: "city",
  });

  const [result, setResult] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      console.log("🔍 API Result:", data);
      setResult(data);
    } catch (err) {
      console.error("❌ Error in API request:", err);
    }
  };

  const heatPoints = [
    ...(result?.unfeasible || []),
    ...(result?.moderate || []),
    ...(result?.good || []),
    ...(result?.excellent || []),
  ].map(([lat, lon, val]) => [lat, lon, val / 50]);

  const chartData = {
    labels: result?.monthly?.map((_, i) => `Month ${i + 1}`),
    datasets: [
      {
        label: "Irradiance (kWh/m²)",
        data: result?.monthly || [],
        backgroundColor: "rgba(255, 99, 132, 0.6)",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="app-container">
      <h1>☀️ Solar Feasibility Analyzer</h1>

      <form className="form" onSubmit={handleSubmit}>
        <select
          value={form.mode}
          onChange={e => setForm({ ...form, mode: e.target.value })}
        >
          <option value="city">Search by City</option>
          <option value="coords">Use Coordinates</option>
        </select>
        {form.mode === "city" ? (
          <input
            placeholder="City"
            value={form.city}
            onChange={e => setForm({ ...form, city: e.target.value })}
          />
        ) : (
          <>
            <input
              placeholder="Latitude"
              value={form.lat}
              onChange={e => setForm({ ...form, lat: e.target.value })}
            />
            <input
              placeholder="Longitude"
              value={form.lon}
              onChange={e => setForm({ ...form, lon: e.target.value })}
            />
          </>
        )}
        <input
          type="number"
          step="0.1"
          placeholder="Power (MW)"
          value={form.powerScale}
          onChange={e => setForm({ ...form, powerScale: e.target.value })}
        />
        <input
          type="number"
          step="0.05"
          placeholder="Delta"
          value={form.delta}
          onChange={e => setForm({ ...form, delta: e.target.value })}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Grid scale"
          value={form.scale}
          onChange={e => setForm({ ...form, scale: e.target.value })}
        />
        <input
          type="number"
          step="0.1"
          placeholder="Electricity Price ₹"
          value={form.price}
          onChange={e => setForm({ ...form, price: e.target.value })}
        />
        <button>🔎 Analyze</button>
      </form>

      {result && (
        <>
          <button
            className="toggle-btn"
            onClick={() => setShowHeatmap(!showHeatmap)}
          >
            {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
          </button>

          <div className="map-chart-section">
            <MapContainer center={result.maxCoords} zoom={10} className="map">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {showHeatmap && <HeatLayer points={heatPoints} />}
              <Marker position={result.maxCoords}>
                <Popup>
                  <strong>Max Irradiance:</strong> {result.max.toFixed(2)} kWh/m²/mo
                </Popup>
              </Marker>
              <Circle
                center={result.maxCoords}
                radius={2000} // in meters
                pathOptions={{ color: "red", fillOpacity: 0.1 }}
              />
            </MapContainer>

            <div className="result-box">
              <h2>📍 Nearest Settlement</h2>
              <p><strong>Name:</strong> {result.settlement?.name || "Unknown"}</p>
              <p><strong>CAPEX:</strong> ₹{result.settlement?.capex?.toFixed(2)} Cr</p>
              <p><strong>Transmission Cost:</strong> ₹{result.settlement?.transmissionCost?.toFixed(2)} Cr</p>
              <p><strong>Recovery Time:</strong> {result.settlement?.recoveryYears?.toFixed(1)} years</p>
              <h3 style={{ marginTop: "20px" }}>📊 Monthly Irradiance</h3>
              <Bar data={chartData} height={220} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
