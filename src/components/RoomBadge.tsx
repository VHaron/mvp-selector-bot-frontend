import { ROOMS, ROOM_DOMAINS } from '../constants';
import { getRoomIdByName } from '../utils';

type Props = { roomName: string; getRoomStyle: (name: string) => string };

export const RoomBadge = ({ roomName, getRoomStyle }: Props) => {
  const roomId = getRoomIdByName(roomName);
  const domain = roomId ? ROOM_DOMAINS[roomId] : null;
  const displayName = roomId ? ROOMS[roomId] : roomName;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold text-[10px] uppercase tracking-wider ${getRoomStyle(roomName)} shadow-sm`}>
      {domain && (
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={roomName} className="w-3.5 h-3.5 rounded-full object-cover bg-white p-[0.5px] shadow-sm shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      )}
      <span>{displayName}</span>
    </div>
  );
};

