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

const views = {
  dashboard: "Panel",
  reception: "Recepcion",
  vehicles: "Vehiculos",
  orders: "Ordenes",
  inventory: "Repuestos",
  history: "Historial",
  closeout: "Cierre",
  backup: "Respaldo",
  account: "Cuenta"
};

const orderStates = ["recibido", "en_diagnostico", "esperando_aprobacion", "en_reparacion", "esperando_repuesto", "listo", "entregado", "detenido"];

const money = (value) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function HomePage() {
  const [activeView, setActiveView] = useState("dashboard");
  const [token, setToken] = useState("");
  const [session, setSession] = useState("Sin sesion");
  const [authForm, setAuthForm] = useState({ email: "admin@taller.local", password: "admin12345" });
  const [authError, setAuthError] = useState("");
  const [forms, setForms] = useState(initialForm);
  const [data, setData] = useState({ customers: [], vehicles: [], workOrders: [], parts: [] });
  const [summary, setSummary] = useState({ openWorkOrders: 0, lowStockCount: 0, workOrdersByState: {} });
  const [log, setLog] = useState([]);
  const [plateSearch, setPlateSearch] = useState("");
  const [history, setHistory] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const stateCount = useMemo(() => Object.keys(summary.workOrdersByState || {}).length, [summary]);
  const latestOrders = useMemo(() => data.workOrders.slice(0, 6), [data.workOrders]);
  const lowStockParts = useMemo(() => data.parts.filter((part) => Number(part.stock) <= Number(part.minimumStock || 0)), [data.parts]);
  const inventoryValue = useMemo(() => data.parts.reduce((total, part) => total + Number(part.stock || 0) * Number(part.cost || 0), 0), [data.parts]);
  const finishedOrders = useMemo(() => data.workOrders.filter((order) => ["listo", "entregado"].includes(order.state)).length, [data.workOrders]);
  const activeVehicles = useMemo(() => new Set(data.workOrders.filter((order) => !["entregado", "detenido"].includes(order.state)).map((order) => order.vehicleId)).size, [data.workOrders]);

  const filteredVehicles = useMemo(() => {
    const term = vehicleSearch.trim().toLowerCase();
    if (!term) return data.vehicles;
    return data.vehicles.filter((vehicle) => {
      const customer = customerById(vehicle.customerId);
      return [vehicle.plate, vehicle.brand, vehicle.model, vehicle.mileage, customer?.name, customer?.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data.vehicles, data.customers, vehicleSearch]);

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    if (!term) return data.workOrders;
    return data.workOrders.filter((order) => {
      const vehicle = vehicleById(order.vehicleId);
      const customer = customerById(vehicle?.customerId);
      return [order.reason, order.state, order.priority, vehicle?.plate, vehicle?.brand, vehicle?.model, customer?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data.workOrders, data.vehicles, data.customers, orderSearch]);

  const filteredParts = useMemo(() => {
    const term = partSearch.trim().toLowerCase();
    if (!term) return data.parts;
    return data.parts.filter((part) => [part.sku, part.name, part.brand, part.location].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [data.parts, partSearch]);

  function addLog(message, payload) {
    const line = payload ? `${message}\n${JSON.stringify(payload, null, 2)}` : message;
    setLog((items) => [`${new Date().toLocaleTimeString()} ${line}`, ...items].slice(0, 16));
    showToast(message);
  }

  function showToast(message) {
    setToast(message);
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => setToast(""), 2600);
  }

  function vehicleById(id) {
    return data.vehicles.find((vehicle) => vehicle.id === id);
  }

  function customerById(id) {
    return data.customers.find((customer) => customer.id === id);
  }

  function ordersByVehicle(vehicleId) {
    return data.workOrders.filter((order) => order.vehicleId === vehicleId);
  }

  function latestOrderForVehicle(vehicleId) {
    return ordersByVehicle(vehicleId)[0];
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

  async function login(event) {
    event?.preventDefault?.();
    setAuthError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authForm)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body.error?.message || "Login failed";
      setAuthError(message);
      throw new Error(message);
    }
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
    setActiveView("reception");
  }

  async function seedWorkshopDemo() {
    setBusy(true);
    try {
      const suffix = Date.now().toString().slice(-4);
      const customer = await api("/customers", {
        method: "POST",
        body: JSON.stringify({ name: "Cliente demostracion", phone: "+569 1111 2222" })
      });
      const vehicle = await api("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.data.id,
          plate: `DEMO${suffix}`,
          brand: "Toyota",
          model: "Yaris",
          mileage: 72400
        })
      });
      await api("/work-orders", {
        method: "POST",
        body: JSON.stringify({
          vehicleId: vehicle.data.id,
          reason: "Revision general y scanner",
          mileage: 72400,
          priority: "alta"
        })
      });
      await Promise.all([
        api("/parts", { method: "POST", body: JSON.stringify({ sku: `ACE-${suffix}`, name: "Aceite 5W30", cost: 4500, price: 7900, stock: 8, minimumStock: 3 }) }),
        api("/parts", { method: "POST", body: JSON.stringify({ sku: `FIL-${suffix}`, name: "Filtro aceite", cost: 2800, price: 5900, stock: 2, minimumStock: 4 }) })
      ]);
      await refresh();
      setActiveView("dashboard");
      addLog("Demo de taller cargada");
    } catch (error) {
      addLog(`Error demo: ${error.message}`);
    } finally {
      setBusy(false);
    }
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
      setActiveView("orders");
      addLog("Ingreso creado", { cliente: customer.data.name, patente: vehicle.data.plate, orden: order.data.id });
      await refresh();
    } catch (error) {
      addLog(`Error recepcion: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function createPart(event) {
    event.preventDefault();
    try {
      const result = await api("/parts", { method: "POST", body: JSON.stringify(forms.part) });
      setForms((current) => ({ ...current, part: initialForm.part }));
      addLog("Repuesto creado", result.data);
      await refresh();
    } catch (error) {
      addLog(`Error repuesto: ${error.message}`);
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

  async function updateOrderState(orderId, state) {
    try {
      await api(`/work-orders/${orderId}/state`, {
        method: "PATCH",
        body: JSON.stringify({ state })
      });
      await refresh();
    } catch (error) {
      addLog(`Error estado: ${error.message}`);
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

  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      project: "taller-automotriz-pablo",
      customers: data.customers,
      vehicles: data.vehicles,
      workOrders: data.workOrders,
      parts: data.parts,
      summary
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taller-pablo-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addLog("Respaldo exportado");
  }

  function sendLowStockWhatsapp() {
    if (lowStockParts.length === 0) {
      showToast("No hay repuestos bajo stock");
      return;
    }
    const lines = lowStockParts.map((part) => `- ${part.name} (${part.sku}): stock ${part.stock}, minimo ${part.minimumStock}`);
    const message = encodeURIComponent(["Pedido sugerido Taller Pablo:", ...lines, "", "Revisar cantidades antes de comprar."].join("\n"));
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
    addLog("Pedido de stock preparado");
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setSession("Sin sesion");
    setData({ customers: [], vehicles: [], workOrders: [], parts: [] });
    setSummary({ openWorkOrders: 0, lowStockCount: 0, workOrdersByState: {} });
    showToast("Sesion cerrada");
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
  }, []);

  if (!token) {
    return (
      <main className="auth-screen">
        <section className="auth-hero">
          <div className="brand auth-brand">
            <div className="brand-mark">TP</div>
            <div>
              <strong>Taller Pablo</strong>
              <span>Vehiculos, ordenes y repuestos</span>
            </div>
          </div>
          <h1>Control de taller con historial por patente.</h1>
          <p>Recepcion de vehiculos, ordenes de trabajo, repuestos usados, alertas de stock y respaldo operativo en una app privada.</p>
          <div className="auth-proof">
            <span>Vehiculos</span>
            <span>Ordenes</span>
            <span>Repuestos</span>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-head">
            <span className="mode-pill">Acceso privado</span>
            <h2>Entrar a Taller Pablo</h2>
            <p>Usa la cuenta asignada para operar el mostrador.</p>
          </div>
          <form className="auth-form active" onSubmit={login}>
            <label>Correo<input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} required /></label>
            <label>Contrasena<input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} required minLength={8} /></label>
            {authError ? <div className="auth-error">{authError}</div> : null}
            <button className="primary-button full" type="submit">Iniciar sesion</button>
            <button className="ghost-button full" type="button" onClick={() => login().catch((error) => setAuthError(error.message))}>Entrar demo</button>
          </form>
          <div className="auth-footer">
            <span>Demo aislada de FlowStock</span>
            <strong>Sin datos reales</strong>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TP</div>
          <div>
            <strong>Taller Pablo</strong>
            <span>Recepcion e inventario</span>
          </div>
        </div>

        <nav className="nav" aria-label="Principal">
          {Object.entries(views).map(([id, label]) => (
            <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} type="button" onClick={() => setActiveView(id)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="session-box">
          <span>Cuenta</span>
          <strong>Taller Automotriz Pablo</strong>
          <small>{session}</small>
          <button className="ghost-button" type="button" onClick={() => refresh().catch((error) => addLog(`Error refrescar: ${error.message}`))}>Actualizar</button>
          <button className="ghost-button" type="button" onClick={logout}>Cerrar sesion</button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{new Date().toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long" })}</p>
            <h1>{views[activeView]}</h1>
          </div>
          <div className="topbar-actions">
            <span className="sync-pill">Demo local</span>
            <button className="ghost-button" type="button" onClick={fillDemoReception}>Datos demo</button>
            <button className="ghost-button" type="button" onClick={seedWorkshopDemo} disabled={busy}>Demo taller</button>
          </div>
        </header>

        <section className={`view ${activeView === "dashboard" ? "active" : ""}`}>
          <div className="metrics-grid">
            <article className="metric"><span>Vehiculos registrados</span><strong>{data.vehicles.length}</strong></article>
            <article className="metric"><span>En taller</span><strong>{activeVehicles}</strong></article>
            <article className="metric"><span>Valor repuestos</span><strong>{money(inventoryValue)}</strong></article>
            <article className="metric warning"><span>Repuestos criticos</span><strong>{summary.lowStockCount}</strong></article>
          </div>

          <div className="split">
            <section className="panel">
              <div className="panel-head">
                <h2>Buscar vehiculo</h2>
                <button className="primary-button" type="button" onClick={() => setActiveView("reception")}>Nuevo ingreso</button>
              </div>
              <div className="scanner-strip">
                <input value={plateSearch} onChange={(event) => setPlateSearch(event.target.value.toUpperCase())} placeholder="Buscar patente" />
                <button type="button" onClick={searchVehicle}>Buscar</button>
              </div>
              <div className="empty-state">La patente manda: desde ahi ves historial, ordenes y estado del auto.</div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Alertas de stock</h2>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={sendLowStockWhatsapp}>Enviar pedido</button>
                <button className="ghost-button" type="button" onClick={() => setActiveView("inventory")}>Ver repuestos</button>
                </div>
              </div>
              <div className="list">
                {lowStockParts.length === 0 ? <div className="empty-state">Sin alertas.</div> : lowStockParts.map((part) => (
                  <div className="list-item" key={part.id}>
                    <strong>{part.name}</strong>
                    <span>{part.sku} / stock {part.stock}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel table-panel">
            <div className="panel-head">
              <h2>Vehiculos recientes</h2>
              <button className="ghost-button" type="button" onClick={() => setActiveView("vehicles")}>Ver todos</button>
            </div>
            {renderVehiclesTable(data.vehicles.slice(0, 6))}
          </section>
        </section>

        <section className={`view ${activeView === "reception" ? "active" : ""}`}>
          <div className="sales-layout">
            <form className="panel" onSubmit={submitQuickReception}>
              <div className="panel-head">
                <h2>Ingreso con patente</h2>
                <span className="mode-pill">Mostrador activo</span>
              </div>
              <div className="form-grid">
                <label>Cliente<input value={forms.quick.customerName} onChange={(event) => updateForm("quick", "customerName", event.target.value)} placeholder="Nombre del cliente" required minLength={2} /></label>
                <label>Telefono<input value={forms.quick.phone} onChange={(event) => updateForm("quick", "phone", event.target.value)} placeholder="+569..." required minLength={6} /></label>
                <label>Patente<input value={forms.quick.plate} onChange={(event) => updateForm("quick", "plate", event.target.value.toUpperCase())} placeholder="ABCD12" required minLength={4} maxLength={10} /></label>
                <label>Kilometraje<input value={forms.quick.mileage} onChange={(event) => updateForm("quick", "mileage", Number(event.target.value))} type="number" min="0" required /></label>
                <label>Marca<input value={forms.quick.brand} onChange={(event) => updateForm("quick", "brand", event.target.value)} placeholder="Toyota" required minLength={2} /></label>
                <label>Modelo<input value={forms.quick.model} onChange={(event) => updateForm("quick", "model", event.target.value)} placeholder="Yaris" required /></label>
                <label className="wide">Trabajo solicitado<input value={forms.quick.reason} onChange={(event) => updateForm("quick", "reason", event.target.value)} list="service-presets" required minLength={3} /></label>
                <label>Prioridad<select value={forms.quick.priority} onChange={(event) => updateForm("quick", "priority", event.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                  <option value="baja">Baja</option>
                </select></label>
                <datalist id="service-presets">
                  {servicePresets.map((preset) => <option key={preset} value={preset} />)}
                </datalist>
              </div>
              <div className="button-row">
                {vehiclePresets.map((preset) => <button key={`${preset.brand}-${preset.model}`} type="button" className="ghost-button" onClick={() => applyVehiclePreset(preset)}>{preset.brand} {preset.model}</button>)}
              </div>
              <button className="primary-button full" type="submit" disabled={busy}>{busy ? "Ingresando..." : "Crear cliente, vehiculo y orden"}</button>
            </form>

            <aside className="panel cart-panel">
              <div className="panel-head"><h2>Resumen</h2></div>
              <div className="cart-list">
                <div className="cart-line"><span>Cliente</span><strong>{forms.quick.customerName || "-"}</strong></div>
                <div className="cart-line"><span>Patente</span><strong>{forms.quick.plate || "-"}</strong></div>
                <div className="cart-line"><span>Vehiculo</span><strong>{[forms.quick.brand, forms.quick.model].filter(Boolean).join(" ") || "-"}</strong></div>
                <div className="cart-line"><span>Trabajo</span><strong>{forms.quick.reason || "-"}</strong></div>
              </div>
              <div className="empty-state">Al guardar queda inmediatamente visible en Ordenes.</div>
            </aside>
          </div>
        </section>

        <section className={`view ${activeView === "orders" ? "active" : ""}`}>
          <section className="panel table-panel">
            <div className="panel-head">
              <h2>Ordenes de trabajo</h2>
              <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Buscar por patente, cliente o estado" />
            </div>
            {renderOrdersTable(filteredOrders, true)}
          </section>
        </section>

        <section className={`view ${activeView === "vehicles" ? "active" : ""}`}>
          <section className="panel table-panel">
            <div className="panel-head">
              <h2>Vehiculos</h2>
              <input value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="Buscar por patente, cliente, marca o modelo" />
            </div>
            {renderVehiclesTable(filteredVehicles, true)}
          </section>
        </section>

        <section className={`view ${activeView === "inventory" ? "active" : ""}`}>
          <div className="split">
            <section className="panel">
              <div className="panel-head"><h2>Agregar repuesto</h2></div>
              <form className="form-grid" onSubmit={createPart}>
                <label>SKU<input value={forms.part.sku} onChange={(event) => updateForm("part", "sku", event.target.value)} required /></label>
                <label>Nombre<input value={forms.part.name} onChange={(event) => updateForm("part", "name", event.target.value)} required /></label>
                <label>Precio venta<input value={forms.part.price} onChange={(event) => updateForm("part", "price", Number(event.target.value))} type="number" min="0" required /></label>
                <label>Costo<input value={forms.part.cost} onChange={(event) => updateForm("part", "cost", Number(event.target.value))} type="number" min="0" required /></label>
                <label>Stock<input value={forms.part.stock} onChange={(event) => updateForm("part", "stock", Number(event.target.value))} type="number" min="0" required /></label>
                <label>Stock minimo<input value={forms.part.minimumStock} onChange={(event) => updateForm("part", "minimumStock", Number(event.target.value))} type="number" min="0" required /></label>
                <div className="profit-preview"><span>Margen</span><strong>{money(Number(forms.part.price) - Number(forms.part.cost))}</strong></div>
                <button className="primary-button full" type="submit">Guardar repuesto</button>
              </form>
            </section>

            <form className="panel" onSubmit={consumePart}>
              <div className="panel-head"><h2>Usar en orden</h2></div>
              <label>Orden<select value={forms.consume.workOrderId} onChange={(event) => updateForm("consume", "workOrderId", event.target.value)} required>
                <option value="">Seleccionar</option>
                {data.workOrders.map((order) => {
                  const vehicle = vehicleById(order.vehicleId);
                  return <option key={order.id} value={order.id}>{vehicle?.plate || order.id.slice(0, 8)} / {order.state}</option>;
                })}
              </select></label>
              <label>Repuesto<select value={forms.consume.partId} onChange={(event) => updateForm("consume", "partId", event.target.value)} required>
                <option value="">Seleccionar</option>
                {data.parts.map((part) => <option key={part.id} value={part.id}>{part.sku} {part.name} ({part.stock})</option>)}
              </select></label>
              <label>Cantidad<input value={forms.consume.quantity} onChange={(event) => updateForm("consume", "quantity", Number(event.target.value))} type="number" min="1" required /></label>
              <button className="primary-button full" type="submit">Descontar stock</button>
            </form>
          </div>

          <section className="panel table-panel">
              <div className="panel-head">
              <h2>Repuestos del taller</h2>
              <input value={partSearch} onChange={(event) => setPartSearch(event.target.value)} placeholder="Buscar repuesto" />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>SKU</th><th>Repuesto</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Minimo</th></tr></thead>
                <tbody>
                  {filteredParts.map((part) => (
                    <tr key={part.id}>
                      <td>{part.sku}</td><td>{part.name}</td><td>{money(part.price)}</td><td>{money(part.cost)}</td>
                      <td className={Number(part.stock) <= Number(part.minimumStock || 0) ? "danger-text" : ""}>{part.stock}</td><td>{part.minimumStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section className={`view ${activeView === "history" ? "active" : ""}`}>
          <section className="panel">
            <div className="panel-head"><h2>Historial por patente</h2></div>
            <div className="scanner-strip">
              <input value={plateSearch} onChange={(event) => setPlateSearch(event.target.value.toUpperCase())} placeholder="ABCD12" />
              <button type="button" onClick={searchVehicle}>Buscar historial</button>
            </div>
            <pre>{history || "Busca una patente para ver el historial del vehiculo."}</pre>
          </section>
        </section>

        <section className={`view ${activeView === "account" ? "active" : ""}`}>
          <div className="split">
            <section className="panel">
              <div className="panel-head"><h2>Estado del sistema</h2></div>
              <div className="list">
                <div className="list-item"><strong>Proyecto</strong><span>Taller Pablo, separado de FlowStock</span></div>
                <div className="list-item"><strong>Persistencia</strong><span>Memoria local hasta conectar Supabase</span></div>
                <div className="list-item"><strong>Sesion</strong><span>{session}</span></div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Actividad</h2></div>
              <pre>{log.join("\n\n") || "Sin actividad reciente."}</pre>
            </section>
          </div>
        </section>

        <section className={`view ${activeView === "closeout" ? "active" : ""}`}>
          <div className="metrics-grid">
            <article className="metric"><span>Ordenes totales</span><strong>{data.workOrders.length}</strong></article>
            <article className="metric"><span>Abiertas</span><strong>{summary.openWorkOrders}</strong></article>
            <article className="metric"><span>Listas / entregadas</span><strong>{finishedOrders}</strong></article>
            <article className="metric warning"><span>Stock bajo</span><strong>{summary.lowStockCount}</strong></article>
          </div>
          <section className="panel">
            <div className="panel-head">
              <h2>Resumen operativo</h2>
              <button className="primary-button" type="button" onClick={exportBackup}>Exportar cierre</button>
            </div>
            <div className="list">
              {Object.entries(summary.workOrdersByState || {}).map(([state, count]) => (
                <div className="list-item" key={state}><strong>{state}</strong><span>{count} ordenes</span></div>
              ))}
              {stateCount === 0 ? <div className="empty-state">Aun no hay movimientos para cerrar.</div> : null}
            </div>
          </section>
        </section>

        <section className={`view ${activeView === "backup" ? "active" : ""}`}>
          <div className="split">
            <section className="panel">
              <div className="panel-head"><h2>Respaldo</h2></div>
              <div className="list">
                <div className="list-item"><strong>Clientes</strong><span>{data.customers.length}</span></div>
                <div className="list-item"><strong>Vehiculos</strong><span>{data.vehicles.length}</span></div>
                <div className="list-item"><strong>Ordenes</strong><span>{data.workOrders.length}</span></div>
                <div className="list-item"><strong>Repuestos</strong><span>{data.parts.length}</span></div>
              </div>
              <button className="primary-button full" type="button" onClick={exportBackup}>Descargar JSON</button>
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Formato</h2></div>
              <pre>{JSON.stringify({ customers: data.customers.length, vehicles: data.vehicles.length, workOrders: data.workOrders.length, parts: data.parts.length }, null, 2)}</pre>
            </section>
          </div>
        </section>

        <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
      </section>
    </main>
  );

  function renderOrdersTable(orders, editable = false) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Patente</th><th>Cliente</th><th>Trabajo</th><th>Prioridad</th><th>Estado</th>{editable ? <th></th> : null}</tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const vehicle = vehicleById(order.vehicleId);
              const customer = customerById(vehicle?.customerId);
              return (
                <tr key={order.id}>
                  <td><strong>{vehicle?.plate || "-"}</strong></td>
                  <td>{customer?.name || "-"}</td>
                  <td>{order.reason}</td>
                  <td>{order.priority}</td>
                  <td>{editable ? (
                    <select value={order.state} onChange={(event) => updateOrderState(order.id, event.target.value)}>
                      {orderStates.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>
                  ) : order.state}</td>
                  {editable ? <td><button className="ghost-button" type="button" onClick={() => { setPlateSearch(vehicle?.plate || ""); setActiveView("history"); }}>Historial</button></td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderVehiclesTable(vehicles, detailed = false) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Patente</th><th>Vehiculo</th><th>Cliente</th><th>Kilometraje</th><th>Ultima orden</th>{detailed ? <th></th> : null}</tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => {
              const customer = customerById(vehicle.customerId);
              const order = latestOrderForVehicle(vehicle.id);
              return (
                <tr key={vehicle.id}>
                  <td><strong>{vehicle.plate}</strong></td>
                  <td>{vehicle.brand} {vehicle.model}</td>
                  <td>{customer?.name || "-"}</td>
                  <td>{Number(vehicle.mileage || 0).toLocaleString("es-CL")} km</td>
                  <td>{order ? `${order.state} / ${order.reason}` : "Sin orden"}</td>
                  {detailed ? <td><button className="ghost-button" type="button" onClick={() => { setPlateSearch(vehicle.plate); setActiveView("history"); }}>Historial</button></td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
