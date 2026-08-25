export function json(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      ...(init.headers || {})
    }
  });
}

export function requestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
