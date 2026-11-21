# Poslední kapka – pravidla

Karetní duel dvou hráčů o vodu a přežití. Hra je samostatný projekt pro kamarády: vlastní karty, vlastní názvy, vlastní grafika.
Pravidla jsou zde popsána tak, jak je implementuje engine (`src/engine/game.ts`). Při rozporu platí engine a testy.

## 1. Cíl
Zničit **všechny 3 soupeřovy základny**. Kdo to dokáže, vyhrává okamžitě – i uprostřed tahu nebo během vyhodnocení efektu.
Když balíček dojde podruhé, hra končí: vyhrává hráč s více stojícími základnami, při shodě ten s menším poškozením základen; teprve pak je remíza.

## 2. Komponenty
| Komponenta | Počet | Poznámka |
|---|---|---|
| Balíček | 72 karet | 24 druhů přeživších + 12 druhů operací, vše 2× |
| Základny | 29 | každá hra použije 2 × 6 náhodných |
| Nájezd | 1 na hráče | speciální operace s odpočtem 2 |
| Cisterna | 1 na hráče | „přenos“ 1 vody do dalšího tahu |
| Voda | 3 za tah | nevyužitá voda propadá |

## 3. Příprava
1. Každý hráč dostane 6 základen a tajně si vybere 3. Pořadí výběru určuje sloupce (levý, prostřední, pravý). Varianta „Náhodné“ přidělí 3 základny bez výběru.
2. Každý si lízne tolik karet, kolik je součet hodnot **zásob** na jeho základnách.
3. Los vybere hráče, který rozhodne, kdo začíná. **Začínající hráč dostane v 1. tahu jen 1 vodu.**

## 4. Hrací plocha hráče
- **3 základny** v řadě. Před každou je **sloupec** pro max. **2 přeživší** (celkem max. 6).
- Přeživší blíž soupeři je **vepředu**, druhý je **vzadu** (u základny).
- **Fronta operací** se 3 místy (1 = vyhodnotí se nejdřív).
- **Zóna**: Nájezd a Cisterna, když nejsou ve hře.

## 5. Tah
1. **Začátek tahu** – vyhodnotí se efekty „na začátku tahu“ v tomto pořadí: výbuch náloží, které hráč položil; uložená voda (Marta, Přehrada); Studna; Starostka Ludmila.
2. **Operace** – je-li na místě 1 operace, vyhodnotí se a odhodí (Nájezd se vrátí do zóny). Poté se všechny operace ve frontě posunou o 1 místo vpřed.
3. **Doplnění** – hráč získá 3 vody (minus případné Sucho) a lízne 1 kartu.
4. **Akce** – libovolně mnohokrát a v libovolném pořadí:
   - **Zahrát přeživšího**: zaplať cenu, postav ho do sloupce (vepředu / vzadu). V tahu příchodu není připravený.
   - **Zahrát operaci**: zaplať cenu a polož ji na místo podle odpočtu; je-li obsazené, na první volné místo za ním (max. místo 3). Pokud volno není, operaci zahrát nelze. Odpočet 0 (⚡) = vyhodnotí se ihned.
   - **Rozebrat kartu**: odhoď kartu z ruky a proveď její efekt rozebrání (zdarma).
   - **Použít schopnost** připravené karty: zaplať cenu; karta je pak do konce tahu nepřipravená.
   - **Líznout kartu** za 2 vody.
   - **Vzít Cisternu** do ruky za 1 vodu (nejvýš jednou za tah). Rozebráním Cisterny získáš 1 vodu navíc a Cisterna se vrátí do zóny.
5. **Konec tahu** – nevyužitá voda propadá.

## 6. Připravenost
- **Přeživší** je připravený, pokud: není poškozený, nebyl zahrán v tomto tahu, nebyl v tomto tahu opraven, v tomto tahu nepoužil schopnost a není omráčený.
- **Základna** je připravená, pokud není zničená a v tomto tahu ještě nepoužila schopnost. Poškozená základna schopnost používat může.
- Tulák nemá schopnosti.

## 7. Krytí, poškození, zničení
- Karta je **nekrytá**, pokud před ní nestojí žádný tvůj přeživší. Základna je krytá, když je v jejím sloupci aspoň 1 přeživší.
- Sloupec **odkrytý Zvědem** je do konce tahu celý nekrytý.
- **Poškodit** (bez dalšího upřesnění) = vyber nekrytou soupeřovu kartu (přeživší nebo nezničenou základnu).
- **Zranit** = poškodit nekrytého soupeřova přeživšího.
- Nepoškozená karta → **poškozená**. Poškozená → **zničená**. Pevnost je zničena až třetím poškozením.
- Zničený přeživší jde do odhazovacího balíčku. Zničený tulák jde lícem dolů navrch balíčku. Zničená základna zůstává ve hře jako zničená (do sloupce lze dál hrát).
- Když je zničen přeživší vzadu, ten vepředu se posune k základně.
- **Opravit** = odstranit 1 poškození z vlastního přeživšího, nebo zneškodnit soupeřovu nálož na vlastní základně. Poškozenou **základnu** opravují jen karty, které to výslovně uvádějí (např. Kovářka Rez, Doktorka Iva, Ruiny nemocnice). Opravený přeživší není v tomto tahu připravený (výjimka: Felčar).
- Útočné efekty nelze použít na vlastní karty.

## 8. Nájezd
- Efekt rozebrání **Nájezd**: je-li Nájezd v zóně, polož ho do fronty na místo 2 (nebo první volné za ním). Je-li už ve frontě, posuň ho o 1 místo vpřed – pokud je místo před ním volné. Z místa 1 se vyhodnotí ihned.
- Vyhodnocení: **soupeř si vybere jednu svou nezničenou základnu** a ta je poškozena (i když je krytá). Nájezd se vrátí do zóny.

## 9. Speciální stavy
| Stav | Vznik | Konec |
|---|---|---|
| Omráčení | Vymahač, Vězení, Písečná bouře | po soupeřově příštím tahu |
| Nálož | Ženistka Hana, Sklad trhavin | vybuchne na začátku tahu toho, kdo ji položil; oprava ji zneškodní |
| Zásoba vody | Skladnice Marta, Přehrada | na začátku majitelova tahu se promění ve vodu |
| Odkrytý sloupec | Zvěd | konec tahu |
| Sucho | operace Sucho | sníží příští doplnění vody |

## 10. Sběratelský režim (vlastní balíčky)
- Každý hráč hraje se svým balíčkem (30–40 karet, max. 2 kopie, legendární 1×) a má vlastní odhazovací balíček.
- Tuláci se berou z vlastního balíčku a po zničení se vrací na jeho vršek. Karty, které „berou z odhazovacího balíčku“ (Sběračka Myška), berou z vlastního.
- Když ti dojde balíček, zamíchá se tvůj odhazovací balíček jako nový. **Žízeň:** každé další zamíchání (od druhého) poškodí tvou nejméně poškozenou základnu. Když nemáš ani odhozené karty, líznutí propadne a základna je poškozena také.
- Za odehrané online hry dostávají registrovaní hráči kapky na nákup boosterů.

## 11. Další pravidla
- Vlastnosti přeživších platí, jen dokud nejsou poškození (výjimka: Pes Rex). Vlastnosti základen platí, dokud nejsou zničené.
- Balíček dojde → odhazovací balíček se zamíchá jako nový (jednou). Dojde podruhé → rozhodne počet stojících základen (pak menší poškození, jinak remíza).
- Ruka nemá limit. Z odhazovacího balíčku je vidět jen vrchní karta.
- **Zpět**: akci lze vrátit, dokud neodhalila skrytou informaci (líznutí, prohlédnutí karet, rozhodnutí soupeře, náhoda). Rozdělanou volbu lze zrušit (Esc).
