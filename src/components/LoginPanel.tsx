import type { FormEvent } from 'react';
import { Lock, User, KeyRound } from 'lucide-react';

type AuthStep = 'login' | 'mfa' | 'app' | 'site_select';
type Candidate = { site: string; auth_status: string };

type Props = {
  authStep: AuthStep;
  authError: string;
  authLoading: boolean;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  otp: string;
  setOtp: (value: string) => void;
  siteCandidates: Candidate[];
  onLogin: (event: FormEvent) => void;
  onMfa: (event: FormEvent) => void;
  onSiteSelect: (site: string) => void;
  onBack: () => void;
};

export function LoginPanel(props: Props) {
  const { authStep, authError, authLoading, username, setUsername, password, setPassword,
    otp, setOtp, siteCandidates, onLogin, onMfa, onSiteSelect, onBack } = props;
  return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-cyan-950/30 rounded-full flex items-center justify-center border border-cyan-500/40 mb-3"><Lock className="text-cyan-400" size={28} /></div>
            <h1 className="text-2xl font-black text-white">Вход в систему</h1>
          </div>
          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold p-3 rounded-xl mb-4 text-center">{authError}</div>}
          {authStep === 'login' ? (
            <form onSubmit={onLogin} className="space-y-4">
              <div className="relative"><User size={18} className="absolute left-4 top-3.5 text-slate-500" /><input type="text" required placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"/></div>
              <div className="relative"><KeyRound size={18} className="absolute left-4 top-3.5 text-slate-500" /><input type="password" required placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"/></div>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-sm active:scale-95 disabled:opacity-50">{authLoading ? '...' : 'Войти'}</button>
            </form>
          ) : authStep === 'site_select' ? (
            <div className="space-y-4">
              <p className="text-xs text-center text-slate-400 font-bold">Аккаунт найден на обоих сайтах. Выберите, куда войти:</p>
              {siteCandidates.map(candidate => {
                const siteLabel = candidate.site === 'globusmvp' ? 'GlobusMVP' : 'GlobusGo';
                const siteDomain = candidate.site === 'globusmvp' ? 'globusmvp.co' : 'globusgo.pro';
                return (
                  <button key={candidate.site} type="button" disabled={authLoading} onClick={() => onSiteSelect(candidate.site)} className="w-full bg-slate-950 border border-slate-800 hover:border-cyan-500/60 rounded-xl px-4 py-3.5 text-left transition disabled:opacity-50">
                    <span className="block text-sm font-black text-white">{siteLabel}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">{siteDomain}{candidate.auth_status === 'mfa_required' ? ' · потребуется код 2FA' : ''}</span>
                  </button>
                );
              })}
              {siteCandidates.length === 0 && <p className="text-xs text-rose-400 text-center">Список доступных сайтов пуст. Вернитесь ко входу и попробуйте снова.</p>}
              <button type="button" onClick={onBack} className="w-full text-xs text-slate-500 hover:text-slate-300 py-2">Назад</button>
            </div>
          ) : (
            <form onSubmit={onMfa} className="space-y-4">
              <p className="text-xs text-center text-slate-400 font-bold mb-3">Введите 2FA код</p>
              <input type="text" required placeholder="Код 2FA" value={otp} onChange={e => setOtp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"/>
              <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-sm active:scale-95 disabled:opacity-50">{authLoading ? '...' : 'Подтвердить'}</button>
            </form>
          )}
        </div>
      </div>
    );
}
