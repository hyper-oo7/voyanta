/**
 * Typed API errors so the UI can decide whether to retry, show raw text,
 * or ask the user to check their connection.
 */

export class ApiError extends Error {
  constructor(message, { status, code, url, retryable = false, original } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.url = url;
    this.retryable = retryable;
    this.original = original;
  }
}

export class NetworkError extends ApiError {
  constructor(url, original) {
    super('Network error — check your internet connection.', {
      status: 0,
      code: 'NETWORK_ERROR',
      url,
      retryable: true,
      original,
    });
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(url, ms, original) {
    super(`Request timed out after ${ms / 1000}s. The server is taking too long to respond.`, {
      status: 0,
      code: 'TIMEOUT',
      url,
      retryable: true, // timeouts are often transient under load
      original,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = ms;
  }
}

export class ClientError extends ApiError {
  constructor(status, message, url, original) {
    super(message || `Client error ${status}`, {
      status,
      code: `HTTP_${status}`,
      url,
      retryable: false, // 4xx won't fix itself
      original,
    });
    this.name = 'ClientError';
  }
}

export class ServerError extends ApiError {
  constructor(status, message, url, original) {
    super(message || `Server error ${status}`, {
      status,
      code: `HTTP_${status}`,
      url,
      retryable: status >= 502 && status <= 504, // Bad Gateway / Gateway Timeout are transient
      original,
    });
    this.name = 'ServerError';
  }
}
