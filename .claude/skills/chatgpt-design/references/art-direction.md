# Art direction – Poslední kapka

Podklad pro psaní promptů. Prompty pro obrázky piš **anglicky** (gpt-image je tak spolehlivější),
českou kartu popiš vlastními slovy, ne jen jménem.

## Obsah
1. Co znamená „à la Radlands“ (a co ne)
2. Identita hry, ze které vycházíme
3. Styl: `ART_STYLE`
4. Recepty podle typu výstupu (velikosti, pozadí, kvalita)
5. Náměty karet: jak je psát a měnit
6. Konzistence celé sady
7. Časté chyby

---

## 1. „À la Radlands“ = žánr, ne kopie

Uživatel tím myslí **žánr a pocit**: postapo poušť, vynalézaví přeživší, šrot a plachty, humor smíchaný
s drsností, výrazné čitelné ilustrace, hra o přežití a o vodu. To všechno klidně ber.

Nebereme nic, co patří konkrétní hře: název, logo a písmo loga, rozvržení a ikonografii jejích karet,
rub karet, hrací plochu, jejich postavy, tábory a názvy karet, ani její ilustrace. Proto:

- do promptů nepiš „Radlands“, název vydavatele ani jména žijících ilustrátorů – výsledek má být náš vlastní
  a model by jinak tlačil k napodobenině (a některé prompty taky odmítne),
- nepoužívej cizí karty/artwork jako `--ref` – reference jsou jen naše vlastní obrázky,
- obrázky, které uživatel nahraje, před importem projdi: skeny, fotky nebo napodobeniny karet jiné hry
  do hry neimportuj a řekni proč,
- když si uživatel vyžádá přesnou kopii („udělej to přesně jako karta X z Radlands“), kopii nedělej
  a nabídni vlastní variantu se stejnou atmosférou. Hra je podle README vlastní projekt
  s vlastním názvem, kartami i grafikou.
- žádné jiné IP ani značky (Mad Max, Fallout, Coca-Cola…): na plechovkách a cedulích jen vymyšlené
  nečitelné symboly.

Žánrový slovník, který funguje: *post-apocalyptic desert, scrap-punk, makeshift, salvaged, sun-bleached,
dust haze, tarp and corrugated metal, welded pipes, jerrycans, goggles, bandanas, water tanks, windmills,
cracked earth, heat shimmer, frontier town, caravan, wasteland survivors*.

## 2. Identita hry

- **Název:** Poslední kapka. Duel dvou hráčů o vodu. Voda (kapka) je jediná surovina.
- **Typy karet:** přeživší (postavy), operace (události ve frontě s odpočtem), základny (3 na hráče),
  Nájezd, tulák (rub karty), cisterna.
- **Paleta** (`src/client/styles.css` a `src/client/design.css`): spálená poušť, rez a plachty;
  tyrkysová je **jediná čistá barva a patří vodě**.

  | token | hex | použití |
  |---|---|---|
  | bg | `#17120e` | noc, stíny |
  | tarp | `#2a221b` | plachty, tmavé plochy |
  | sand | `#e8d5b0` | písek, světlo |
  | paper | `#efe3c8` | papír karet |
  | rust | `#b5532a` | rez, nebezpečí |
  | ember | `#e8742f` | oheň, akce |
  | gold | `#e9b949` | vzácnost, slunce |
  | water | `#3fb8c9` | **jen voda a naděje** |
  | water-deep | `#1f7686` | stín vody, ikona ceny |

- **Písma:** Saira Stencil One (názvy, šablonové písmo), Barlow Condensed (UI), Special Elite (psací stroj, flavor text).
- **Karta ve hře:** s obrázkem se kreslí jako full-art (ilustrace přes celou kartu, nahoře štítek s názvem
  a cenou, dole tmavý panel se schopností). Bez obrázku má procedurální scénu v kurátorovaných paletách
  (`PALETTES` v `src/client/components/Card.tsx`). Menu mají procedurální panorama (`Backdrop.tsx`).

## 3. Styl: `ART_STYLE`

Styl všech ilustrací je jeden a žije v `scripts/art/prompts.ts` jako `ART_STYLE` (exportuje se i do
`docs/art-prompts.json` → pole `style`). Příkaz `cards` ho přidává sám. Pro jiné výstupy (key art,
textury, booster…) si ho ulož do souboru a předej přes `--style`:

```bash
node -e "console.log(require('./docs/art-prompts.json').style)" > design/style.txt
```

Ve zkratce: *painterly digital illustration, sun-bleached Central European wasteland after the rivers dried up,
ochre / rust / sand / tarp browns, teal only for water, golden-hour rim light, strong silhouette, dust,
film grain, subject centred, no text / frames / borders.*

Když chce uživatel styl změnit, změň `ART_STYLE`, přegeneruj export (`npx tsx scripts/art/export-prompts.ts`)
a ukaž mu pár skic dřív, než se pustíš do celé sady – existující obrázky by jinak stylově nesedly.

## 4. Recepty podle typu výstupu

| Výstup | `--size` | další volby | poznámka |
|---|---|---|---|
| Přeživší, operace, Nájezd, cisterna, tulák | `1024x1536` | (příkaz `cards`) | full-art na výšku 2:3; import ořízne na 720×1080 „podle pozornosti“; motiv na střed, nahoře místo pro štítek s názvem, dole pro text |
| Základna | `1536x1024` | (příkaz `cards`) | na šířku 3:2; vlevo motiv, vpravo klidnější plocha pod text |
| Hrací plocha `playmat` | `1536x1024` | `--quality high` | velmi nízký kontrast, ať jsou karty čitelné; import → 1920×1080 |
| Rub karty `cardback` | `1024x1536` | | symetrický emblém, bez textu |
| Booster `booster` | `1024x1536` | | foliový sáček s emblémem kapky, bez textu |
| Logo / emblém | `1024x1024` | `--background transparent` | jednoduchý tvar čitelný i v 32 px (favicon) |
| Wordmark „POSLEDNÍ KAPKA“ | `1536x1024` | `--background transparent` | model může pokazit diakritiku – zkontroluj „Í“; finální wordmark je spolehlivější v SVG s písmem Saira Stencil One |
| Key art / titulní obrázek | `1536x1024` | `--quality high` | domovská stránka, OG obrázek, obal |
| Textura (rez, plachta, papír) | `1024x1024` | | „seamless tileable texture, flat lighting, top-down“ → pozadí v CSS |
| Ikona | `1024x1024` | `--background transparent` | hra má sadu ikon z game-icons.net; nové jen když o ně uživatel stojí |

Kvalita: `low` na rychlé skici a průzkum, `medium` na výběr a sady, `high` jen na schválené finály.

## 5. Náměty karet: jak je psát a měnit

Náměty jsou v `scripts/art/prompts.ts` (`ART[id].subject`). Když se uživateli ilustrace nelíbí kvůli obsahu,
oprav námět tam (ne jen v jednorázovém promptu), přegeneruj export a pak kartu znovu vygeneruj
(`cards --ids <id> --force`). Tak zůstane zadání a obrázek v souladu.

Při psaní námětu:
1. **Kdo/co to je:** z názvu. České tvary prozrazují pohlaví – *Ženistka, Kovářka, Skladnice, Sběračka,
   Starostka, Doktorka, Velitelka, Mechanička, Prospektorka* jsou ženy; *Pumpař, Felčar, Pašerák, Kat,
   Bubeník, Radista…* muži; *Kluk s prakem* je dítě, *Pes Rex* pes.
2. **Co dělá:** ze schopnosti (`docs/cards.json`) udělej pózu nebo akci. Operace jsou scény/události, ne portréty.
3. **Nálada:** z `flavor`.
4. **Vzácnost:** `rare`/`legendary` smí být dramatičtější, ale ve stejném stylu.
5. **Pestrost obsazení:** různé věky, postavy a typy, ať karty nevypadají jako jedna rodina.

## 6. Konzistence celé sady

gpt-image nemá seed, takže konzistenci drží:

1. **Stejný styl** (`ART_STYLE`, příkaz `cards` ho přidá sám).
2. **Kotvy:** 1–3 schválené obrázky v `design/anchors/` předávané jako `--ref`. Příkaz `cards` k nim sám
   připíše „use the reference images only for style… do not copy their subject“; u `image` to dopiš ručně.
3. **Stejný model a parametry** (model připnutý v `design/gpt.json`, stejná kvalita v rámci sady).

Opakující se postava (např. Brokovnice Bára na více obrázcích): nejdřív „character sheet“ (front/side/back,
neutral background), ten ulož do `design/anchors/characters/` a předávej jako `--ref` s `--fidelity high`.

Úprava existujícího obrázku: `--ref obrazek.png --fidelity high` a prompt popisující jen změnu
(„Keep everything identical, only change …“). Pro úpravu jen části přidej `--mask` (PNG stejné velikosti,
průhledná oblast = co se má překreslit).

## 7. Časté chyby

- **Text v obrázku:** model rád přidává nápisy a čísla. `ART_STYLE` to zakazuje; když se objeví, přidej
  `--extra "Absolutely no text or letters anywhere."` a vygeneruj znovu.
- **Rámeček v ilustraci:** rámeček i štítky kreslí hra, ilustrace je full-bleed bez okrajů.
- **Motiv u okraje nebo v místě textu:** import ořezává a dole je panel se schopností – drž motiv uprostřed.
- **Moc tyrkysové:** tyrkys je jen voda. Když je ho v obrázku hodně, karta ztrácí čitelnost (voda = cena, akce).
- **Odmítnutí moderací:** přeformuluj bez detailní krve/zranění a bez skutečných značek a IP.
