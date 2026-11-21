# Architektura

```
src/
  engine/        čistý TypeScript, běží v Node i v prohlížeči
    types.ts     datové typy (GameState, Action, Prompt…)
    cards.ts     databáze karet = data + skripty schopností
    game.ts      pravidla: tah, akce, efekty, volby, undo, legalita
    view.ts      pohled pro konkrétního hráče (skrývá ruku soupeře, rub tuláků…)
    bot.ts       náhodný hráč (fuzz testy) a heuristický bot (greedy + determinizované simulace)
    rng.ts       deterministické RNG uložené ve stavu (replay, klonování)
  server/        Node HTTP + WebSocket server (místnosti, znovupřipojení, chat)
  shared/        protokol klient ↔ server
  client/        React aplikace (Vite)
    conn.ts      NetConn (WebSocket) a LocalConn (bot / hot-seat v prohlížeči)
    components/  Board, Card, Draft, FxLayer, Sidebar…
    pages/       Home, GameScreen, Rules, Gallery
tests/           Vitest: pravidla + fuzz (stovky náhodných her) + bot vs náhodný hráč
scripts/         generování ikon a dokumentace karet
```

## Engine
- Každá akce hráče se spustí jako **generátor**. Když je potřeba rozhodnutí (cíl, místo, pořadí…), generátor vydá `Prompt`
  a engine čeká na akci `{t:'answer'}` od hráče, kterému prompt patří (může to být i soupeř – např. volba základny při Nájezdu).
- Na začátku každé akce se uloží snímek stavu → **Zrušit** (dokud nebyla odhalena informace) a **Zpět** (undo stack).
- `Game.clone()` umí klonovat i uprostřed akce (snímek + přehrání odpovědí) – používá bot pro simulace.
- Skryté informace: ruka soupeře, identita tulákůl, pořadí balíčku. Karty, které se vrací do skrytých zón, dostanou nové `uid`,
  aby nešly vystopovat.

## Síť
- Server je autoritativní: drží `Game`, klienti posílají akce, server každému pošle jeho `GameView`.
- Identita hráče = náhodný token v `localStorage` → po obnovení stránky / výpadku se hráč vrátí na své místo.
- Místnosti se po 3 h nečinnosti (bez připojených hráčů) mažou.
