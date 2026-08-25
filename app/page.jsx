"use client";

import { useEffect, useMemo, useState } from "react";

const initialForm = {
  customer: { name: "", phone: "", email: "" },
  vehicle: { customerId: "", plate: "", brand: "", model: "", mileage: 0 },
  order: { vehicleId: "", reason: "", mileage: 0, priority: "normal" },
  part: { sku: "", name: "", cost: 0, price: 0, stock: 0, minimumStock: 0 },
  consume: { workOrderId: "", partId: "", quantity: 1 }
};

export default function HomePage() {
  const [token, setToken] = useState("");
  const [session, setSession] = useState("Sin sesion");
  const [forms, setForms] = useState(initialForm);
  const [data, setData] = useState({ customers: [], vehicles: [], workOrders: [], parts: [] });
  const [summary, setSummary] = useState({ openWorkOrders: 0, lowStockCount: 0, workOrdersByState: {} });
  const [log, setLog] = useState([]);
  const [plateSearch, setPlateSearch] = useState("");
  const [history, setHistory] = useState("");

  const stateCount = useMemo(() => Object.keys(summary.workOrdersByState || {}).length, [summary]);

  function addLog(message, payload) {
    const line = payload ? `${message}\n${JSON.stringify(payload, null, 2)}` : message;
    setLog((items) => [`${new Date().toLocaleTimeString()} ${line}`, ...items].slice(0, 20));
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
    addLog("Sesion iniciada");
    await refresh(body.token);
  }

  function updateForm(group, key, value) {
    setForms((current) => ({
      ...current,
      [group]: { ...current[group], [key]: value }
    }));
  }

  async function submit(group, endpoint, event) {
    event.preventDefault();
    try {
      const result = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(forms[group])
      });
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
    if (!saved) return;
    setToken(saved);
    setSession("Sesion guardada");
    refresh(saved).catch(() => {
      localStorage.removeItem("token");
      setToken("");
      setSession("Sin sesion");
    });
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
            <a href="#dashboard">Dashboard</a>
            <a href="#cliente">Cliente</a>
            <a href="#vehiculo">Vehiculo</a>
            <a href="#orden">Orden</a>
            <a href="#inventario">Inventario</a>
            <a href="#historial">Historial</a>
          </nav>
        </div>
        <div className="session">{session}</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP operativo</p>
            <h2>Recepcion, ordenes e inventario</h2>
          </div>
          <button type="button" onClick={() => login().catch((error) => addLog(`Error login: ${error.message}`))}>
            Entrar demo
          </button>
        </header>

        <section id="dashboard" className="band">
          <h3>Dashboard</h3>
          <div className="metrics">
            <div>
              <span>Ordenes abiertas</span>
              <strong>{summary.openWorkOrders}</strong>
            </div>
            <div>
              <span>Bajo stock</span>
              <strong>{summary.lowStockCount}</strong>
            </div>
            <div>
              <span>Estados</span>
              <strong>{stateCount}</strong>
            </div>
          </div>
        </section>

        <section className="grid">
          <form id="cliente" className="panel" onSubmit={(event) => submit("customer", "/customers", event)}>
            <h3>Nuevo cliente</h3>
            <label>Nombre <input value={forms.customer.name} onChange={(event) => updateForm("customer", "name", event.target.value)} required minLength={2} /></label>
            <label>Telefono <input value={forms.customer.phone} onChange={(event) => updateForm("customer", "phone", event.target.value)} required minLength={6} /></label>
            <label>Email <input value={forms.customer.email} onChange={(event) => updateForm("customer", "email", event.target.value)} type="email" /></label>
            <button type="submit">Guardar cliente</button>
          </form>

          <form id="vehiculo" className="panel" onSubmit={(event) => submit("vehicle", "/vehicles", event)}>
            <h3>Nuevo vehiculo</h3>
            <label>Cliente <select value={forms.vehicle.customerId} onChange={(event) => updateForm("vehicle", "customerId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select></label>
            <label>Patente <input value={forms.vehicle.plate} onChange={(event) => updateForm("vehicle", "plate", event.target.value)} required minLength={4} /></label>
            <label>Marca <input value={forms.vehicle.brand} onChange={(event) => updateForm("vehicle", "brand", event.target.value)} required /></label>
            <label>Modelo <input value={forms.vehicle.model} onChange={(event) => updateForm("vehicle", "model", event.target.value)} required /></label>
            <label>Kilometraje <input value={forms.vehicle.mileage} onChange={(event) => updateForm("vehicle", "mileage", Number(event.target.value))} type="number" min="0" required /></label>
            <button type="submit">Guardar vehiculo</button>
          </form>

          <form id="orden" className="panel" onSubmit={(event) => submit("order", "/work-orders", event)}>
            <h3>Nueva orden</h3>
            <label>Vehiculo <select value={forms.order.vehicleId} onChange={(event) => updateForm("order", "vehicleId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} {vehicle.brand} {vehicle.model}</option>)}
            </select></label>
            <label>Motivo <input value={forms.order.reason} onChange={(event) => updateForm("order", "reason", event.target.value)} required minLength={3} /></label>
            <label>Kilometraje <input value={forms.order.mileage} onChange={(event) => updateForm("order", "mileage", Number(event.target.value))} type="number" min="0" required /></label>
            <label>Prioridad <select value={forms.order.priority} onChange={(event) => updateForm("order", "priority", event.target.value)}>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
              <option value="baja">Baja</option>
            </select></label>
            <button type="submit">Crear orden</button>
          </form>

          <form id="inventario" className="panel" onSubmit={(event) => submit("part", "/parts", event)}>
            <h3>Nuevo repuesto</h3>
            <label>SKU <input value={forms.part.sku} onChange={(event) => updateForm("part", "sku", event.target.value)} required /></label>
            <label>Nombre <input value={forms.part.name} onChange={(event) => updateForm("part", "name", event.target.value)} required /></label>
            <label>Costo <input value={forms.part.cost} onChange={(event) => updateForm("part", "cost", Number(event.target.value))} type="number" min="0" required /></label>
            <label>Precio <input value={forms.part.price} onChange={(event) => updateForm("part", "price", Number(event.target.value))} type="number" min="0" required /></label>
            <label>Stock <input value={forms.part.stock} onChange={(event) => updateForm("part", "stock", Number(event.target.value))} type="number" min="0" required /></label>
            <label>Stock minimo <input value={forms.part.minimumStock} onChange={(event) => updateForm("part", "minimumStock", Number(event.target.value))} type="number" min="0" /></label>
            <button type="submit">Guardar repuesto</button>
          </form>

          <form className="panel" onSubmit={consumePart}>
            <h3>Usar repuesto</h3>
            <label>Orden <select value={forms.consume.workOrderId} onChange={(event) => updateForm("consume", "workOrderId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {data.workOrders.map((order) => <option key={order.id} value={order.id}>{order.id.slice(0, 8)} {order.state}</option>)}
            </select></label>
            <label>Repuesto <select value={forms.consume.partId} onChange={(event) => updateForm("consume", "partId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {data.parts.map((part) => <option key={part.id} value={part.id}>{part.sku} {part.name} ({part.stock})</option>)}
            </select></label>
            <label>Cantidad <input value={forms.consume.quantity} onChange={(event) => updateForm("consume", "quantity", Number(event.target.value))} type="number" min="1" required /></label>
            <button type="submit">Descontar stock</button>
          </form>

          <section id="historial" className="panel">
            <h3>Buscar patente</h3>
            <div className="row">
              <input value={plateSearch} onChange={(event) => setPlateSearch(event.target.value)} placeholder="ABCD12" />
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
