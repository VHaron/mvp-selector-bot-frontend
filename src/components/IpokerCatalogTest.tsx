import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, CalendarClock, Trophy, Users, Coins, AlertCircle } from 'lucide-react';

type CatalogTournament = {
  id: string;
  upstream_id?: string;
  room?: string;
  name?: string;
  time_start?: string;
  buyin?: number | string | null;
  fee?: number | string | null;
  total_buyin?: number | string | null;
  currency?: string;
  gtd?: number | string | null;
  afs?: number | string | null;
  registered_players?: number | string | null;
  status?: string;
  is_pko?: boolean | null;
  is_knockout?: boolean;
  is_mystery_bounty?: boolean;
  raw?: unknown;
};

type CatalogResponse = {
  status: string;
  source: string;
  updated_at: string | null;
  stale: boolean;
  count: number;
  data: CatalogTournament[];
};

const CATALOG_API = 'https://ipoker-parser-backend-test-testing.up.railway.app/api/tournaments/catalog';

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown, currency = 'EUR') {
  const n = numberValue(value);
  if (n === null) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency}`;
}

function dateLabel(value?: string) {
  if (!value) return 'Время не указано';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function IpokerCatalogTest() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState('all');
  const [sort, setSort] = useState<'time' | 'buyin'>('time');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(CATALOG_API, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Каталог недоступен: HTTP ${response.status}`);
      const payload = await response.json() as CatalogResponse;
      if (!Array.isArray(payload.data)) throw new Error('Сервер вернул каталог в неизвестном формате');
      setCatalog(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...(catalog?.data ?? [])]
      .filter(item => !needle || (item.name ?? '').toLocaleLowerCase().includes(needle) || (item.upstream_id ?? '').includes(needle))
      .filter(item => currency === 'all' || (item.currency ?? '').toUpperCase() === currency)
      .sort((a, b) => sort === 'time'
        ? (new Date(a.time_start ?? 0).getTime() - new Date(b.time_start ?? 0).getTime())
        : ((numberValue(a.total_buyin ?? a.buyin) ?? 0) - (numberValue(b.total_buyin ?? b.buyin) ?? 0)));
  }, [catalog, query, currency, sort]);

  const updated = catalog?.updated_at ? dateLabel(catalog.updated_at) : 'нет данных';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">Изолированная тестовая среда</div>
            <h1 className="mt-1 text-2xl font-black text-white">ChampionPoker · iPoker</h1>
            <p className="mt-1 text-sm text-slate-400">Прямой каталог турниров, без Globus</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold hover:border-cyan-500 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Обновить
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><Trophy size={15}/> Турниров в каталоге</div>
            <div className="mt-2 text-3xl font-black text-white">{catalog?.count ?? '—'}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><CalendarClock size={15}/> Последнее обновление</div>
            <div className="mt-3 text-lg font-bold text-white">{updated}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><AlertCircle size={15}/> Состояние данных</div>
            <div className={`mt-3 text-lg font-black ${catalog && !catalog.stale ? 'text-emerald-400' : 'text-amber-400'}`}>
              {loading ? 'Загрузка…' : catalog?.stale ? 'Устарели' : catalog ? 'Актуальны' : 'Нет данных'}
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-300">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row">
            <label className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по названию или ID турнира" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-500"/>
            </label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              <option value="all">Все валюты</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="RUB">RUB</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as 'time' | 'buyin')} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              <option value="time">По времени старта</option><option value="buyin">По бай-ину</option>
            </select>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-400">
            <span>Найдено: <b className="text-white">{filtered.length}</b></span>
            <span>Источник: ChampionPoker / iPoker</span>
          </div>
          {loading && !catalog ? <div className="p-10 text-center text-slate-400">Загружаем турниры…</div> :
            filtered.length === 0 ? <div className="p-10 text-center text-slate-400">Турниры не найдены</div> :
            <div className="divide-y divide-slate-800">
              {filtered.map((item, index) => (
                <article key={item.id || item.upstream_id || index} className="grid grid-cols-1 gap-2 px-4 py-3 hover:bg-slate-800/40 md:grid-cols-[minmax(0,1fr)_125px_125px_130px] md:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{item.name || 'Без названия'}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>#{item.upstream_id ?? '—'}</span>
                      {item.is_pko && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-300">PKO</span>}
                      {item.is_mystery_bounty && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">Mystery</span>}
                      {item.status && <span>{item.status}</span>}
                    </div>
                  </div>
                  <div className="text-sm text-cyan-300">{dateLabel(item.time_start)}</div>
                  <div className="flex items-center gap-1 text-sm font-bold text-emerald-400"><Coins size={14}/>{money(item.total_buyin ?? item.buyin, item.currency || 'EUR')}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span title="Гарантия">GTD {money(item.gtd, item.currency || 'EUR')}</span>
                    <span className="flex items-center gap-1" title="Регистрации"><Users size={13}/>{item.registered_players ?? '—'}/{item.afs ?? '—'}</span>
                  </div>
                </article>
              ))}
            </div>
          }
        </section>
        <p className="text-center text-xs text-slate-600">Тестовый интерфейс подключён только к тестовому API. Основной селектор и его backend не изменяются.</p>
      </main>
    </div>
  );
}
