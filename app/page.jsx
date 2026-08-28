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
    priority: "normal",
    conditionDetails: "",
    performedWork: ""
  },
  part: { sku: "", name: "", cost: 0, price: 0, stock: 0, minimumStock: 0 },
  consume: { workOrderId: "", partId: "", quantity: 1 },
  quote: { vehicleId: "", title: "Cotizacion taller", laborName: "", laborPrice: 0, partId: "", partQty: 1 }
};

const bulkPartsTemplate = [
  "sku,nombre,marca,costo,precio,stock,minimo,ubicacion",
  "ACE-5W30,Aceite 5W30 sintético,Shell,5200,8900,10,4,Bodega A",
  "FIL-ACE,Filtro de aceite,Mann,2600,5900,3,5,Estante 2",
  "PAST-DEL,Pastillas delanteras,Bosch,14500,29900,2,3,Estante 4"
].join("\n");

const servicePresets = [
  "Mantenimiento Preventivo",
  "Scanner automotriz",
  "Diagnostico, reparacion de filtro de particulas (DPF)",
  "Sistemas de amortiguacion y suspension",
  "Kit de embrague",
  "Sistema de frenos: cambio de pastillas",
  "Tren delantero",
  "Revision y reparacion de cortocircuito",
  "Copia y programacion de llaves con chip"
];
const views = {
  dashboard: "Panel",
  partsDashboard: "Panel repuestos",
  reception: "Recepcion",
  vehicles: "Vehiculos",
  orders: "Ordenes",
  quotes: "Cotizaciones",
  inventory: "Repuestos",
  partsSales: "FlowStock",
  history: "Historial",
  closeout: "Cierre",
  backup: "Respaldo",
  account: "Cuenta"
};

const workshopNavItems = [
  { id: "dashboard", icon: "01" },
  { id: "reception", icon: "IN" },
  { id: "vehicles", icon: "VE" },
  { id: "orders", icon: "OT" },
  { id: "quotes", icon: "CO" },
  { id: "history", icon: "HI" }
];

const orderStates = ["recibido", "en_diagnostico", "esperando_aprobacion", "en_reparacion", "esperando_repuesto", "listo", "entregado", "detenido"];

const money = (value) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value) || 0);

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeChileMobile(value) {
  let digits = phoneDigits(value);
  if (digits.startsWith("56")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits && !digits.startsWith("9")) digits = `9${digits}`;
  return `56${digits}`.slice(0, 11);
}

function formatChileMobile(value) {
  const normalized = normalizeChileMobile(value);
  const local = normalized.startsWith("56") ? normalized.slice(2) : normalized;
  if (!local) return "+56 9";
  const first = local.slice(0, 1);
  const middle = local.slice(1, 5);
  const last = local.slice(5, 9);
  return [`+56 ${first}`, middle, last].filter(Boolean).join(" ");
}

function phoneHref(value) {
  const normalized = normalizeChileMobile(value);
  return normalized.length >= 10 ? `tel:+${normalized}` : undefined;
}

function whatsappHref(value) {
  const normalized = normalizeChileMobile(value);
  return normalized.length >= 10 ? `https://wa.me/${normalized}` : undefined;
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function saleDayKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "sin-fecha";
}

function formatSaleDay(day) {
  if (day === "sin-fecha") return "Sin fecha";
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function groupByDay(records, dateKey = "createdAt") {
  const groups = records.reduce((acc, record) => {
    const day = saleDayKey(record[dateKey]);
    acc[day] = acc[day] || [];
    acc[day].push(record);
    return acc;
  }, {});
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function suggestedOrderQty(part) {
  const minimum = Number(part.minimumStock || 0);
  const stock = Number(part.stock || 0);
  if (minimum <= 0) return 0;
  return Math.max(minimum - stock, 1);
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if ((char === "," || char === ";" || char === "\t") && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseBulkNumber(value) {
  const text = String(value || "").replace(/\$/g, "").replace(/\s/g, "").trim();
  if (!text) return 0;
  const cleaned = text.includes(",") && text.includes(".")
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(/[,.](?=\d{3}(\D|$))/g, "");
  const number = Number(cleaned.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function normalizeBulkHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseBulkParts(text, existingParts) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  const existingSkus = new Set(existingParts.map((part) => part.sku.toLowerCase()));
  const seen = new Set();
  const headers = ["sku", "nombre", "marca", "costo", "precio", "stock", "minimo", "ubicacion"];
  const aliases = {
    sku: "sku",
    codigo: "sku",
    nombre: "nombre",
    producto: "nombre",
    repuesto: "nombre",
    marca: "marca",
    costo: "costo",
    precio: "precio",
    "precio venta": "precio",
    stock: "stock",
    minimo: "minimo",
    "stock minimo": "minimo",
    ubicacion: "ubicacion"
  };
  let start = 0;
  let activeHeaders = headers;
  const firstCells = splitCsvLine(lines[0] || "").map(normalizeBulkHeader);
  if (firstCells.some((cell) => aliases[cell])) {
    activeHeaders = firstCells.map((cell) => aliases[cell] || cell);
    start = 1;
  }

  return lines.slice(start).map((line, index) => {
    const cells = splitCsvLine(line);
    const source = Object.fromEntries(activeHeaders.map((header, cellIndex) => [header, cells[cellIndex] || ""]));
    const part = {
      sku: String(source.sku || "").trim().toUpperCase(),
      name: String(source.nombre || "").trim(),
      brand: String(source.marca || "").trim() || undefined,
      cost: parseBulkNumber(source.costo),
      price: parseBulkNumber(source.precio),
      stock: Math.trunc(parseBulkNumber(source.stock)),
      minimumStock: Math.trunc(parseBulkNumber(source.minimo)),
      location: String(source.ubicacion || "").trim() || undefined
    };
    const errors = [];
    const skuKey = part.sku.toLowerCase();
    if (!part.sku || part.sku.length < 2) errors.push("SKU");
    if (!part.name || part.name.length < 2) errors.push("nombre");
    if (![part.cost, part.price, part.stock, part.minimumStock].every((value) => Number.isFinite(value) && value >= 0)) errors.push("numeros");
    if (existingSkus.has(skuKey)) errors.push("ya existe");
    if (seen.has(skuKey)) errors.push("duplicado en lote");
    seen.add(skuKey);
    return { line: start + index + 1, part, errors };
  });
}

export default function HomePage() {
  const [activeArea, setActiveArea] = useState("workshop");
  const [activeView, setActiveView] = useState("dashboard");
  const [token, setToken] = useState("");
  const [session, setSession] = useState("Sin sesion");
  const [authForm, setAuthForm] = useState({ email: "nico@taller.local", password: "" });
  const [authError, setAuthError] = useState("");
  const [forms, setForms] = useState(initialForm);
  const [data, setData] = useState({ customers: [], vehicles: [], workOrders: [], parts: [], partSales: [] });
  const [summary, setSummary] = useState({ openWorkOrders: 0, lowStockCount: 0, workOrdersByState: {} });
  const [log, setLog] = useState([]);
  const [plateSearch, setPlateSearch] = useState("");
  const [history, setHistory] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [bulkPartsText, setBulkPartsText] = useState("");
  const [saleCode, setSaleCode] = useState("");
  const [partsCart, setPartsCart] = useState([]);
  const [receptionPhotos, setReceptionPhotos] = useState([]);
  const [orderEvidence, setOrderEvidence] = useState({});
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [quotes, setQuotes] = useState([]);
  const [quoteItems, setQuoteItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const latestOrders = useMemo(() => data.workOrders.slice(0, 6), [data.workOrders]);
  const lowStockParts = useMemo(() => data.parts.filter((part) => Number(part.stock) <= Number(part.minimumStock || 0)), [data.parts]);
  const inventoryValue = useMemo(() => data.parts.reduce((total, part) => total + Number(part.stock || 0) * Number(part.cost || 0), 0), [data.parts]);
  const activeVehicles = useMemo(() => new Set(data.workOrders.filter((order) => !["entregado", "detenido"].includes(order.state)).map((order) => order.vehicleId)).size, [data.workOrders]);
  const cartTotal = useMemo(() => partsCart.reduce((total, item) => total + Number(item.price || 0) * item.quantity, 0), [partsCart]);
  const cartUnits = useMemo(() => partsCart.reduce((total, item) => total + item.quantity, 0), [partsCart]);
  const partsSalesTotal = useMemo(() => data.partSales.reduce((total, sale) => total + Number(sale.total || 0), 0), [data.partSales]);
  const partsSalesProfit = useMemo(() => data.partSales.reduce((total, sale) => total + Number(sale.profit || 0), 0), [data.partSales]);
  const partsSalesUnits = useMemo(() => data.partSales.reduce((total, sale) => total + Number(sale.units || 0), 0), [data.partSales]);
  const quoteTotal = useMemo(() => quoteItems.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 1), 0), [quoteItems]);
  const quotesByVehicle = useMemo(() => quotes.reduce((acc, quote) => {
    acc[quote.vehicleId] = acc[quote.vehicleId] || [];
    acc[quote.vehicleId].push(quote);
    return acc;
  }, {}), [quotes]);
  const todayPartSales = useMemo(() => data.partSales.filter((sale) => saleDayKey(sale.createdAt) === localDayKey()), [data.partSales]);
  const todayPartsSalesTotal = useMemo(() => todayPartSales.reduce((total, sale) => total + Number(sale.total || 0), 0), [todayPartSales]);
  const todayPartsSalesProfit = useMemo(() => todayPartSales.reduce((total, sale) => total + Number(sale.profit || 0), 0), [todayPartSales]);
  const todayPartsSalesUnits = useMemo(() => todayPartSales.reduce((total, sale) => total + Number(sale.units || 0), 0), [todayPartSales]);
  const partsMarginRate = useMemo(() => partsSalesTotal > 0 ? Math.round((partsSalesProfit / partsSalesTotal) * 100) : 0, [partsSalesProfit, partsSalesTotal]);
  const reorderCost = useMemo(() => lowStockParts.reduce((total, part) => total + suggestedOrderQty(part) * Number(part.cost || 0), 0), [lowStockParts]);
  const topPart = useMemo(() => {
    const ranking = new Map();
    for (const sale of data.partSales) {
      for (const item of sale.items || []) {
        const key = item.name || item.sku || item.partId;
        const entry = ranking.get(key) || { name: key, units: 0, total: 0 };
        entry.units += Number(item.quantity || 0);
        entry.total += Number(item.subtotal || 0);
        ranking.set(key, entry);
      }
    }
    return [...ranking.values()].sort((a, b) => b.units - a.units || b.total - a.total)[0];
  }, [data.partSales]);
  const salesByDay = useMemo(() => {
    const groups = data.partSales.reduce((acc, sale) => {
      const day = saleDayKey(sale.createdAt);
      acc[day] = acc[day] || [];
      acc[day].push(sale);
      return acc;
    }, {});
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).slice(0, 5);
  }, [data.partSales]);
  const paymentBreakdown = useMemo(() => data.partSales.reduce((totals, sale) => {
    const method = sale.paymentMethod || "Sin metodo";
    totals[method] = (totals[method] || 0) + Number(sale.total || 0);
    return totals;
  }, {}), [data.partSales]);

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

  const filteredQuotes = useMemo(() => {
    const term = quoteSearch.trim().toLowerCase();
    if (!term) return quotes;
    return quotes.filter((quote) => {
      const vehicle = vehicleById(quote.vehicleId);
      const customer = customerById(vehicle?.customerId);
      return [
        quote.number,
        quote.title,
        quote.status,
        quote.createdAt,
        vehicle?.plate,
        vehicle?.brand,
        vehicle?.model,
        customer?.name,
        customer?.phone,
        ...(quote.items || []).map((item) => item.name)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [quotes, data.vehicles, data.customers, quoteSearch]);

  const quoteGroups = useMemo(() => groupByDay(filteredQuotes), [filteredQuotes]);

  const filteredParts = useMemo(() => {
    const term = partSearch.trim().toLowerCase();
    if (!term) return data.parts;
    return data.parts.filter((part) => [part.sku, part.name, part.brand, part.location].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [data.parts, partSearch]);
  const bulkRows = useMemo(() => parseBulkParts(bulkPartsText, data.parts), [bulkPartsText, data.parts]);
  const validBulkParts = useMemo(() => bulkRows.filter((row) => row.errors.length === 0).map((row) => row.part), [bulkRows]);
  const invalidBulkCount = bulkRows.length - validBulkParts.length;

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

  function saveQuotes(nextQuotes) {
    setQuotes(nextQuotes);
    localStorage.setItem("taller-pablo-quotes", JSON.stringify(nextQuotes));
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

  function selectedVehicle() {
    return data.vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || filteredVehicles[0];
  }

  function vehicleTimeline(vehicleId) {
    return ordersByVehicle(vehicleId).map((order) => ({
      ...order,
      evidence: orderEvidence[order.id]
    }));
  }

  function quoteVehicle() {
    return data.vehicles.find((vehicle) => vehicle.id === forms.quote.vehicleId);
  }

  function quoteCustomer() {
    const vehicle = quoteVehicle();
    return customerById(vehicle?.customerId);
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

    const [customers, vehicles, workOrders, parts, partSales, dashboard] = await Promise.all([
      request("/customers"),
      request("/vehicles"),
      request("/work-orders"),
      request("/parts"),
      request("/part-sales"),
      request("/dashboard/summary")
    ]);
    setData({
      customers: customers.data,
      vehicles: vehicles.data,
      workOrders: workOrders.data,
      parts: parts.data,
      partSales: partSales.data
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

  function openVehicleProfile(vehicle) {
    setSelectedVehicleId(vehicle.id);
    setPlateSearch(vehicle.plate);
    setActiveView("vehicles");
  }

  function applyServicePreset(service) {
    setForms((current) => ({
      ...current,
      quick: { ...current.quick, reason: service }
    }));
  }

  function updateQuickPhone(value) {
    setForms((current) => ({
      ...current,
      quick: { ...current.quick, phone: formatChileMobile(value) }
    }));
  }

  function addLaborToQuote() {
    const name = forms.quote.laborName.trim();
    const price = Number(forms.quote.laborPrice || 0);
    if (!name || price <= 0) {
      showToast("Agrega mano de obra con valor");
      return;
    }
    setQuoteItems((current) => [...current, { id: `labor-${Date.now()}`, type: "Mano de obra", name, price, quantity: 1 }]);
    setForms((current) => ({ ...current, quote: { ...current.quote, laborName: "", laborPrice: 0 } }));
  }

  function addPartToQuote() {
    const part = data.parts.find((item) => item.id === forms.quote.partId);
    const quantity = Math.max(1, Number(forms.quote.partQty || 1));
    if (!part) {
      showToast("Elige un repuesto");
      return;
    }
    setQuoteItems((current) => [...current, { id: `part-${part.id}-${Date.now()}`, type: "Repuesto", partId: part.id, sku: part.sku, name: part.name, price: Number(part.price || 0), quantity }]);
    setForms((current) => ({ ...current, quote: { ...current.quote, partId: "", partQty: 1 } }));
  }

  function removeQuoteItem(id) {
    setQuoteItems((current) => current.filter((item) => item.id !== id));
  }

  function createQuote() {
    const vehicle = quoteVehicle();
    const customer = quoteCustomer();
    if (!vehicle || !customer) {
      showToast("Elige un vehiculo");
      return;
    }
    if (quoteItems.length === 0) {
      showToast("Agrega mano de obra o repuestos");
      return;
    }
    const quote = {
      id: `quote-${Date.now()}`,
      number: String(quotes.length + 1).padStart(4, "0"),
      vehicleId: vehicle.id,
      customerId: customer.id,
      title: forms.quote.title.trim() || "Cotizacion taller",
      items: quoteItems,
      total: quoteTotal,
      status: "pendiente",
      createdAt: new Date().toISOString()
    };
    saveQuotes([quote, ...quotes]);
    setQuoteItems([]);
    setForms((current) => ({ ...current, quote: initialForm.quote }));
    addLog("Cotizacion creada", { patente: vehicle.plate, total: quote.total });
  }

  function updateQuoteStatus(id, status) {
    saveQuotes(quotes.map((quote) => quote.id === id ? { ...quote, status } : quote));
    showToast("Estado actualizado");
  }

  async function copyQuoteToWhatsapp(quote) {
    const vehicle = vehicleById(quote.vehicleId);
    const customer = customerById(vehicle?.customerId);
    const lines = [
      `Hola ${customer?.name || ""}, te comparto la cotizacion del taller:`,
      "",
      `Vehiculo: ${vehicle?.plate || "-"} ${vehicle ? `${vehicle.brand} ${vehicle.model}` : ""}`.trim(),
      `Cotizacion: ${quote.title}`,
      "",
      ...quote.items.map((item) => `- ${item.name} x${item.quantity}: ${money(Number(item.price || 0) * Number(item.quantity || 1))}`),
      "",
      `Total: ${money(quote.total)}`,
      "",
      "Quedo atento para confirmar si la apruebas."
    ];
    await navigator.clipboard?.writeText(lines.join("\n"));
    showToast("Cotizacion copiada para WhatsApp");
  }

  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSide = 1280;
          const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * ratio);
          canvas.height = Math.round(image.height * ratio);
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name || "foto-recepcion",
            src: canvas.toDataURL("image/jpeg", 0.78)
          });
        };
        image.onerror = () => resolve({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name || "foto-recepcion",
          src: reader.result
        });
        image.src = reader.result;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function addReceptionPhotos(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (files.length === 0) return;
    try {
      const availableSlots = Math.max(0, 6 - receptionPhotos.length);
      if (availableSlots === 0) {
        showToast("Maximo 6 fotos por ingreso");
        return;
      }
      const photos = await Promise.all(files.slice(0, availableSlots).map(readPhoto));
      setReceptionPhotos((current) => [...current, ...photos].slice(0, 6));
      showToast(photos.length === 1 ? "Foto agregada" : `${photos.length} fotos agregadas`);
    } catch {
      showToast("No pude cargar una foto");
    }
  }

  function removeReceptionPhoto(photoId) {
    setReceptionPhotos((current) => current.filter((photo) => photo.id !== photoId));
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
        reason: "Mantenimiento Preventivo",
        priority: "normal",
        conditionDetails: "Parachoques delantero con raya leve. Cliente deja rueda de repuesto en maletero."
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

  async function seedPartsDemo() {
    setBusy(true);
    try {
      const suffix = Date.now().toString().slice(-4);
      const demoParts = [
        { sku: `ACE-${suffix}`, name: "Aceite 5W30 sintético", cost: 5200, price: 8900, stock: 10, minimumStock: 4 },
        { sku: `FIL-${suffix}`, name: "Filtro de aceite", cost: 2600, price: 5900, stock: 3, minimumStock: 5 },
        { sku: `AMP-${suffix}`, name: "Ampolleta H7", cost: 1800, price: 4500, stock: 14, minimumStock: 6 },
        { sku: `PAS-${suffix}`, name: "Pastillas delanteras", cost: 14500, price: 29900, stock: 2, minimumStock: 3 }
      ];
      await Promise.all(demoParts.map((part) => api("/parts", { method: "POST", body: JSON.stringify(part) })));
      await refresh();
      setActiveArea("parts");
      setActiveView("partsSales");
      addLog("Demo FlowStock Repuestos cargada");
    } catch (error) {
      addLog(`Error demo repuestos: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitQuickReception(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const quick = { ...forms.quick, phone: formatChileMobile(forms.quick.phone) };
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
          priority: quick.priority,
          symptoms: quick.conditionDetails || undefined
        })
      });
      if (quick.conditionDetails || quick.performedWork || receptionPhotos.length > 0) {
        setOrderEvidence((current) => {
          const next = {
            ...current,
            [order.data.id]: {
              details: quick.conditionDetails,
              performedWork: quick.performedWork,
              photos: receptionPhotos,
              createdAt: new Date().toISOString()
            }
          };
          localStorage.setItem("taller-pablo-order-evidence", JSON.stringify(next));
          return next;
        });
      }
      setForms((current) => ({ ...current, quick: initialForm.quick }));
      setReceptionPhotos([]);
      setActiveView("orders");
      addLog("Ingreso creado", { cliente: customer.data.name, patente: vehicle.data.plate, orden: order.data.id, fotos: receptionPhotos.length });
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

  async function importBulkParts() {
    if (validBulkParts.length === 0) {
      showToast("No hay productos validos para importar");
      return;
    }
    setBusy(true);
    try {
      const result = await api("/parts/bulk", {
        method: "POST",
        body: JSON.stringify({ parts: validBulkParts })
      });
      setBulkPartsText("");
      await refresh();
      addLog(`Carga masiva lista: ${result.data.createdCount} creados, ${result.data.skippedCount} omitidos`);
    } catch (error) {
      addLog(`Error carga masiva: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function readBulkPartsFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    setBulkPartsText(text);
  }

  function addPartToCart(part, quantity = 1) {
    if (!part) {
      showToast("Repuesto no encontrado");
      return;
    }
    if (part.stock <= 0) {
      showToast("Sin stock disponible");
      return;
    }
    setPartsCart((current) => {
      const existing = current.find((item) => item.partId === part.id);
      if (existing) {
        return current.map((item) => item.partId === part.id ? { ...item, quantity: Math.min(item.quantity + quantity, part.stock) } : item);
      }
      return [...current, { partId: part.id, sku: part.sku, name: part.name, price: part.price, stock: part.stock, quantity }];
    });
  }

  function addPartByCode() {
    const code = saleCode.trim().toLowerCase();
    if (!code) return;
    const part = data.parts.find((item) => item.sku.toLowerCase() === code);
    addPartToCart(part);
    setSaleCode("");
  }

  function updateCartQuantity(partId, quantity) {
    if (quantity <= 0) {
      setPartsCart((current) => current.filter((item) => item.partId !== partId));
      return;
    }
    const part = data.parts.find((item) => item.id === partId);
    setPartsCart((current) => current.map((item) => item.partId === partId ? { ...item, quantity: Math.min(quantity, part?.stock || quantity) } : item));
  }

  async function registerPartSale() {
    try {
      const sale = await api("/part-sales", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod,
          items: partsCart.map((item) => ({ partId: item.partId, quantity: item.quantity }))
        })
      });
      setPartsCart([]);
      addLog("Venta de repuestos registrada", sale.data);
      await refresh();
    } catch (error) {
      addLog(`Error venta: ${error.message}`);
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
      const historyWithEvidence = vehicleHistory.data.map((item) => ({
        ...item,
        evidence: orderEvidence[item.order.id] ? {
          details: orderEvidence[item.order.id].details || undefined,
          photos: orderEvidence[item.order.id].photos?.map((photo) => photo.name)
        } : undefined
      }));
      setHistory(JSON.stringify({ vehicle: vehicle.data, history: historyWithEvidence }, null, 2));
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
      orderEvidence,
      parts: data.parts,
      partSales: data.partSales,
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
    const lines = lowStockParts.map((part) => `- ${part.name} (${part.sku}): stock ${part.stock}, minimo ${part.minimumStock}, pedir ${suggestedOrderQty(part)} un.`);
    const message = encodeURIComponent(["Pedido sugerido Taller Pablo:", ...lines, "", "Revisar cantidades antes de comprar."].join("\n"));
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
    addLog("Pedido de stock preparado");
  }

  async function copyLowStockMessage() {
    if (lowStockParts.length === 0) {
      showToast("No hay repuestos bajo stock");
      return;
    }
    const lines = lowStockParts.map((part) => `- ${part.name} (${part.sku}): stock ${part.stock}, minimo ${part.minimumStock}, pedir ${suggestedOrderQty(part)} un.`);
    const text = ["Pedido sugerido Taller Pablo:", ...lines, "", "Revisar cantidades antes de comprar."].join("\n");
    await navigator.clipboard?.writeText(text);
    showToast("Pedido copiado");
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("token");
    setToken("");
    setSession("Sin sesion");
    setData({ customers: [], vehicles: [], workOrders: [], parts: [], partSales: [] });
    setSummary({ openWorkOrders: 0, lowStockCount: 0, workOrdersByState: {} });
    showToast("Sesion cerrada");
  }

  function switchArea(area) {
    setActiveArea(area);
    setActiveView(area === "workshop" ? "dashboard" : "partsSales");
  }

  function goToParts(view = "partsSales") {
    setActiveArea("parts");
    setActiveView(view);
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

  useEffect(() => {
    const savedEvidence = localStorage.getItem("taller-pablo-order-evidence");
    if (!savedEvidence) return;
    try {
      setOrderEvidence(JSON.parse(savedEvidence));
    } catch {
      localStorage.removeItem("taller-pablo-order-evidence");
    }
  }, []);

  useEffect(() => {
    const savedQuotes = localStorage.getItem("taller-pablo-quotes");
    if (!savedQuotes) return;
    try {
      setQuotes(JSON.parse(savedQuotes));
    } catch {
      localStorage.removeItem("taller-pablo-quotes");
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
            <p>Acceso autorizado al panel operativo.</p>
          </div>
          <form className="auth-form active" onSubmit={login}>
            <label>Correo<input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} required /></label>
            <label>Contrasena<input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} required minLength={8} /></label>
            {authError ? <div className="auth-error">{authError}</div> : null}
            <button className="primary-button full" type="submit">Iniciar sesion</button>
          </form>
          <div className="auth-footer">
            <span>Acceso protegido</span>
            <strong>Taller Pablo</strong>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${activeArea === "parts" ? "parts-shell" : ""}`}>
      <aside className="sidebar">
        {activeArea === "workshop" ? <div className="brand">
          <div className="brand-mark">TP</div>
          <div>
            <strong>Taller Pablo</strong>
            <span>Gestion taller</span>
          </div>
        </div> : null}

        <div className="area-switcher">
          <button className={activeArea === "workshop" ? "active" : ""} type="button" onClick={() => switchArea("workshop")}>Taller</button>
          <button className={activeArea === "parts" ? "active" : ""} type="button" onClick={() => switchArea("parts")}>Repuestos</button>
        </div>

        {activeArea === "workshop" ? (
          <nav className="nav" aria-label="Principal">
            <span className="nav-group-label">Taller / recepcion</span>
            {workshopNavItems.map(({ id, icon }) => (
              <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} type="button" onClick={() => setActiveView(id)}>
                <span className="nav-code">{icon}</span>
                {views[id]}
              </button>
            ))}
          </nav>
        ) : null}

        {activeArea === "workshop" ? <div className="session-box">
          <span>Cuenta</span>
          <strong>Taller Automotriz Pablo</strong>
          <small>{session}</small>
          <button className="ghost-button" type="button" onClick={() => refresh().catch((error) => addLog(`Error refrescar: ${error.message}`))}>Actualizar</button>
          <button className="ghost-button" type="button" onClick={logout}>Cerrar sesion</button>
        </div> : null}
      </aside>

      <section className={`content ${activeArea === "parts" && activeView === "partsSales" ? "flowstock-content" : ""}`}>
        <header className="topbar">
          <div>
            <p className="eyebrow">{new Date().toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long" })}</p>
            <h1>{activeArea === "workshop" ? "Taller Pablo" : "FlowStock Repuestos"} / {views[activeView]}</h1>
          </div>
          {activeArea === "workshop" ? (
            <div className="topbar-garage" aria-label="Resumen rapido del taller">
              <span>BOX 01</span>
              <strong>{activeVehicles} en patio</strong>
              <small>{summary.openWorkOrders} OT abiertas</small>
            </div>
          ) : null}
        </header>

        <section className={`view ${activeView === "dashboard" ? "active" : ""}`}>
          <section className="garage-banner">
            <div>
              <p className="eyebrow">Bahia principal</p>
              <h2>Trabajo del dia</h2>
            </div>
            <div className="bay-strip" aria-hidden="true">
              <span>ORDENES</span>
              <span>COTIZAR</span>
              <span>PAGOS</span>
            </div>
          </section>

          <div className="metrics-grid">
            <article className="metric"><div className="metric-icon">VE</div><span>Vehiculos</span><strong>{data.vehicles.length}</strong></article>
            <article className="metric"><div className="metric-icon">BOX</div><span>En taller</span><strong>{activeVehicles}</strong></article>
            <article className="metric"><div className="metric-icon">$</div><span>Repuestos</span><strong>{money(inventoryValue)}</strong></article>
            <article className="metric warning"><div className="metric-icon">MIN</div><span>Criticos</span><strong>{summary.lowStockCount}</strong></article>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Buscar por patente</h2>
              <button className="primary-button" type="button" onClick={() => setActiveView("reception")}>Nueva orden</button>
            </div>
            <div className="scanner-strip">
              <input value={plateSearch} onChange={(event) => setPlateSearch(event.target.value.toUpperCase())} placeholder="Buscar patente" />
              <button type="button" onClick={searchVehicle}>Buscar</button>
            </div>
            <div className="empty-state">La patente manda: desde ahi ves historial, ordenes y estado del auto.</div>
          </section>

          <section className="panel table-panel">
            <div className="panel-head">
              <h2>Vehiculos recientes</h2>
              <button className="ghost-button" type="button" onClick={() => setActiveView("vehicles")}>Ver todos</button>
            </div>
            {renderVehiclesTable(data.vehicles.slice(0, 6))}
          </section>
        </section>

        <section className={`view ${activeView === "partsDashboard" ? "active" : ""}`}>
          <div className="metrics-grid">
            <article className="metric"><span>Ventas de hoy</span><strong>{money(todayPartsSalesTotal)}</strong></article>
            <article className="metric"><span>Ganancia aprox.</span><strong>{money(todayPartsSalesProfit)}</strong></article>
            <article className="metric"><span>Unidades vendidas</span><strong>{todayPartsSalesUnits}</strong></article>
            <article className="metric warning"><span>Pedido sugerido</span><strong>{money(reorderCost)}</strong></article>
          </div>

          <section className="owner-radar">
            <article className="owner-main">
              <span>Radar operativo</span>
              <strong>{lowStockParts.length ? `${lowStockParts.length} repuestos por reponer` : "Listo para vender"}</strong>
              <p>{lowStockParts.length ? "Hay stock bajo; conviene preparar pedido antes de que falte en meson." : "El stock esta sobre minimo y el meson puede vender sin alerta."}</p>
            </article>
            <article>
              <span>Margen total</span>
              <strong>{partsMarginRate}%</strong>
              <p>Utilidad aproximada sobre ventas registradas.</p>
            </article>
            <article>
              <span>Producto estrella</span>
              <strong>{topPart?.name || "Sin ventas"}</strong>
              <p>{topPart ? `${topPart.units} unidades vendidas` : "Registra ventas para armar ranking."}</p>
            </article>
            <article className="owner-action">
              <span>Siguiente accion</span>
              <strong>{data.parts.length ? "Vender por codigo" : "Cargar repuestos"}</strong>
              <button className="ghost-button" type="button" onClick={() => setActiveView(data.parts.length ? "partsSales" : "inventory")}>Ir</button>
            </article>
          </section>

          <section className="operations-strip">
            <article><span>1</span><strong>Cargar</strong><small>SKU, nombre, costo, precio, stock y minimo.</small></article>
            <article><span>2</span><strong>Vender</strong><small>Escanea o escribe codigo; el carrito calcula el total.</small></article>
            <article><span>3</span><strong>Descontar</strong><small>El stock baja automaticamente al registrar venta.</small></article>
            <article><span>4</span><strong>Cerrar</strong><small>Ventas, margen y formas de pago quedan visibles.</small></article>
          </section>

          <div className="split">
            <section className="panel">
              <div className="panel-head">
                <h2>Venta rapida de meson</h2>
                <button className="primary-button" type="button" onClick={() => setActiveView("partsSales")}>Nueva venta</button>
              </div>
              <div className="scanner-strip">
                <input value={saleCode} onChange={(event) => setSaleCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addPartByCode(); } }} placeholder="Escanea o escribe codigo" />
                <button type="button" onClick={addPartByCode}>Agregar</button>
              </div>
              <div className="automation-summary">
                <div><span>Repuestos cargados</span><strong>{data.parts.length}</strong></div>
                <div><span>Stock critico</span><strong>{lowStockParts.length}</strong></div>
                <div><span>Valor inventario</span><strong>{money(inventoryValue)}</strong></div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Pedido sugerido</h2>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={copyLowStockMessage}>Copiar</button>
                  <button className="ghost-button" type="button" onClick={sendLowStockWhatsapp}>WhatsApp</button>
                </div>
              </div>
              <div className="list">
                {lowStockParts.length === 0 ? <div className="empty-state">Sin repuestos bajo stock.</div> : lowStockParts.map((part) => (
                  <div className="list-item reorder-item" key={part.id}>
                    <strong>{part.name}</strong>
                    <span>{part.sku} / stock {part.stock} / minimo {part.minimumStock}</span>
                    <em>Pedir {suggestedOrderQty(part)} un. / costo aprox. {money(suggestedOrderQty(part) * Number(part.cost || 0))}</em>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className={`view ${activeView === "reception" ? "active" : ""}`}>
          <div className="reception-layout">
            <form className="panel" onSubmit={submitQuickReception}>
              <div className="panel-head">
                <h2>Ingreso con patente</h2>
                <span className="mode-pill">Mostrador activo</span>
              </div>
              <div className="form-grid">
                <div className="form-section wide">
                  <div className="form-section-title"><span>1</span><strong>Cliente</strong></div>
                  <div className="form-grid inner">
                    <label>Cliente<input value={forms.quick.customerName} onChange={(event) => updateForm("quick", "customerName", event.target.value)} placeholder="Nombre del cliente" required minLength={2} /></label>
                    <label>Telefono<input value={forms.quick.phone} onChange={(event) => updateQuickPhone(event.target.value)} onFocus={() => !forms.quick.phone && updateQuickPhone("9")} placeholder="+56 9" required minLength={6} inputMode="tel" /></label>
                  </div>
                </div>
                <div className="form-section wide">
                  <div className="form-section-title"><span>2</span><strong>Vehiculo</strong></div>
                  <div className="form-grid inner">
                    <label>Patente<input value={forms.quick.plate} onChange={(event) => updateForm("quick", "plate", event.target.value.toUpperCase())} placeholder="ABCD12" required minLength={4} maxLength={10} /></label>
                    <label>Kilometraje<input value={forms.quick.mileage} onChange={(event) => updateForm("quick", "mileage", Number(event.target.value))} type="number" min="0" required /></label>
                    <label>Marca<input value={forms.quick.brand} onChange={(event) => updateForm("quick", "brand", event.target.value)} placeholder="Toyota" required minLength={2} /></label>
                    <label>Modelo<input value={forms.quick.model} onChange={(event) => updateForm("quick", "model", event.target.value)} placeholder="Yaris" required /></label>
                  </div>
                </div>
                <div className="form-section wide">
                  <div className="form-section-title"><span>3</span><strong>Trabajo</strong></div>
                  <div className="form-grid inner">
                    <label className="wide">Trabajo solicitado<input value={forms.quick.reason} onChange={(event) => updateForm("quick", "reason", event.target.value)} list="service-presets" required minLength={3} /></label>
                  </div>
                </div>
                <div className="wide service-board compact">
                  {servicePresets.map((service) => (
                    <button
                      key={service}
                      className={forms.quick.reason === service ? "active" : ""}
                      type="button"
                      onClick={() => applyServicePreset(service)}
                    >
                      <span className="check-ring" aria-hidden="true"></span>
                      <strong>{service}</strong>
                    </button>
                  ))}
                </div>
                <label className="wide">Detalles al ingresar<textarea value={forms.quick.conditionDetails} onChange={(event) => updateForm("quick", "conditionDetails", event.target.value)} placeholder="Rayones, luces quebradas, golpes, testigos encendidos, objetos en el interior..." rows={4} /></label>
                <label className="wide">Trabajos o modificaciones realizadas<textarea value={forms.quick.performedWork} onChange={(event) => updateForm("quick", "performedWork", event.target.value)} placeholder="Ej: cambio de aceite, pastillas delanteras, scanner, reparacion DPF, observaciones del mecanico..." rows={3} /></label>
                <div className="wide intake-photos">
                  <div className="intake-photos-head">
                    <strong>Fotos internas de recepcion</strong>
                    <span>{receptionPhotos.length}/6</span>
                  </div>
                  <label className="photo-picker">
                    <input type="file" accept="image/*" capture="environment" multiple onChange={addReceptionPhotos} />
                    Abrir camara o galeria
                  </label>
                  {receptionPhotos.length > 0 ? (
                    <div className="photo-preview-grid">
                      {receptionPhotos.map((photo) => (
                        <div className="photo-preview" key={photo.id}>
                          <img src={photo.src} alt={photo.name} />
                          <button type="button" onClick={() => removeReceptionPhoto(photo.id)}>Quitar</button>
                        </div>
                      ))}
                    </div>
                  ) : <p>Quedan asociadas al ingreso del auto para revisar estado, golpes o detalles desde este panel.</p>}
                </div>
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
              <button className="primary-button full" type="submit" disabled={busy}>{busy ? "Ingresando..." : "Crear cliente, vehiculo y orden"}</button>
            </form>

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

        <section className={`view ${activeView === "quotes" ? "active" : ""}`}>
          <div className="split quotes-layout">
            <section className="panel">
              <div className="panel-head">
                <h2>Nueva cotizacion</h2>
                <span className="mode-pill">{money(quoteTotal)}</span>
              </div>
              <div className="form-grid">
                <label className="wide">Vehiculo<select value={forms.quote.vehicleId} onChange={(event) => updateForm("quote", "vehicleId", event.target.value)} required>
                  <option value="">Seleccionar patente</option>
                  {data.vehicles.map((vehicle) => {
                    const customer = customerById(vehicle.customerId);
                    return <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} / {vehicle.brand} {vehicle.model} / {customer?.name || "Sin cliente"}</option>;
                  })}
                </select></label>
                <label className="wide">Titulo<input value={forms.quote.title} onChange={(event) => updateForm("quote", "title", event.target.value)} placeholder="Ej: Mantencion 80.000 km" /></label>
                <label>Mano de obra<input value={forms.quote.laborName} onChange={(event) => updateForm("quote", "laborName", event.target.value)} placeholder="Ej: Cambio de aceite" /></label>
                <label>Valor<input value={forms.quote.laborPrice} onChange={(event) => updateForm("quote", "laborPrice", Number(event.target.value))} type="number" min="0" /></label>
                <button className="ghost-button wide" type="button" onClick={addLaborToQuote}>Agregar mano de obra</button>
                <label>Repuesto<select value={forms.quote.partId} onChange={(event) => updateForm("quote", "partId", event.target.value)}>
                  <option value="">Elegir repuesto</option>
                  {data.parts.map((part) => <option key={part.id} value={part.id}>{part.sku} {part.name} / {money(part.price)}</option>)}
                </select></label>
                <label>Cantidad<input value={forms.quote.partQty} onChange={(event) => updateForm("quote", "partQty", Number(event.target.value))} type="number" min="1" /></label>
                <button className="ghost-button wide" type="button" onClick={addPartToQuote}>Agregar repuesto</button>
              </div>
              <div className="quote-preview">
                {quoteItems.length === 0 ? <div className="empty-state">Agrega mano de obra o repuestos para armar la cotizacion.</div> : quoteItems.map((item) => (
                  <div className="quote-line" key={item.id}>
                    <div>
                      <span>{item.type}</span>
                      <strong>{item.name}</strong>
                    </div>
                    <em>{item.quantity} x {money(item.price)}</em>
                    <button type="button" onClick={() => removeQuoteItem(item.id)}>Quitar</button>
                  </div>
                ))}
              </div>
              <div className="cart-total"><span>Total cotizado</span><strong>{money(quoteTotal)}</strong></div>
              <button className="primary-button full" type="button" onClick={createQuote}>Guardar cotizacion</button>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Cotizaciones guardadas</h2>
                <span className="mode-pill">{filteredQuotes.length}</span>
              </div>
              <div className="toolbar compact-toolbar">
                <input
                  value={quoteSearch}
                  onChange={(event) => setQuoteSearch(event.target.value.toUpperCase())}
                  placeholder="Buscar por patente, cliente, estado o repuesto"
                />
              </div>
              <div className="quote-list">
                {quotes.length === 0 ? <div className="empty-state">Todavia no hay cotizaciones guardadas.</div> : null}
                {quotes.length > 0 && filteredQuotes.length === 0 ? <div className="empty-state">No encontre cotizaciones para esa busqueda.</div> : null}
                {quoteGroups.map(([day, dayQuotes]) => (
                  <section className="quote-day-group" key={day}>
                    <div className="day-group-head">
                      <strong>{formatSaleDay(day)}</strong>
                      <span>{dayQuotes.length} cotizacion{dayQuotes.length === 1 ? "" : "es"}</span>
                    </div>
                    {dayQuotes.map((quote) => {
                      const vehicle = vehicleById(quote.vehicleId);
                      const customer = customerById(vehicle?.customerId);
                      return (
                        <article className="quote-card" key={quote.id}>
                          <div className="quote-card-head">
                            <div>
                              <span>#{quote.number} / {quote.status}</span>
                              <strong>{quote.title}</strong>
                              <small>{vehicle?.plate || "-"} / {customer?.name || "-"}</small>
                            </div>
                            <b>{money(quote.total)}</b>
                          </div>
                          <div className="quote-items-mini">
                            {(quote.items || []).slice(0, 4).map((item) => <span key={item.id}>{item.name} x{item.quantity}</span>)}
                          </div>
                          <div className="button-row">
                            <select value={quote.status} onChange={(event) => updateQuoteStatus(quote.id, event.target.value)}>
                              <option value="pendiente">Pendiente</option>
                              <option value="aprobada">Aprobada</option>
                              <option value="rechazada">Rechazada</option>
                            </select>
                            <button className="ghost-button" type="button" onClick={() => copyQuoteToWhatsapp(quote)}>Copiar WhatsApp</button>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className={`view ${activeView === "vehicles" ? "active" : ""}`}>
          <section className="panel table-panel">
            <div className="panel-head">
              <h2>Vehiculos</h2>
              <input value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="Buscar por patente, cliente, marca o modelo" />
            </div>
            {renderVehiclesTable(filteredVehicles, true)}
            {renderVehicleProfile(selectedVehicle())}
          </section>
        </section>

        <section className={`view ${activeView === "partsSales" ? "active" : ""}`}>
          <iframe className="flowstock-frame" title="FlowStock Repuestos" src="/flowstock-repuestos?embedded=1" />
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

          <section className="panel bulk-panel">
            <div className="panel-head">
              <div>
                <h2>Carga masiva</h2>
                <p className="muted-copy">Pega desde Excel o sube un CSV con columnas SKU, nombre, marca, costo, precio, stock, minimo y ubicacion.</p>
              </div>
              <div className="button-row">
                <label className="ghost-button file-button">
                  CSV
                  <input type="file" accept=".csv,text/csv,text/plain" onChange={readBulkPartsFile} />
                </label>
                <button className="ghost-button" type="button" onClick={() => setBulkPartsText(bulkPartsTemplate)}>Plantilla</button>
                <button className="primary-button" type="button" onClick={importBulkParts} disabled={busy || validBulkParts.length === 0}>
                  Importar {validBulkParts.length || ""}
                </button>
              </div>
            </div>
            <textarea
              className="bulk-textarea"
              value={bulkPartsText}
              onChange={(event) => setBulkPartsText(event.target.value)}
              placeholder={bulkPartsTemplate}
            />
            {bulkRows.length > 0 ? (
              <div className="bulk-summary">
                <span>{validBulkParts.length} listos</span>
                <span>{invalidBulkCount} por revisar</span>
                <span>Maximo 500 por carga</span>
              </div>
            ) : null}
            {bulkRows.length > 0 ? (
              <div className="table-wrap bulk-preview">
                <table>
                  <thead><tr><th>Linea</th><th>SKU</th><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th></tr></thead>
                  <tbody>
                    {bulkRows.slice(0, 12).map((row) => (
                      <tr key={`${row.line}-${row.part.sku}-${row.part.name}`}>
                        <td>{row.line}</td>
                        <td>{row.part.sku || "-"}</td>
                        <td>{row.part.name || "-"}</td>
                        <td>{money(row.part.price)}</td>
                        <td>{Number.isFinite(row.part.stock) ? row.part.stock : "-"}</td>
                        <td className={row.errors.length ? "danger-text" : ""}>{row.errors.length ? row.errors.join(", ") : "Listo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bulkRows.length > 12 ? <p className="muted-copy">Vista previa de 12 filas. Se importan todas las filas validas.</p> : null}
              </div>
            ) : null}
          </section>

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
            <article className="metric"><span>Ventas repuestos</span><strong>{money(partsSalesTotal)}</strong></article>
            <article className="metric"><span>Ganancia aprox.</span><strong>{money(partsSalesProfit)}</strong></article>
            <article className="metric"><span>Boletas</span><strong>{data.partSales.length}</strong></article>
            <article className="metric warning"><span>Unidades vendidas</span><strong>{partsSalesUnits}</strong></article>
          </div>
          <div className="split">
            <section className="panel">
              <div className="panel-head">
                <h2>Cierre de caja repuestos</h2>
                <button className="primary-button" type="button" onClick={exportBackup}>Exportar cierre</button>
              </div>
              <div className="list">
                {Object.entries(paymentBreakdown).map(([method, total]) => (
                  <div className="list-item" key={method}><strong>{method}</strong><span>{money(total)}</span></div>
                ))}
                {data.partSales.length === 0 ? <div className="empty-state">Aun no hay ventas de repuestos para cerrar.</div> : null}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Ventas recientes</h2></div>
              <div className="list">
                {salesByDay.map(([day, sales]) => (
                  <div className="sales-day-group" key={day}>
                    <div className="sales-day-header">
                      <strong>{formatSaleDay(day)}</strong>
                      <small>{sales.length} ventas / {money(sales.reduce((total, sale) => total + Number(sale.total || 0), 0))}</small>
                    </div>
                    <div className="sales-day-items">
                      {sales.slice(0, 4).map((sale) => (
                        <div className="list-item" key={sale.id}>
                          <strong>{money(sale.total)} / {sale.paymentMethod}</strong>
                          <span>{sale.units} unidades / {new Date(sale.createdAt).toLocaleString("es-CL")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {data.partSales.length === 0 ? <div className="empty-state">Registra una venta desde Repuestos para verla aqui.</div> : null}
              </div>
            </section>
          </div>
          <section className="panel monthly-products">
            <div className="panel-head">
              <div>
                <h2>Ranking de repuestos</h2>
                <p className="muted-copy">Productos mas vendidos segun las ventas registradas en FlowStock Repuestos.</p>
              </div>
              <span className="mode-pill">{partsSalesUnits} unidades</span>
            </div>
            <div className="product-rank-chart">
              {topPart ? [topPart].map((part) => (
                <div className="product-bar top" key={part.name}>
                  <div className="product-bar-label"><strong>{part.name}<span>Top</span></strong><small>{part.units} unidades / {money(part.total)}</small></div>
                  <div className="product-bar-meter"><div className="product-bar-fill" style={{ width: "100%" }} /></div>
                </div>
              )) : <div className="empty-state">Aun no hay ventas para ranking.</div>}
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
                <div className="list-item"><strong>Ventas repuestos</strong><span>{data.partSales.length}</span></div>
              </div>
              <button className="primary-button full" type="button" onClick={exportBackup}>Descargar JSON</button>
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Formato</h2></div>
              <pre>{JSON.stringify({ customers: data.customers.length, vehicles: data.vehicles.length, workOrders: data.workOrders.length, parts: data.parts.length, partSales: data.partSales.length }, null, 2)}</pre>
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
            <tr><th>Patente</th><th>Cliente</th><th>Telefono</th><th>Trabajo</th><th>Recepcion</th><th>Prioridad</th><th>Estado</th>{editable ? <th></th> : null}</tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const vehicle = vehicleById(order.vehicleId);
              const customer = customerById(vehicle?.customerId);
              return (
                <tr key={order.id}>
                  <td><strong>{vehicle?.plate || "-"}</strong></td>
                  <td>{customer?.name || "-"}</td>
                  <td>{renderContactActions(customer)}</td>
                  <td>{order.reason}</td>
                  <td>
                    <div className="evidence-cell">
                      {order.symptoms ? <span>Detalles</span> : null}
                      {orderEvidence[order.id]?.performedWork ? <span>Trabajo realizado</span> : null}
                      {orderEvidence[order.id]?.photos?.length ? <span>{orderEvidence[order.id].photos.length} fotos</span> : null}
                      {!order.symptoms && !orderEvidence[order.id]?.performedWork && !orderEvidence[order.id]?.photos?.length ? "-" : null}
                    </div>
                  </td>
                  <td>{order.priority}</td>
                  <td>{editable ? (
                    <select value={order.state} onChange={(event) => updateOrderState(order.id, event.target.value)}>
                      {orderStates.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>
                  ) : order.state}</td>
                  {editable ? <td><button className="ghost-button" type="button" onClick={() => vehicle && openVehicleProfile(vehicle)}>Ficha</button></td> : null}
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
            <tr><th>Patente</th><th>Vehiculo</th><th>Cliente</th><th>Telefono</th><th>Kilometraje</th><th>Ultima orden</th>{detailed ? <th></th> : null}</tr>
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
                  <td>{renderContactActions(customer)}</td>
                  <td>{Number(vehicle.mileage || 0).toLocaleString("es-CL")} km</td>
                  <td>{order ? `${order.state} / ${order.reason}` : "Sin orden"}</td>
                  {detailed ? <td><button className="ghost-button" type="button" onClick={() => openVehicleProfile(vehicle)}>Ficha</button></td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderContactActions(customer) {
    if (!customer?.phone) return "-";
    const call = phoneHref(customer.phone);
    const whatsapp = whatsappHref(customer.phone);
    return (
      <div className="contact-actions">
        <span>{formatChileMobile(customer.phone)}</span>
        {call ? <a href={call}>Llamar</a> : null}
        {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}
      </div>
    );
  }

  function renderVehicleProfile(vehicle) {
    if (!vehicle) return <div className="empty-state vehicle-profile-empty">Selecciona un vehiculo para ver su ficha.</div>;
    const customer = customerById(vehicle.customerId);
    const timeline = vehicleTimeline(vehicle.id);
    const vehicleQuotes = quotesByVehicle[vehicle.id] || [];
    const activity = [
      ...vehicleQuotes.map((quote) => ({ ...quote, activityType: "quote", activityAt: quote.createdAt })),
      ...timeline.map((order) => ({ ...order, activityType: "order", activityAt: order.intakeAt || order.createdAt }))
    ].sort((a, b) => String(b.activityAt || "").localeCompare(String(a.activityAt || "")));
    const activityGroups = groupByDay(activity, "activityAt");
    const latestOrder = timeline[0];
    return (
      <section className="vehicle-profile">
        <div className="vehicle-profile-head">
          <div>
            <span>Ficha del vehiculo</span>
            <h3>{vehicle.plate} / {vehicle.brand} {vehicle.model}</h3>
          </div>
          <button className="primary-button" type="button" onClick={() => { setActiveView("reception"); updateForm("quick", "plate", vehicle.plate); }}>
            Nueva orden
          </button>
        </div>
        <div className="vehicle-profile-grid">
          <div className="profile-block">
            <small>Cliente</small>
            <strong>{customer?.name || "-"}</strong>
            {renderContactActions(customer)}
          </div>
          <div className="profile-block">
            <small>Kilometraje</small>
            <strong>{Number(vehicle.mileage || 0).toLocaleString("es-CL")} km</strong>
            <span>{latestOrder ? `Ultima OT: ${latestOrder.state}` : "Sin orden activa"}</span>
          </div>
          <div className="profile-block wide">
            <small>Notas permanentes</small>
            <span>{vehicle.permanentNotes || "Sin notas permanentes cargadas."}</span>
          </div>
        </div>
        <div className="vehicle-timeline">
          <div className="vehicle-timeline-head">
            <strong>Historial y modificaciones realizadas</strong>
            <span>{timeline.length} registros / {vehicleQuotes.length} cotizaciones</span>
          </div>
          {activity.length === 0 ? <div className="empty-state">Todavia no hay trabajos ni cotizaciones asociados a esta patente.</div> : null}
          {activityGroups.map(([day, items]) => (
            <section className="history-day-group" key={day}>
              <div className="day-group-head">
                <strong>{formatSaleDay(day)}</strong>
                <span>{items.length} registro{items.length === 1 ? "" : "s"}</span>
              </div>
              {items.map((item) => item.activityType === "quote" ? (
                <article className="timeline-item quote-history-item" key={item.id}>
                  <div>
                    <small>Cotizacion #{item.number} / {item.status}</small>
                    <strong>{item.title}</strong>
                    <span>{new Date(item.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} / {money(item.total)}</span>
                  </div>
                  <div className="quote-items-mini">
                    {(item.items || []).slice(0, 4).map((quoteItem) => <span key={quoteItem.id}>{quoteItem.name} x{quoteItem.quantity}</span>)}
                  </div>
                </article>
              ) : (
                <article className="timeline-item" key={item.id}>
                  <div>
                    <small>Orden de trabajo</small>
                    <strong>{item.reason}</strong>
                    <span>{new Date(item.intakeAt || item.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} / {item.state}</span>
                  </div>
                  {item.evidence?.performedWork ? <p><b>Realizado:</b> {item.evidence.performedWork}</p> : null}
                  {item.symptoms || item.evidence?.details ? <p><b>Recepcion:</b> {item.evidence?.details || item.symptoms}</p> : null}
                  {item.evidence?.photos?.length ? (
                    <div className="timeline-photos">
                      {item.evidence.photos.map((photo) => (
                        <a key={photo.id} href={photo.src} target="_blank" rel="noreferrer" title="Abrir foto">
                          <img src={photo.src} alt={photo.name || "Foto de recepcion"} />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
          ))}
        </div>
      </section>
    );
  }
}
