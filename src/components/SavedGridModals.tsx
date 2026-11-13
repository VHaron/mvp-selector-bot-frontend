import { AlertTriangle, CheckCircle2, Save, X } from 'lucide-react';

type Props = {
  saveOpen: boolean;
  onCloseSave: () => void;
  name: string;
  onNameChange: (value: string) => void;
  onSave: () => void;
  error: string;
  success: string;
  gridCount: number;
  errorOpen: boolean;
  onCloseError: () => void;
  confirmOpen: boolean;
  pendingName: string | null;
  onConfirmReplace: () => void;
  onCancelReplace: () => void;
};

const overlayClass = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4';
const panelClass = 'relative w-full max-w-md overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.65)]';

export function SavedGridModals(props: Props) {
  const {
    saveOpen, onCloseSave, name, onNameChange, onSave, error, success, gridCount,
    errorOpen, onCloseError, confirmOpen, pendingName, onConfirmReplace, onCancelReplace,
  } = props;

  return (
    <>
      {saveOpen && (
        <div className={overlayClass} onMouseDown={event => { if (event.target === event.currentTarget) onCloseSave(); }}>
          <section className={panelClass} role="dialog" aria-modal="true" aria-labelledby="save-grid-title">
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400" />
            <button type="button" onClick={onCloseSave} aria-label="Закрыть" className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white">
              <X size={18} />
            </button>
            <div className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  {success ? <CheckCircle2 size={21} /> : <Save size={21} />}
                </div>
                <div>
                  <h2 id="save-grid-title" className="text-sm font-black uppercase tracking-wider text-white">Сохранение сетки</h2>
                  <p className="mt-1 text-xs text-slate-400">{gridCount} турниров в текущей сетке</p>
                </div>
              </div>

              {success ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</div>
              ) : (
                <>
                  <label htmlFor="saved-grid-name" className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Название сохранения</label>
                  <input
                    id="saved-grid-name"
                    autoFocus
                    maxLength={48}
                    value={name}
                    onChange={event => onNameChange(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') onSave(); }}
                    placeholder="Например, Вечерний ABI 3$"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                  {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
                </>
              )}

              <div className="mt-6 flex gap-2">
                <button type="button" onClick={onCloseSave} className="flex-1 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-xs font-bold text-slate-300 transition hover:bg-slate-800">
                  {success ? 'Закрыть' : 'Отмена'}
                </button>
                {!success && (
                  <button type="button" onClick={onSave} disabled={!name.trim()} className="flex-1 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/40 transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
                    Сохранить
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {errorOpen && (
        <div className={overlayClass}>
          <section className={panelClass + ' max-w-sm'} role="alertdialog" aria-modal="true" aria-labelledby="grid-error-title">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400"><AlertTriangle size={20} /></div>
                <h2 id="grid-error-title" className="text-sm font-black uppercase tracking-wider text-white">Не удалось выполнить действие</h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">{error}</p>
              <button type="button" onClick={onCloseError} className="mt-6 w-full rounded-xl bg-slate-800 px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-slate-700">Понятно</button>
            </div>
          </section>
        </div>
      )}

      {confirmOpen && (
        <div className={overlayClass}>
          <section className={panelClass + ' max-w-sm'} role="alertdialog" aria-modal="true" aria-labelledby="replace-grid-title">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><AlertTriangle size={20} /></div>
                <h2 id="replace-grid-title" className="text-sm font-black uppercase tracking-wider text-white">Заменить текущую сетку?</h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">Текущая сетка будет заменена на сохранённую «<span className="font-bold text-white">{pendingName}</span>».</p>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={onCancelReplace} className="flex-1 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-xs font-bold text-slate-300 transition hover:bg-slate-800">Отмена</button>
                <button type="button" onClick={onConfirmReplace} className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-xs font-black uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/25">Заменить</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
