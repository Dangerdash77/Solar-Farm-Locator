import React, { useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer } from "recharts";
import "leaflet/dist/leaflet.css";

const App = () => {
  const [method, setMethod] = useState("city");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState({ lat: "", lon: "" });
  const [delta, setDelta] = useState(0.3);
  const [scale, setScale] = useState(0.05);
  const [price, setPrice] = useState(7.5);
  const [power, setPower] = useState(5);
  const [year, setYear] = useState(2023);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendRequest = async () => {
    setLoading(true);
    const payload = {
      method,
      city,
      latitude: parseFloat(coords.lat),
      longitude: parseFloat(coords.lon),
      delta: parseFloat(delta),
      scale: parseFloat(scale),
      price: parseFloat(price),
      powerScale: parseFloat(power),
      year: parseInt(year)
    };
    try {
      const res = await axios.post("http://localhost:8080/analyze", payload);
      setResult(res.data);
    } catch (err) {
      alert("Error analyzing data");
    }
    setLoading(false);
  };

  const categories = ["unfeasible", "moderate", "good", "excellent"];
  const colors = {
    unfeasible: "gray",
    moderate: "orange",
    good: "green",
    excellent: "blue"
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-center">☀️ Solar Farm Locator</h1>

      <div className="grid md:grid-cols-2 gap-4 bg-white p-4 rounded-xl shadow">
        <div className="space-y-3">
          <label className="block font-semibold">Select Input Method:</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="w-full p-2 border rounded">
            <option value="city">City Name</option>
            <option value="coords">Coordinates</option>
          </select>

          {method === "city" ? (
            <input
              type="text"
              placeholder="Enter city name"
              className="w-full p-2 border rounded"
              value={city}
              onChange={e => setCity(e.target.value)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Latitude"
                value={coords.lat}
                onChange={e => setCoords({ ...coords, lat: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Longitude"
                value={coords.lon}
                onChange={e => setCoords({ ...coords, lon: e.target.value })}
                className="p-2 border rounded"
              />
            </div>
          )}

          <input type="number" value={delta} onChange={e => setDelta(e.target.value)} className="w-full p-2 border rounded" placeholder="Delta" />
          <input type="number" value={scale} onChange={e => setScale(e.target.value)} className="w-full p-2 border rounded" placeholder="Scale" />
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2 border rounded" placeholder="Price per kWh" />
          <input type="number" value={power} onChange={e => setPower(e.target.value)} className="w-full p-2 border rounded" placeholder="Power Scale (MW)" />
          <input type="number" value={year} onChange={e => setYear(e.target.value)} className="w-full p-2 border rounded" placeholder="Year" />

          <button
            className="w-full p-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700"
            onClick={sendRequest}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {result && (
          <div className="space-y-3 text-sm">
            <h2 className="text-xl font-semibold">Results Summary</h2>
            <p><strong>Best Location:</strong> {result.max.lat.toFixed(3)}, {result.max.lon.toFixed(3)} — {result.max.value.toFixed(2)} kWh/m²/mo</p>
            <p><strong>Settlement:</strong> {result.settlement.name}</p>
            <p><strong>Transmission Distance:</strong> {result.settlement.transmissionCost.toFixed(2)} crore</p>
            <p><strong>Recovery Time:</strong> {result.settlement.recoveryYears.toFixed(2)} years</p>
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="h-[500px] w-full">
            <MapContainer center={[result.base.lat, result.base.lon]} zoom={8} className="h-full w-full rounded-xl overflow-hidden">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {categories.map(cat => result.ranges[cat].map((point, idx) => (
                <CircleMarker
                  key={`${cat}-${idx}`}
                  center={[point.lat, point.lon]}
                  radius={5}
                  color={colors[cat]}
                  fillOpacity={0.6}
                >
                  <Tooltip>{`${cat} – ${point.avg.toFixed(1)} kWh/m²/mo`}</Tooltip>
                </CircleMarker>
              )))}
              <CircleMarker center={[result.max.lat, result.max.lon]} radius={8} color="red">
                <Tooltip>Best Location</Tooltip>
              </CircleMarker>
            </MapContainer>
          </div>

          <div className="h-64 bg-white mt-6 p-4 rounded-xl shadow">
            <h3 className="font-bold mb-2">CapEx Recovery Projection</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...Array(11)].map((_, i) => ({
                year: i,
                recovered: Math.min(i / result.settlement.recoveryYears, 1) * 100
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" label={{ value: "Years", position: "insideBottomRight", offset: -5 }} />
                <YAxis unit="%" domain={[0, 100]} />
                <RechartTooltip />
                <Line type="monotone" dataKey="recovered" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
