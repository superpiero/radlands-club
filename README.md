# 💧 Poslední kapka

Karetní duel dvou hráčů o vodu v postapokalyptické pustině. Hraje se v prohlížeči: **online s kamarády**, po **LAN / Hamachi**, **proti botovi**, nebo **ve dvou u jednoho počítače**.

Je to vlastní hra pro kamarády (žádný komerční produkt): vlastní název, karty, texty i grafika. Mechanicky patří do žánru „tower-defense“ karetních duelů: 3 základny, sloupce přeživších, krytí, voda jako jediná surovina, fronta operací s odpočtem a nájezdy.

- 📜 Pravidla: [`docs/RULES.md`](docs/RULES.md) (ve hře: *Pravidla*)
- 🃏 Databáze karet: [`docs/CARDS.md`](docs/CARDS.md), strojově [`docs/cards.json`](docs/cards.json) (ve hře: *Karty*)
- 🎨 Jak se značí stavy karet: [`docs/STATES.md`](docs/STATES.md)
- 🧱 Architektura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Rychlý start (vlastní počítač)

Potřebuješ [Node.js 20+](https://nodejs.org).

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

Server vypíše adresy, např. `http://localhost:8080` a `http://192.168.1.23:8080`.
Na Windows stačí dvojklik na **`start.bat`** (na Linuxu/macOS `./start.sh`) – nainstaluje, sestaví a spustí vše sám.

V prohlížeči zadej přezdívku → **Založit stůl** → pošli kamarádovi odkaz nebo 4místný kód.

## Hraní s kamarády

### 1. LAN (stejná Wi-Fi / síť)
Spusť server a kamarádům pošli adresu „V síti/LAN“, kterou server vypíše (`http://192.168.x.x:8080`).
Když se nepřipojí, povol Node.js ve Windows firewallu (privátní síť).

### 2. Hamachi / ZeroTier / Tailscale
Všichni ve stejné virtuální síti. Hostitel spustí server, ostatní otevřou `http://<Hamachi-IP-hostitele>:8080`
(Hamachi IP začíná obvykle `25.`). Port 8080 musí být ve firewallu povolený.

### 3. Přes internet z vlastního PC (bez nastavování routeru)
Spusť server a k němu tunel [Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) (zdarma, bez účtu):

```bash
cloudflared tunnel --url http://localhost:8080
```

Dostaneš veřejnou adresu `https://něco.trycloudflare.com` – tu pošli kamarádům. WebSockety fungují.
(Alternativa: `ngrok http 8080`.)

### 4. Trvale online (hosting zdarma)
- **Render.com**: nahraj repozitář na GitHub → Render → *New → Blueprint* → vyber repozitář (použije se `render.yaml`). Free plán po neaktivitě usíná – první načtení pak trvá ~1 min.
- **Docker** (Fly.io, Railway, vlastní VPS…):

```bash
docker build -t posledni-kapka .
```

```bash
docker run -p 8080:8080 posledni-kapka
```

Proměnné prostředí: `PORT` (výchozí 8080), `HOST` (výchozí 0.0.0.0).

## Herní režimy
| Režim | Kde běží | Poznámka |
|---|---|---|
| Online – Klasika | server | jeden společný balíček 72 karet; odkaz/kód, znovupřipojení, chat, emoce, odveta, diváci (`?watch=1`) |
| Online – Sběratelský | server + účet | každý hraje se svým balíčkem (30–40 karet) z vlastní kolekce |
| Proti botovi | jen prohlížeč | 3 obtížnosti |
| Jeden počítač | jen prohlížeč | před předáním zařízení se ruka skryje |

## Účty, boostery a kolekce
- **Registrace** (jméno + heslo, uložené na herním serveru v `data/accounts.json`, heslo zahashované scryptem).
- Po registraci dostaneš **startovní sadu** (všechny běžné karty 2× + pár neobvyklých) a **3 uvítací boostery**.
- **Booster** = 5 karet: 3 běžné, 1 neobvyklá (15 % šance na vzácnou), 1 vzácná (25 % šance na legendární). Ochrana proti duplikátům: přednostně padají karty, které ještě nemáš v maximálním počtu; když máš všechno, slot se povýší, a teprve pak se nadbytečná karta rozpustí na kapky.
- **Kapky** získáš za online hry (výhra 100, prohra 50, remíza 60; hra musí mít aspoň 6 tahů). Booster stojí 100 kapek.
- **Balíček**: 30–40 karet, max. 2 kopie od karty, legendární 1×. Tlačítko *Doplnit automaticky* sestaví balíček z kolekce.
- Sběratelský režim má vlastní pravidlo **Žízeň**: balíček se při dojití znovu zamíchá, ale od druhého zamíchání to stojí poškození tvé nejméně poškozené základny.
- Kolekce obsahuje 46 karet: 36 ze základní sady + 10 vzácných a legendárních karet jen pro sběratelský režim.

Data serveru (stoly i účty) jsou ve složce `data/` (nebo `DATA_DIR`). Zálohuj ji, pokud hostuješ dlouhodobě.

## Vývoj

```bash
npm run dev
```
(server na :8080 + Vite na :5173 s hot-reloadem; otevři `http://localhost:5173`)

```bash
npm test
```
(pravidla, fuzz test stovek náhodných her, bot vs. náhodný hráč)

Další příkazy: `npm run typecheck`, `npm run docs:cards` (přegeneruje `docs/CARDS.md` z `src/engine/cards.ts`), `npm run icons` (přegeneruje sadu ikon).

## Licence a zdroje
- Kód a obsah hry: soukromý projekt pro kamarády.
- Ikony: [game-icons.net](https://game-icons.net) – Lorc, Delapouite a další, licence [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Písma: Saira Stencil One, Barlow Condensed, Special Elite (SIL Open Font License, přes Fontsource).
