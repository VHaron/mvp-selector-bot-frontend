import { API_BASE_URL, PARSER_API_BASE_URL } from '../constants';

type IpokerCatalogResponse = {
  status: 'ready' | 'empty';
  stale: boolean;
  count: number;
  data: Record<string, unknown>[];
};

const fetchIpokerCatalog = async (): Promise<IpokerCatalogResponse> => {
  const response = await fetch(`${PARSER_API_BASE_URL}/api/tournaments/catalog`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`iPoker catalog returned HTTP ${response.status}`);
  return response.json() as Promise<IpokerCatalogResponse>;
};

const mergeIpokerCatalog = async (data: any, body: unknown) => {
  const requestedRooms = (body as { rooms?: string[] } | null)?.rooms || [];
  if (data?.status !== 'success' || !Array.isArray(data.data) || !requestedRooms.includes('247')) return data;

  try {
    const catalog = await fetchIpokerCatalog();
    if (!Array.isArray(catalog.data) || catalog.data.length === 0) return data;

    const mapped = catalog.data.map((item): Record<string, string> => ({
      id: String(item.id || ''),
      source: 'ipoker',
      room: String(item.room || 'iPoker'),
      name: String(item.name || 'iPoker tournament'),
      priority: '3',
      buyin: String(item.buyin ?? ''),
      reentry: '0',
      time_start: String(item.time_start || ''),
      roi_str: '',
      ev_mtt: '0',
      day_week: '',
      duration: String(item.duration ?? ''),
      gtd: String(item.gtd ?? ''),
      afs: String(item.afs ?? ''),
    }));

    const key = (item: Record<string, unknown>) =>
      [item.room, item.name, item.time_start, item.buyin].map(value => String(value ?? '').trim().toLowerCase()).join('|');
    const existing = new Set((data.data as Record<string, unknown>[]).map(key));
    const additions = mapped.filter(item => item.id && !existing.has(key(item)));
    return { ...data, data: [...data.data, ...additions], ipoker_count: additions.length, ipoker_stale: catalog.stale };
  } catch (error) {
    // iPoker is an additional source: an unavailable parser must not block the existing Globus search.
    console.warn('Не удалось загрузить общий каталог iPoker:', error);
    return data;
  }
};

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
    let data = await response.json().catch(() => ({}));
    if (response.ok && endpoint === 'tournaments') data = await mergeIpokerCatalog(data, body);
    return response.ok ? data : { ...(typeof data === 'object' && data !== null ? data : {}), status_code: response.status };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Сервер не ответил за 45 секунд. Попробуйте ещё раз.');
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
