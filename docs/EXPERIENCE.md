# Plán: herně perfektní zážitek

Cíl: večer s kamarády, kde se nikdo nezasekne, nikdo neřeší techniku a každý tah je čitelný a napínavý.
Každý bod má stav: ✅ hotovo · 🔄 v kolech agentů · 💡 nápad do budoucna.

## 1. Nulové tření při startu
- ✅ Bez registrace – přezdívka a identita v prohlížeči, stůl = 4místný kód nebo odkaz.
- ✅ Znovupřipojení – obnovení stránky / výpadek Wi-Fi vrátí hráče na jeho místo (token).
- ✅ Hra přežije restart serveru (replay log v `data/rooms.json`).
- ✅ Hostování: LAN, Hamachi, Cloudflare tunel, Render.com, Docker; `start.bat` na dvojklik.
- ✅ Diváci přes `?watch=1`.

## 2. Naučit se hrou
- ✅ Pravidla ve hře + databáze karet s hledáním.
- ✅ Hra proti botovi (3 obtížnosti) běží offline v prohlížeči.
- ✅ Kontextové tipy pro nováčky (vypínatelné).
- ✅ Najetím na kartu se v panelu ukáže plný text.
- ✅ U každé nedostupné akce je vysvětlení **proč** (např. „Musí stát nekrytý“).
- 🔄 Vylepšení nápovědy podle zpětné vazby „klientů“.

## 3. Čitelnost stolu
- ✅ Každý stav má barvu **i** ikonu (štít, hodiny, omráčení, nálož, voda…), viz `STATES.md`.
- ✅ Platné cíle pulzují barvou podle záměru (útok / pomoc / výběr), ostatní karty ztmavnou.
- ✅ Místa pro přeživšího jsou zlatá pole „SEM“.
- ✅ Shrnutí soupeřova tahu na začátku tvého tahu + záznam hry.
- ✅ Animace zásahu, zničení, opravy, omráčení, vody; zvuky generované v prohlížeči (vypínatelné).
- 🔄 Doladění velikostí karet na menších obrazovkách (1366×768, 1280×720, mobil na šířku).

## 4. Fér a bez frustrace
- ✅ Server je autoritativní, klient nevidí soupeřovu ruku, rub tuláků ani pořadí balíčku.
- ✅ **Zpět** (Ctrl+Z) pro akce, které neodhalily nic nového; **Zrušit** (Esc) rozdělanou volbu.
- ✅ Potvrzení konce tahu, když zbývá využitelná voda.
- ✅ Automatické volby soupeře, když má jen jednu možnost (žádné zbytečné čekání).
- 🔄 Vyvážení karet a základen podle simulací bot vs. bot.

## 5. Společenská vrstva
- ✅ Chat, rychlé emoce, odveta jedním klikem, skóre série u stolu, tlačítko Vzdát.
- 💡 Volitelné šachové hodiny (např. 90 s na tah) pro rychlé hry.
- 💡 Statistiky hráčů a historie zápasů.

## 6. Zařízení
- ✅ Desktop, notebook, tablet; mobil na šířku (postranní panel se vysouvá).
- ✅ Klávesy: Esc (zavřít/zrušit), Ctrl+Z (zpět).
- 💡 PWA instalace na plochu (manifest je připravený).

## Jak to zajišťujeme
1. **Automatické testy**: pravidla (unit), stovky náhodných her (fuzz) s kontrolou invariantů, bot vs. náhodný hráč, persistence stolů.
2. **Kola agentů**: auditor pravidel, QA tester v reálném prohlížeči (online, reconnect, mobil, zlomyslné zprávy), designér, „klient“ (hráč z cílové skupiny), analytik vyváženosti → oprava → další kolo, dokud nezůstanou jen drobnosti.
