import { API_BASE_URL } from '../constants';

export const apiCall = async (endpoint: string, body: unknown) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return response.ok ? data : { ...(typeof data === 'object' && data !== null ? data : {}), status_code: response.status };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Сервер не ответил за 45 секунд. Попробуйте ещё раз.');
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
