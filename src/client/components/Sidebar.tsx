import { useEffect, useRef, useState } from 'react';
import { CARDS } from '../../engine/cards';
import type { PlayerIdx } from '../../engine/types';
import type { GameView } from '../../engine/view';
import type { ConnState } from '../conn';
import { EMOTES } from '../../shared/protocol';
import { useZoomTarget } from '../zoom';
import { Card } from './Card';
import { Icon } from './Icon';

export function Sidebar({ view, state, me, onChat, onEmote, mobileOpen, onClose, recap }: {
  view: GameView; state: ConnState; me: PlayerIdx; onChat: (t: string) => void; onEmote: (id: string) => void; mobileOpen: boolean; onClose: () => void;
  recap?: { title: string; lines: string[] } | null;
}) {
  const [tab, setTab] = useState<'log' | 'chat'>('log');
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const zoom = useZoomTarget();
  const lastChat = useRef(state.chat.length);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.log.length, tab]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
    if (state.chat.length > lastChat.current && tab !== 'chat') setUnread((u) => u + state.chat.length - lastChat.current);
    lastChat.current = state.chat.length;
  }, [state.chat.length, tab]);

  const zoomId = zoom?.id && CARDS[zoom.id] ? zoom.id : zoom?.id === 'tulak' ? 'tulak' : null;

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="zoomhost hide-sm">
        {zoomId ? <Card id={zoomId} noZoom /> : recap ? (
          <div className="recap-dock">
            <div className="recap-title"><Icon name="eye-target" /> {recap.title}</div>
            {recap.lines.map((l, i) => <div key={i} className="recap-line">{l}</div>)}
          </div>
        ) : <div className="zoomhint">Najeď myší na kartu – tady uvidíš její plný text.</div>}
      </div>
      <div className="tabs">
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}><Icon name="rule-book" /> Záznam</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => { setTab('chat'); setUnread(0); }}><Icon name="chat-bubble" /> Chat{unread > 0 && ` (${unread})`}</button>
        <button className="mobile-only" onClick={onClose} title="Zavřít"><Icon name="cross-mark" /></button>
      </div>
      {tab === 'log' ? (
        <div className="log" ref={logRef}>
          {view.log.map((e, i) => (
            <div key={i} className={`le k-${e.kind} ${e.player === null ? '' : e.player === me ? 'p0' : 'p1'}`}>{e.text}</div>
          ))}
        </div>
      ) : (
        <div className="chat">
          <div className="lines" ref={chatRef}>
            {state.chat.length === 0 && <div className="line sys">Zatím ticho…</div>}
            {state.chat.map((l, i) => (
              <div key={i} className={`line ${l.system ? 'sys' : ''}`}>{l.system ? l.text : (<><b>{l.from}:</b> {l.text}</>)}</div>
            ))}
          </div>
          <div className="emotes">
            {Object.entries(EMOTES).map(([id, label]) => <button key={id} onClick={() => onEmote(id)}>{label}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onChat(text); setText(''); } }}>
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Napiš zprávu…" maxLength={300} />
            <button className="btn small" type="submit">Poslat</button>
          </form>
        </div>
      )}
    </aside>
  );
}
