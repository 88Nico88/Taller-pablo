"use client";

import { useEffect, useMemo, useState } from "react";

const initialForm = {
  quick: {
    customerName: "",
    phone: "",
    plate: "",
    brand: "",
    model: "",
    mileage: 0,
    reason: "Mantencion general",
    priority: "normal"
  },
  customer: { name: "", phone: "", email: "" },
  vehicle: { customerId: "", plate: "", brand: "", model: "", mileage: 0 },
  order: { vehicleId: "", reason: "", mileage: 0, priority: "normal" },
  part: { sku: "", name: "", cost: 0, price: 0, stock: 0, minimumStock: 0 },
  consume: { workOrderId: "", partId: "", quantity: 1 }
};

const servicePresets = ["Mantencion general", "Cambio de aceite", "Revision de frenos", "Scanner / diagnostico", "Ruido en tren delantero"];
const vehiclePresets = [
  { brand: "Toyota", model: "Yaris" },
  { brand: "Chevrolet", model: "Sail" },
  { brand: "Hyundai", model: "Accent" },
  { brand: "Nissan", model: "Versa" }
];

export default function HomePage() {
  const [token, setToken] = useState("");
  const [session, setSession] = useState("Sin sesion");
  const [forms, setForms] = useState(initialForm);
  const [data, setData] = useState({ customers: [], vehicles: [], workOrders: [], parts: [] });
  const [summary, setSummary] = useState({ openWorkOrders: 0, lowStockCount: 0, workOrdersByState: {} });
  const [log, setLog] = useState([]);
  const [plateSearch, setPlateSearch] = useState("");
  const [history, setHistory] = useState("");
  const [busy, setBusy] = useState(false);

  const stateCount = useMemo(() => Object.keys(summary.workOrdersByState || {}).length, [summary]);
  const latestOrders = useMemo(() => data.workOrders.slice(0, 5), [data.workOrders]);

  function addLog(message, payload) {
    const line = payload ? `${message}\n${JSON.stringify(payload, null, 2)}` : message;
    setLog((items) => [`${new Date().toLocaleTimeString()} ${line}`, ...items].slice(0, 14));
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
    return body;
  }

  async function refresh(activeToken = token) {
    if (!activeToken) return;
    const request = (path) =>
      fetch(`/api${path}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      }).then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
        return body;
      });

    const [customers, vehicles, workOrders, parts, dashboard] = await Promise.all([
      request("/customers"),
      request("/vehicles"),
      request("/work-orders"),
      request("/parts"),
      request("/dashboard/summary")
    ]);
    setData({
      customers: customers.data,
      vehicles: vehicles.data,
      workOrders: workOrders.data,
      parts: parts.data
    });
    setSummary(dashboard.data);
  }

  async function login() {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@taller.local", password: "admin12345" })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || "Login failed");
    localStorage.setItem("token", body.token);
    setToken(body.token);
    setSession(`${body.user.name} (${body.user.role})`);
    await refresh(body.token);
  }

  function updateForm(group, key, value) {
    setForms((current) => ({
      ...current,
      [group]: { ...current[group], [key]: value }
    }));
  }

  function applyVehiclePreset(preset) {
    setForms((current) => ({
      ...current,
      quick: { ...current.quick, brand: preset.brand, model: preset.model }
    }));
  }

  function fillDemoReception() {
    setForms((current) => ({
      ...current,
      quick: {
        customerName: "Carlos Morales",
        phone: "+569 8765 4321",
        plate: `TP${Math.floor(1000 + Math.random() * 8999)}`,
        brand: "Toyota",
        model: "Yaris",
        mileage: 84200,
        reason: "Mantencion general",
        priority: "normal"
      }
    }));
  }

  async function submitQuickReception(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const quick = forms.quick;
      const customer = await api("/customers", {
        method: "POST",
        body: JSON.stringify({ name: quick.customerName, phone: quick.phone })
      });
      const vehicle = await api("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.data.id,
          plate: quick.plate,
          brand: quick.brand,
          model: quick.model,
          mileage: Number(quick.mileage)
        })
      });
      const order = await api("/work-orders", {
        method: "POST",
        body: JSON.stringify({
          vehicleId: vehicle.data.id,
          reason: quick.reason,
          mileage: Number(quick.mileage),
          priority: quick.priority
        })
      });
      setForms((current) => ({ ...current, quick: initialForm.quick }));
      addLog("Ingreso rapido creado", { customer: customer.data.name, plate: vehicle.data.plate, order: order.data.id });
      await refresh();
    } catch (error) {
      addLog(`Error recepcion: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function submit(group, endpoint, event) {
    event.preventDefault();
    try {
      const result = await api(endpoint, { method: "POST", body: JSON.stringify(forms[group]) });
      setForms((current) => ({ ...current, [group]: initialForm[group] }));
      addLog("Registro creado", result.data);
      await refresh();
    } catch (error) {
      addLog(`Error: ${error.message}`);
    }
  }

  async function consumePart(event) {
    event.preventDefault();
    try {
      const result = await api(`/work-orders/${forms.consume.workOrderId}/parts`, {
        method: "POST",
        body: JSON.stringify({ partId: forms.consume.partId, quantity: Number(forms.consume.quantity) })
      });
      setForms((current) => ({ ...current, consume: initialForm.consume }));
      addLog("Stock descontado", result.data);
      await refresh();
    } catch (error) {
      addLog(`Error stock: ${error.message}`);
    }
  }

  async function searchVehicle() {
    try {
      const vehicle = await api(`/vehicles/by-plate/${encodeURIComponent(plateSearch)}`);
      const vehicleHistory = await api(`/vehicles/${vehicle.data.id}/history`);
      setHistory(JSON.stringify({ vehicle: vehicle.data, history: vehicleHistory.data }, null, 2));
    } catch (error) {
      setHistory(error.message);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) {
      setToken(saved);
      setSession("Sesion guardada");
      refresh(saved).catch(() => {
        localStorage.removeItem("token");
        setToken("");
        setSession("Sin sesion");
      });
      return;
    }
    login().catch((error) => addLog(`Error login: ${error.message}`));
  }, []);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-main">
          <div>
            <p className="eyebrow">Operacion</p>
            <h1>Taller Automotriz Pablo</h1>
          </div>
          <nav>
            <a href="#recepcion">Recepcion</a>
            <a href="#ordenes">Ordenes</a>
            <a href="#inventario">Inventario</a>
            <a href="#historial">Historial</a>
          </nav>
        </div>
        <div className="session">{session}</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Mostrador</p>
            <h2>Ingreso rapido de vehiculo y orden</h2>
          </div>
          <div className="top-actions">
            <button type="button" className="ghost" onClick={fillDemoReception}>Datos demo</button>
            <button type="button" onClick={() => login().catch((error) => addLog(`Error login: ${error.message}`))}>Entrar demo</button>
          </div>
        </header>

        <section id="dashboard" className="metrics strip">
          <div>
            <span>Ordenes abiertas</span>
            <strong>{summary.openWorkOrders}</strong>
          </div>
          <div>
            <span>Vehiculos ingresados</span>
            <strong>{data.vehicles.length}</strong>
          </div>
          <div>
            <span>Bajo stock</span>
            <strong>{summary.lowStockCount}</strong>
          </div>
          <div>
            <span>Estados activos</span>
            <strong>{stateCount}</strong>
          </div>
        </section>

        <section className="workbench">
          <form id="recepcion" className="panel hero-panel" onSubmit={submitQuickReception}>
            <div className="panel-title">
              <div>
                <p className="eyebrow">Paso unico</p>
                <h3>Recepcion rapida</h3>
              </div>
              <span className="badge">Cliente + auto + orden</span>
            </div>

            <div className="quick-grid">
              <label>Cliente
                <input value={forms.quick.customerName} onChange={(event) => updateForm("quick", "customerName", event.target.value)} placeholder="Nombre del cliente" required minLength={2} />
              </label>
              <label>Telefono
                <input value={forms.quick.phone} onChange={(event) => updateForm("quick", "phone", event.target.value)} placeholder="WhatsApp" required minLength={6} />
              </label>
              <label>Patente
                <input className="plate-input" value={forms.quick.plate} onChange={(event) => updateForm("quick", "plate", event.target.value.toUpperCase())} placeholder="ABCD12" required minLength={4} maxLength={10} />
              </label>
              <label>Kilometraje
                <input value={forms.quick.mileage} onChange={(event) => updateForm("quick", "mileage", Number(event.target.value))} type="number" min="0" required />
              </label>
              <label>Marca
                <input value={forms.quick.brand} onChange={(event) => updateForm("quick", "brand", event.target.value)} placeholder="Toyota" required minLength={2} />
              </label>
              <label>Modelo
                <input value={forms.quick.model} onChange={(event) => updateForm("quick", "model", event.target.value)} placeholder="Yaris" required />
              </label>
            </div>

            <div className="chips" aria-label="Modelos frecuentes">
              {vehiclePresets.map((preset) => <button key={`${preset.brand}-${preset.model}`} type="button" className="chip" onClick={() => applyVehiclePreset(preset)}>{preset.brand} {preset.model}</button>)}
            </div>

            <div className="quick-grid order-row">
              <label>Trabajo solicitado
                <input value={forms.quick.reason} onChange={(event) => updateForm("quick", "reason", event.target.value)} list="service-presets" required minLength={3} />
                <datalist id="service-presets">
                  {servicePresets.map((preset) => <option key={preset} value={preset} />)}
                </datalist>
              </label>
              <label>Prioridad
                <select value={forms.quick.priority} onChange={(event) => updateForm("quick", "priority", event.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                  <option value="baja">Baja</option>
                </select>
              </label>
            </div>

            <button type="submit" className="primary-action" disabled={busy}>{busy ? "Ingresando..." : "Ingresar vehiculo y crear orden"}</button>
          </form>

          <section id="ordenes" className="panel compact-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Cola</p>
                <h3>Ultimas ordenes</h3>
              </div>
            </div>
            <div className="order-list">
              {latestOrders.length === 0 ? <p className="empty">Sin ordenes aun.</p> : latestOrders.map((order) => {
                const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
                return (
                  <div className="order-item" key={order.id}>
                    <strong>{vehicle?.plate || order.id.slice(0, 8)}</strong>
                    <span>{order.reason}</span>
                    <em>{order.state} / {order.priority}</em>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <section className="tools-grid">
          <form id="inventario" className="panel" onSubmit={(event) => submit("part", "/parts", event)}>
            <h3>Inventario rapido</h3>
            <div className="mini-grid">
              <label>SKU <input value={forms.part.sku} onChange={(event) => updateForm("part", "sku", event.target.value)} required /></label>
              <label>Repuesto <input value={forms.part.name} onChange={(event) => updateForm("part", "name", event.target.value)} required /></label>
              <label>Precio <input value={forms.part.price} onChange={(event) => updateForm("part", "price", Number(event.target.value))} type="number" min="0" required /></label>
              <label>Stock <input value={forms.part.stock} onChange={(event) => updateForm("part", "stock", Number(event.target.value))} type="number" min="0" required /></label>
            </div>
            <input type="hidden" value={forms.part.cost} readOnly />
            <input type="hidden" value={forms.part.minimumStock} readOnly />
            <button type="submit">Guardar repuesto</button>
          </form>

          <form className="panel" onSubmit={consumePart}>
            <h3>Descontar stock</h3>
            <label>Orden <select value={forms.consume.workOrderId} onChange={(event) => updateForm("consume", "workOrderId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {data.workOrders.map((order) => <option key={order.id} value={order.id}>{order.id.slice(0, 8)} {order.state}</option>)}
            </select></label>
            <label>Repuesto <select value={forms.consume.partId} onChange={(event) => updateForm("consume", "partId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {data.parts.map((part) => <option key={part.id} value={part.id}>{part.sku} {part.name} ({part.stock})</option>)}
            </select></label>
            <label>Cantidad <input value={forms.consume.quantity} onChange={(event) => updateForm("consume", "quantity", Number(event.target.value))} type="number" min="1" required /></label>
            <button type="submit">Descontar</button>
          </form>

          <section id="historial" className="panel">
            <h3>Historial por patente</h3>
            <div className="row">
              <input className="plate-input" value={plateSearch} onChange={(event) => setPlateSearch(event.target.value.toUpperCase())} placeholder="ABCD12" />
              <button type="button" onClick={searchVehicle}>Buscar</button>
            </div>
            <pre>{history}</pre>
          </section>
        </section>

        <section className="band">
          <h3>Actividad</h3>
          <pre>{log.join("\n\n")}</pre>
        </section>
      </section>
    </main>
  );
}
