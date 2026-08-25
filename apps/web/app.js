const API = localStorage.getItem('apiUrl') || 'http://localhost:3000';
const state = {
  token: localStorage.getItem('token') || '',
  customers: [],
  vehicles: [],
  workOrders: [],
  parts: []
};

const $ = (selector) => document.querySelector(selector);

function log(message, payload) {
  const output = $('#logOutput');
  const line = payload ? `${message}\n${JSON.stringify(payload, null, 2)}` : message;
  output.textContent = `${new Date().toLocaleTimeString()} ${line}\n\n${output.textContent}`.slice(0, 5000);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
  return body;
}

function formData(form) {
  const raw = Object.fromEntries(new FormData(form).entries());
  for (const [key, value] of Object.entries(raw)) {
    if (['mileage', 'cost', 'price', 'stock', 'minimumStock', 'quantity'].includes(key)) raw[key] = Number(value);
    if (value === '') delete raw[key];
  }
  return raw;
}

function fillSelect(selector, items, label) {
  const select = $(selector);
  select.innerHTML = items.map((item) => `<option value="${item.id}">${label(item)}</option>`).join('');
}

async function refresh() {
  if (!state.token) return;
  const [customers, vehicles, workOrders, parts, dashboard] = await Promise.all([
    api('/customers'),
    api('/vehicles'),
    api('/work-orders'),
    api('/parts'),
    api('/dashboard/summary')
  ]);
  state.customers = customers.data;
  state.vehicles = vehicles.data;
  state.workOrders = workOrders.data;
  state.parts = parts.data;

  fillSelect('#vehicleForm [name="customerId"]', state.customers, (item) => item.name);
  fillSelect('#orderForm [name="vehicleId"]', state.vehicles, (item) => `${item.plate} ${item.brand} ${item.model}`);
  fillSelect('#consumeForm [name="workOrderId"]', state.workOrders, (item) => `${item.id.slice(0, 8)} ${item.state}`);
  fillSelect('#consumeForm [name="partId"]', state.parts, (item) => `${item.sku} ${item.name} (${item.stock})`);

  $('#openOrders').textContent = dashboard.data.openWorkOrders;
  $('#lowStock').textContent = dashboard.data.lowStockCount;
  $('#statesCount').textContent = Object.keys(dashboard.data.workOrdersByState).length;
}

async function login() {
  const result = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@taller.local', password: 'admin12345' })
  });
  state.token = result.token;
  localStorage.setItem('token', result.token);
  $('#sessionState').textContent = `${result.user.name} (${result.user.role})`;
  log('Sesion iniciada');
  await refresh();
}

$('#loginButton').addEventListener('click', () => login().catch((error) => log(`Error login: ${error.message}`)));

for (const [selector, endpoint] of [
  ['#customerForm', '/customers'],
  ['#vehicleForm', '/vehicles'],
  ['#orderForm', '/work-orders'],
  ['#partForm', '/parts']
]) {
  $(selector).addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const result = await api(endpoint, { method: 'POST', body: JSON.stringify(formData(event.currentTarget)) });
      event.currentTarget.reset();
      log('Registro creado', result.data);
      await refresh();
    } catch (error) {
      log(`Error: ${error.message}`);
    }
  });
}

$('#consumeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  try {
    const result = await api(`/work-orders/${data.workOrderId}/parts`, {
      method: 'POST',
      body: JSON.stringify({ partId: data.partId, quantity: data.quantity })
    });
    log('Stock descontado', result.data);
    await refresh();
  } catch (error) {
    log(`Error stock: ${error.message}`);
  }
});

$('#searchButton').addEventListener('click', async () => {
  try {
    const vehicle = await api(`/vehicles/by-plate/${encodeURIComponent($('#plateSearch').value)}`);
    const history = await api(`/vehicles/${vehicle.data.id}/history`);
    $('#historyOutput').textContent = JSON.stringify({ vehicle: vehicle.data, history: history.data }, null, 2);
  } catch (error) {
    $('#historyOutput').textContent = error.message;
  }
});

if (state.token) {
  $('#sessionState').textContent = 'Sesion guardada';
  refresh().catch(() => {
    state.token = '';
    localStorage.removeItem('token');
  });
}
