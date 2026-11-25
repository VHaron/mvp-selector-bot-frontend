export interface Tournament {
  id: string; room: string; name: string; priority: string;
  buyin: string; time_start: string; roi_str: string; gtd: string;
  afs: string; duration: string; ev_mtt: string; day_week: string; start_timestamp?: number;
}

export type NoteTag = 'skip' | 'must' | 'none' | string;
export interface NoteData { tag: NoteTag; text: string; }
export interface SessionData { id: string; date: string; total_buyin: number; total_cashes: number; profit: number; tournaments_count: number; }
