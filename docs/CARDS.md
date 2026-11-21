# Databáze karet – Poslední kapka

> Generováno z `src/engine/cards.ts` (`npm run docs:cards`). Neupravovat ručně.

Klasický balíček: **72 karet** – 24 druhů přeživších a 12 druhů operací, každá 2× (+10 karet jen pro sběratelský režim).  
Základen: **29** (každý hráč dostane 6, vybere 3).

## Přeživší (31)

| Karta | Cena | Rozebrání | Schopnosti / vlastnosti |
|---|---|---|---|
| **Pumpař** `pumpar` | 1💧 | Voda navíc | **[1💧]** Lízni kartu. Pokud pak máš v ruce nejvýš 1 kartu (nepočítá se Cisterna), lízni další. |
| **Brokovnice Bára** `bara` | 2💧 | Zranit | **[2💧]** Poškoď. Pokud tím zničíš přeživšího, lízni kartu. |
| **Kluk s prakem** `prak` | 1💧 | Tulák | **[1💧]** Zraň. Lze použít, jen když tato karta stojí nekrytá. |
| **Zvěd** `zved` | 1💧 | Líznout | **[1💧]** Vyber soupeřův sloupec. Do konce tahu jsou všechny karty v něm nekryté. |
| **Ženistka Hana** `hana` | 2💧 | Nájezd | **[1💧]** Polož nálož na nekrytou soupeřovu základnu (bez nálože). Na začátku tvého příštího tahu vybuchne a základnu poškodí, i když bude krytá. |
| **Felčar** `felcar` | 1💧 | Opravit | **[1💧]** Oprav svého poškozeného přeživšího (nebo zneškodni nálož). Opravený přeživší zůstává připravený. |
| **Kovářka Rez** `rez` | 2💧 | Opravit | **[2💧]** Oprav svou poškozenou základnu (nebo zneškodni nálož). |
| **Pašerák** `paserak` | 1💧 | Voda navíc | **[1💧]** Prohlédni si vrchní 2 karty balíčku. Jednu si vezmi do ruky, druhou dej dospod balíčku. |
| **Náborář** `naborar` | 1💧 | Tulák | **[1💧]** Naverbuj tuláka. Lze použít, jen když máš ve hře méně přeživších než soupeř. |
| **Vymahač** `vymahac` | 2💧 | Zranit | **[1💧]** Omrač nekrytého nepřítele: během soupeřova příštího tahu nebude připravený. |
| **Hlídkař** `hlidkar` | 2💧 | Líznout | _Vlastnost:_ Jednou za tah: když soupeř poškodí nebo zraní jinou tvou kartu v tomto sloupci, můžeš zranit nekrytého nepřítele. |
| **Skladnice Marta** `marta` | 2💧 | Voda navíc | **[1💧]** Tato voda zůstane na Martě jako zásoba. Na začátku tvého příštího tahu získáš 2 vody navíc (pokud je Marta stále ve hře). |
| **Bedřich Pancéř** `bedrich` | 2💧 | Opravit | **[1💧]** Přesuň Bedřicha do jiného sloupce s volným místem, na přední pozici.<br>_Vlastnost:_ Zranění na Bedřicha nepůsobí (lze ho jen poškodit nebo zničit). |
| **Pes Rex** `rex` | 1💧 | Tulák | _Vlastnost:_ I když je poškozený: když je Rex zničen, naverbuj tuláka. |
| **Mechanička Jiskra** `jiskra` | 2💧 | Voda navíc | **[1💧]** Vyber svou základnu, jejíž schopnost jsi v tomto tahu už použil. Je znovu připravená. |
| **Granátník** `granatnik` | 3💧 | Zranit | **[2💧]** Poškoď. Pokud tím zničíš přeživšího a v jeho sloupci stojí další přeživší, zraň i toho. |
| **Bubeník** `bubenik` | 2💧 | Líznout | **[1💧]** Jiný tvůj nepoškozený přeživší, který v tomto tahu použil schopnost, je znovu připravený. |
| **Sběračka Myška** `myska` | 2💧 | Tulák | **[2💧]** Vezmi si do ruky vrchní kartu odhazovacího balíčku. |
| **Radista** `radista` | 1💧 | Nájezd | **[1💧]** Posuň svou operaci ve frontě o 1 místo vpřed (na volné místo). Z místa 1 se operace hned vyhodnotí. |
| **Lasař** `lasar` | 2💧 | Nájezd | **[1💧]** Vyber soupeřův sloupec se dvěma přeživšími a prohoď jejich pořadí. |
| **Starostka Ludmila** `ludmila` | 2💧 | Líznout | _Vlastnost:_ Na začátku tvého tahu: pokud nemáš ve frontě žádnou operaci, lízni kartu. |
| **Prospektorka** `prospektorka` | 1💧 | Voda navíc | **[2💧]** Lízni 2 karty, pak 1 kartu z ruky odhoď. |
| **Minometčík** `minometcik` | 3💧 | Nájezd | **[2💧]** Zraň krytého přeživšího, který stojí vzadu v soupeřově sloupci. |
| **Kat** `kat` | 3💧 | Zranit | **[2💧]** Znič poškozeného nepřítele (i krytého). |
| **Honák Vítek** `honak` | 2💧 | Nájezd | **[2💧]** Nájezd: zahraj nebo posuň svůj Nájezd. |
| **Doktorka Iva** `doktorka` | 3💧 | Opravit | **[2💧]** Oprav až 2 své poškozené karty. |
| **Strážce studny** `strazce` | 2💧 | Voda navíc | _Vlastnost:_ Dokud je Strážce nepoškozený, základnu v jeho sloupci nelze poškodit Nájezdem. |
| **Vodní baron** `baron` | 3💧 | Voda navíc | **[2💧]** Lízni 2 karty.<br>_Vlastnost:_ Na začátku tvého tahu získáš 1 vodu navíc. |
| **Matka Prachu** `matka` | 3💧 | Tulák | **[2💧]** Naverbuj 2 tuláky.<br>_Vlastnost:_ Tvoji tuláci vydrží dvě poškození (první je jen poškodí). |
| **Prorok Bouře** `prorok` | 4💧 | Zranit | **[3💧]** Poškoď každého nekrytého soupeřova přeživšího. |
| **Velitelka Ocel** `velitelka` | 3💧 | Nájezd | **[1💧]** Nájezd: zahraj nebo posuň svůj Nájezd.<br>_Vlastnost:_ Když tvůj Nájezd poškodí základnu, lízni 2 karty. |

## Operace (15)

| Karta | Cena | Odpočet | Rozebrání | Efekt |
|---|---|---|---|---|
| **Sucho** `sucho` | 2💧 | 1 | Voda navíc | Soupeř získá ve svém příštím tahu o 1 vodu méně. |
| **Karavana** `karavana` | 1💧 | 2 | Líznout | Lízni 3 karty. |
| **Dělostřelectvo** `delostrelectvo` | 2💧 | 2 | Zranit | Dvakrát poškoď (můžeš i stejnou kartu). |
| **Sanitka** `sanitka` | 2💧 | 2 | Opravit | Oprav všechny své poškozené karty (přeživší i základny) a zneškodni nálože na svých základnách. |
| **Písečná bouře** `boure` | 2💧 | 2 | Líznout | Omrač všechny soupeřovy přeživší (během jeho příštího tahu nebudou připravení). |
| **Sabotáž** `sabotaz` | 1💧 | ⚡ ihned | Nájezd | Odstraň jednu soupeřovu operaci z jeho fronty. (Nájezd se mu vrátí, jiné operace odhoď.) _(Nelze zahrát, pokud soupeř nemá žádnou operaci ve frontě.)_ |
| **Podkop** `podkop` | 1💧 | 3 | Zranit | Poškoď libovolnou soupeřovu základnu (i krytou). |
| **Skrytý pramen** `pramen` | 0💧 | 3 | Voda navíc | Získej 3 vody navíc. |
| **Noční přepad** `prepad` | 1💧 | 1 | Zranit | Zraň. Pokud má soupeř 4 nebo více přeživších, zraň znovu. |
| **Evakuace** `evakuace` | 1💧 | ⚡ ihned | Tulák | Vrať svého přeživšího (ne tuláka) do ruky. Pak naverbuj tuláka. _(Nelze zahrát, pokud nemáš žádného přeživšího lícem nahoru.)_ |
| **Poslední kapka** `poslednikapka` | 3💧 | 3 | Voda navíc | Poškoď dvě různé soupeřovy základny (i kryté). |
| **Výměnný obchod** `vymena` | 0💧 | ⚡ ihned | Líznout | Odhoď až 2 karty z ruky. Pak lízni o 1 kartu víc, než kolik jsi odhodil. |
| **Kyselý déšť** `kyselydest` | 2💧 | 2 | Zranit | Poškoď každou nekrytou soupeřovu základnu. |
| **Výsadek** `vysadek` | 1💧 | 1 | Tulák | Naverbuj 2 tuláky. Pak lízni kartu. |
| **Oáza** `oaza` | 2💧 | 3 | Voda navíc | Oprav všechny své karty a získej 3 vody navíc. |

## Základny (29)

| Základna | Zásoby (karty) | Odolnost | Schopnost / vlastnost |
|---|---|---|---|
| **Vodárna** `vodarna` | 1 | 2 | **[1💧]** Získej 2 vody navíc. |
| **Radiostanice** `radiostanice` | 2 | 2 | **[1💧]** Prohlédni si vrchní 3 karty balíčku a vrať je v libovolném pořadí. |
| **Kulometné hnízdo** `hnizdo` | 2 | 2 | **[2💧]** Zraň. |
| **Dílna** `dilna` | 2 | 2 | **[1💧]** Oprav svého poškozeného přeživšího, nebo zneškodni nálož na své základně. |
| **Tržiště** `trziste` | 1 | 2 | **[1💧]** Odhoď kartu z ruky, pak lízni 2 karty. |
| **Sklad trhavin** `trhaviny` | 1 | 2 | **[1💧]** Polož nálož na nekrytou soupeřovu základnu (bez nálože). Na začátku tvého příštího tahu vybuchne a základnu poškodí, i když bude krytá. |
| **Ubikace** `ubikace` | 1 | 2 | **[1💧]** Naverbuj tuláka. |
| **Bunkr** `bunkr` | 1 | 2 | _Vlastnost:_ Dokud v tomto sloupci stojí 2 nepoškození přeživší, Bunkr nelze poškodit (ani nájezdem). |
| **Studna** `studna` | 0 | 2 | _Vlastnost:_ Na začátku tvého tahu, pokud Studna není poškozená, získáš 1 vodu navíc. |
| **Šrotiště** `srotiste` | 2 | 2 | **[1💧]** Rozeber kartu z ruky: její efekt rozebrání se provede dvakrát. |
| **Zbrojnice** `zbrojnice` | 0 | 2 | **[2💧]** Poškoď. |
| **Přehrada** `prehrada` | 2 | 2 | **[0💧]** Ulož 1 nebo 2 své vody do Přehrady. Na začátku tvého příštího tahu je získáš zpět jako vodu navíc. |
| **Pašerácká stezka** `stezka` | 1 | 2 | _Vlastnost:_ Tvoje první akce Lízni kartu v každém tahu stojí 1 vodu místo 2. |
| **Signální oheň** `signal` | 1 | 2 | **[2💧]** Nájezd: zahraj nebo posuň svůj Nájezd. |
| **Pevnost** `pevnost` | 1 | 3 | _Vlastnost:_ Pevnost je zničena až třetím poškozením. |
| **Vrakoviště** `vrakoviste` | 1 | 2 | **[0💧]** Odhoď kartu z ruky: naverbuj tuláka. |
| **Rušička** `rusicka` | 2 | 2 | **[1💧]** Soupeř náhodně odhodí kartu z ruky. (Cisterna se mu vrátí do zóny.) |
| **Hangár** `hangar` | 2 | 2 | **[1💧]** Prohoď přeživší ve dvou svých sloupcích (všichni se přesunou k druhé základně). |
| **Vysílač** `vysilac` | 0 | 2 | _Vlastnost:_ Tvoje operace (i Nájezd) se ve frontě umisťují o 1 místo blíž (nejméně na místo 1). |
| **Kráter** `krater` | 3 | 2 | — |
| **Ruiny nemocnice** `nemocnice` | 1 | 2 | **[3💧]** Oprav jinou svou poškozenou kartu (přeživšího i základnu), nebo zneškodni nálož. |
| **Vězení** `vezeni` | 2 | 2 | **[1💧]** Omrač nekrytého nepřítele: během soupeřova příštího tahu nebude připravený. |
| **Radar** `radar` | 1 | 2 | **[1💧]** Prohlédni si soupeřovu ruku. Pak lízni kartu. |
| **Minové pole** `minovepole` | 2 | 2 | _Vlastnost:_ Když tuto základnu poškodí schopnost soupeřova přeživšího, ten přeživší je zraněn (i když je krytý). |
| **Benzínka** `benzinka` | 2 | 2 | **[1💧]** Posuň svou operaci ve frontě o 1 místo vpřed (na volné místo). Z místa 1 se hned vyhodnotí. |
| **Skrýš** `skrys` | 2 | 2 | **[1💧]** Vrať svého nepoškozeného přeživšího (ne tuláka) do ruky. |
| **Elektrárna** `elektrarna` | 0 | 2 | **[1💧]** Lízni kartu. |
| **Kantýna** `kantyna` | 1 | 2 | _Vlastnost:_ První přeživší, kterého v každém tahu zahraješ, stojí o 1 vodu méně. |
| **Střelnice** `strelnice` | 2 | 2 | **[1💧]** Zraň nekrytého tuláka. |

## Speciální karty

| Karta | Popis |
|---|---|
| **Nájezd** | Odpočet 2. Soupeř si vybere jednu svou základnu a ta je poškozena. Pak se Nájezd vrací k tobě. |
| **Cisterna** | Akce: zaplať 1 vodu a vezmi Cisternu do ruky. Rozebráním získáš vodu navíc a Cisterna se vrátí do tvé zóny. |
| **Tulák** | Vrchní karta balíčku lícem dolů. Nemá schopnosti, kryje. Poškozením je zničen a vrací se lícem dolů navrch balíčku. |

## Rozložení efektů rozebrání v balíčku

| Efekt | Počet karet |
|---|---|
| Voda navíc | 16 |
| Zranit | 14 |
| Tulák | 10 |
| Líznout | 14 |
| Nájezd | 10 |
| Opravit | 8 |
