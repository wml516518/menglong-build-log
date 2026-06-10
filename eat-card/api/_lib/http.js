export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-admin-token',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function handleOptions(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }
  return null;
}

export function methodNotAllowed(methods) {
  return json(405, { error: `Method must be ${methods.join(' or ')}` });
}
