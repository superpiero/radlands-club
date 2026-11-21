# Art direction – Poslední kapka

Podklad pro psaní promptů. Prompty pro obrázky piš **anglicky** (gpt-image je tak spolehlivější),
českou kartu popiš vlastními slovy, ne jen jménem.

## Obsah
1. Co znamená „à la Radlands“ (a co ne)
2. Identita hry, ze které vycházíme
3. Startovní style lock
4. Recepty podle typu výstupu (velikosti, pozadí, kvalita)
5. Karty: z dat karty na prompt
6. Konzistence celé sady
7. Časté chyby

---

## 1. „À la Radlands“ = žánr, ne kopie

Uživatel tím myslí **žánr a pocit**: postapo poušť, vynalézaví přeživší, šrot a plachty, humor smíchaný
s drsností, výrazné čitelné ilustrace, hra o přežití a o vodu. To všechno klidně ber.

Nebereme nic, co patří konkrétní hře: název, logo a písmo loga, rozvržení a ikonografii jejích karet,
jejich postavy, tábory a názvy karet, ani její ilustrace. Proto:

- do promptů nepiš „Radlands“, název vydavatele ani jména žijících ilustrátorů – výsledek má být náš vlastní
  a model by jinak tlačil k napodobenině (a některé prompty taky odmítne),
- nepoužívej cizí karty/artwork jako `--ref` – reference jsou jen naše vlastní obrázky,
- když si uživatel vyžádá přesnou kopii („udělej to přesně jako karta X z Radlands“), kopii nedělej
  a nabídni vlastní variantu se stejnou atmosférou. Hra je podle README vlastní projekt
  s vlastním názvem, kartami i grafikou, tohle k tomu sedí.
- žádné jiné IP ani značky (Mad Max, Fallout, Coca-Cola…): na plechovkách a cedulích jen vymyšlené
  nečitelné symboly.

Žánrový slovník, který funguje: *post-apocalyptic desert, scrap-punk, makeshift, salvaged, sun-bleached,
dust haze, tarp and corrugated metal, welded pipes, jerrycans, goggles, bandanas, water tanks, windmills,
cracked earth, heat shimmer, frontier town, caravan, wasteland survivors*.

## 2. Identita hry

- **Název:** Poslední kapka. Duel dvou hráčů o vodu. Voda (💧) je jediná surovina.
- **Typy karet:** přeživší (postavy), operace (události ve frontě s odpočtem), základny (3 na hráče),
  Nájezd, tulák (rub karty), cisterna.
- **Paleta** (z `src/client/styles.css`, „sun-bleached desert, rust & tarp; teal water is the only clean colour“):

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
- **Současný vzhled karet:** papírová karta, tmavý pruh se schopností, procedurální scéna se siluetou
  pustiny a ikonou z game-icons.net. Operace mají tmavě olivový podklad (`#4a4630`) a žlutý název (`#ffd36a`).

Před prací na identitě se podívej, jestli už existuje `design/style-lock.txt` a `design/anchors/`.
Pokud ano, jsou to schválená rozhodnutí – drž se jich, dokud uživatel neřekne jinak.

## 3. Startovní style lock

Když ještě není `design/style-lock.txt`, začni tímhle (ulož do souboru a předávej přes `--style`).
Je to výchozí bod pro průzkum, ne dogma – po schválení směru ho uprav podle toho, co se uživateli líbilo.

```text
Original illustration for a tabletop card game about two rival settlements fighting over the last water in a post-apocalyptic desert.
Hand-painted gouache and ink look: confident brush outlines, chunky readable silhouettes, slightly exaggerated characterful proportions, visible paper grain and a subtle halftone texture.
Sun-bleached palette of sand, bone, rust orange, ember and dark tarp brown. Clean teal (#3fb8c9) is the only cool colour and appears only on water, or as a glint of hope.
Salvaged gear everywhere: tarp, corrugated metal, rope, welded pipes, jerrycans, goggles, patched leather.
Strong value contrast, one clear focal subject, dusty haze in the background.
No text, no letters, no numbers, no logos, no watermark, no card frame or border.
```

Alternativní směry pro průzkum (vyměň druhý a třetí řádek):
- **Linoryt / sítotisk:** `Bold two-colour linocut and screen-print look, rough carved lines, misregistered ink layers.`
- **Komiks:** `Clean graphic-novel inking with flat colour fills and hard cel shadows, dynamic foreshortening.`
- **Malba:** `Painterly concept-art rendering, soft atmospheric perspective, warm rim light at golden hour.`

## 4. Recepty podle typu výstupu

| Výstup | `--size` | další volby | poznámka |
|---|---|---|---|
| Ilustrace přeživšího / operace | `1024x1024` | | okno ilustrace na kartě se ořezává (na stole je skoro na šířku, v kompaktním režimu skoro čtverec) → hlavní motiv do středních ~70 %, nic důležitého u okrajů |
| Ilustrace základny | `1024x1536` | | na kartě základny je ilustrace úzký sloupec vlevo (~0,7 : 1) → budova vertikálně, na střed |
| Celá karta – návrh layoutu / rámečku | `1024x1536` | | jen koncept; skutečné texty kreslí hra v HTML/CSS. Text na kartě popiš jako „placeholder text blocks“ |
| Rub karty | `1024x1536` | | symetrický emblém, bez textu |
| Logo / emblém | `1024x1024` | `--background transparent` | jednoduchý tvar čitelný i v 32 px (favicon) |
| Wordmark „POSLEDNÍ KAPKA“ | `1536x1024` | `--background transparent` | model může pokazit diakritiku – zkontroluj „Í“ a „Á“; finální wordmark je spolehlivější v SVG s písmem Saira Stencil One, GPT verzi ber jako koncept / texturu |
| Key art / titulní obrázek | `1536x1024` | `--quality high` | pro domovskou stránku, obal, OG obrázek |
| Moodboard | `1536x1024` | | „a moodboard collage of …“, 6–9 výřezů |
| Booster balíček | `1024x1536` | `--background transparent` | foliový sáček, vymyšlený emblém, bez textu |
| Textura (rez, plachta, papír) | `1024x1024` | | „seamless tileable texture, flat lighting, top-down“ → pozadí v CSS |
| Ikona stavu / zdroje | `1024x1024` | `--background transparent` | „single flat silhouette icon, one colour, no outline details“; hra už má sadu ikon z game-icons.net, nové ikony jen když o ně uživatel stojí |

Kvalita: `low` na rychlé skici a průzkum, `medium` na výběr a sady, `high` jen na schválené finály.
Pro web (`public/`) je praktičtější `--format webp --compression 85`.

## 5. Karty: z dat karty na prompt

Data karet: `docs/cards.json` (vygenerované z `src/engine/cards.ts`; obsahuje `id`, `name`, `kind`, `cost`,
`abilities[].text`, `trait`, `effectText`, `flavor`, `rarity`, `icon`).

Postup pro jednu kartu:
1. **Kdo/co to je:** z názvu. České tvary prozrazují pohlaví – *Ženistka, Kovářka, Skladnice, Sběračka,
   Starostka, Doktorka, Velitelka, Mechanička, Prospektorka* jsou ženy; *Pumpař, Felčar, Pašerák, Kat,
   Bubeník, Radista…* muži; *Kluk s prakem* je dítě, *Pes Rex* pes.
2. **Co dělá:** ze schopnosti udělej pózu nebo akci (Felčar → ošetřuje zraněného; Radista → u vysílačky;
   Granátník → napřahuje se k hodu). Operace jsou scény/události, ne portréty (Sucho, Písečná bouře, Karavana).
3. **Nálada:** z `flavor` (např. Pumpař – „Každá pumpa vrže jinak. On zná všechny.“ → starý technik,
   ucho přiložené k vrzající pumpě).
4. **Vzácnost:** `rare`/`legendary` smí být dramatičtější (silnější světlo, větší měřítko scény), ale ve stejném stylu.
5. **Pestrost obsazení:** různé věky, postavy, typy a etnicita, ať karty nevypadají jako jedna rodina.

Šablona promptu (za style lock):

```text
Card illustration: <who, age, build, distinctive gear>, <action that matches the ability>, <setting detail>.
Mood: <from the flavour line>. Camera: <waist-up portrait | full figure | wide scene>, subject centred with generous margins.
```

Příklad – Pumpař (`pumpar`, přeživší, 1💧):

```text
Card illustration: a wiry old pump mechanic in patched overalls and welding goggles pushed up on his forehead,
pressing his ear against a squeaking hand pump while a thin stream of teal water trickles into a dented bucket,
corrugated-metal shack and a windmill behind him.
Mood: quiet expertise, he knows every pump by its sound. Camera: waist-up, subject centred with generous margins.
```

## 6. Konzistence celé sady

gpt-image nemá seed, takže konzistenci drží tři věci:

1. **Stejný style lock** pro všechny obrázky (`--style design/style-lock.txt` / `"style"` v dávce).
2. **Kotvy (anchors):** 1–3 schválené obrázky v `design/anchors/` předávané jako `--ref`/`"refs"`. Do promptu
   vždy připiš: `Use the reference images only for rendering style, palette and line quality. Do not copy their subject, pose or composition.`
   Jinak model kopíruje i obsah.
3. **Stejné parametry** (velikost, kvalita) v rámci jedné sady.

Opakující se postava (např. Brokovnice Bára na více obrázcích): nejdřív „character sheet“ (front/side/back view,
neutral background), ten ulož do `design/anchors/characters/` a předávej jako `--ref` s `--fidelity high`.

Úprava existujícího obrázku (změna detailu, ne nový obrázek): `--ref obrazek.png --fidelity high` a prompt
popisuje jen změnu („Keep everything identical, only change …“). Pro úpravu jen části obrázku přidej `--mask`
(PNG stejné velikosti, průhledná oblast = co se má překreslit).

## 7. Časté chyby

- **Text v obrázku:** model rád přidává nápisy a čísla. Style lock to zakazuje; když se objeví, zopakuj zákaz
  na konci promptu. Česká diakritika v obrázku je nespolehlivá.
- **Rámeček v ilustraci:** ilustrace pro okno karty nesmí mít vlastní rámeček ani zaoblené rohy – rámeček kreslí hra.
- **Motiv u okraje:** okno karty ořezává; drž motiv uprostřed.
- **Moc teal barvy:** teal je jen voda. Když je ho v obrázku hodně, karta ztrácí čitelnost (voda = cena, akce).
- **Odmítnutí moderací:** přeformuluj bez krve/zranění detailně, bez skutečných značek a IP. Zranění stačí naznačit (obvaz, záplata).
