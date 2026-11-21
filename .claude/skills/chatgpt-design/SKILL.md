---
name: chatgpt-design
description: Generuje vizuální identitu a design karet pro karetní hru Poslední kapka (postapo duel o vodu, žánrově „à la Radlands“) přes uživatelův OpenAI/ChatGPT účet – obrázky modelem gpt-image (generování i úpravy podle referencí, dávky celých sad karet), texty a druhý názor přes GPT. Použij vždy, když uživatel chce logo, emblém, wordmark, key art, moodboard, paletu nebo styl, ilustraci karty (přeživší, operace, základny), rámeček nebo layout karty, rub karty, booster, textury či ikony – nebo řekne „vygeneruj/nakresli přes ChatGPT, GPT, OpenAI, DALL-E“, „udělej art pro Pumpaře“, „identita hry ala Radlands“, i když slovo ChatGPT nepadne. Nepoužívej pro úpravy pravidel, enginu nebo CSS bez generování grafiky.
---

# ChatGPT design pro Poslední kapku

Tenhle skill volá OpenAI API uživatelovým klíčem: obrázky přes `gpt-image-*`, texty přes `gpt-*`
(Responses API). Všechno jde přes jeden skript bez závislostí, `scripts/gpt.mjs` vedle tohoto souboru
(v repu: `.claude/skills/chatgpt-design/scripts/gpt.mjs`, Node 20+).

**Ilustrace karet mají ve hře jeden zdroj pravdy** a ten skill nepřepisuje, jen používá:

- `scripts/art/prompts.ts` – styl (`ART_STYLE`) a námět každé karty (`ART[id].subject`, `landscape`).
  Úpravy námětů dělej tam a pak `npx tsx scripts/art/export-prompts.ts`, což obnoví
  `docs/ART-PROMPTS.md` (pro ruční práci v ChatGPT) a `docs/art-prompts.json` (čte ho tenhle skill).
- `scripts/art/import.ts` – převede hotové obrázky do `public/art/<id>.webp` (720×1080, základny
  1080×720) a obnoví manifest `src/client/gen/art.ts`. Karta s obrázkem se pak ve hře sama vykreslí
  jako full-art; bez obrázku zůstane procedurální scéna.

Ostatní (logo, key art, textury, ikony…) a pravidla originality jsou v `references/art-direction.md`.
**Přečti ho před prvním promptem.**

## 1. Ověř připojení

```bash
node .claude/skills/chatgpt-design/scripts/gpt.mjs check
```

Vypíše vybraný obrázkový a textový model. Když selže:

- **Chybí klíč (lokálně):** uživatel potřebuje API klíč z https://platform.openai.com/api-keys.
  Předplatné ChatGPT Plus/Pro API nezahrnuje, API se platí zvlášť podle spotřeby. Klíč patří do
  `OPENAI_API_KEY` (např. v `~/.zshrc`) nebo do souboru `~/.config/openai/api_key` (`chmod 600`).
  Klíč si nikdy nenech vložit do chatu.
- **Cloudová session Claude Code** (síťová chyba nebo proxy 403 pro `api.openai.com`): zavolej
  `request_credential` pro host `api.openai.com` (Bearer). Uživatel klíč zadá do bezpečného formuláře,
  proxy ho pak vkládá do požadavků a host tím povolí; skript klíč v proměnné nepotřebuje.
- **HTTP 403 „organization must be verified“:** modely gpt-image vyžadují ověřenou organizaci
  (platform.openai.com → Settings → Organization → Verify). Bez ní obrázky nepůjdou, text ano.
- **`credit_balance_exhausted` / `insufficient_quota`:** API účet nemá kredit. Předplatné ChatGPT se
  nepočítá; kredit se dobíjí zvlášť na https://platform.openai.com/settings/organization/billing
  (na skici stačí pár dolarů). `check` tohle neodhalí, výpis modelů je zdarma.

**Výběr modelu:** `--model` > `OPENAI_IMAGE_MODEL` / `OPENAI_TEXT_MODEL` > soubor `design/gpt.json`
(`{"imageModel": "…", "textModel": "…"}`) > automaticky nejvyšší verze. Když `check` ukáže víc variant
stejné verze (třeba `gpt-image-2.6-flare` a `gpt-image-2.6-sunburst`), udělej při prvním použití jednu
`low` skicu se stejným promptem s každou, ukaž je uživateli a vybraný model zapiš do `design/gpt.json`
(commitovat). Celá sada karet pak jede jedním modelem, jinak nebude stylově držet pohromadě.

## 2. Pracovní postup

1. **Kontext.** Zjisti, co přesně chce (který výstup, které karty, kolik variant). Podívej se, co už ve hře
   je (`public/art/`, `src/client/gen/art.ts`) a jestli existují `design/anchors/` – schválené kotvy stylu.
2. **Prompt.** U karet použij příkaz `cards` (bere zadání z `docs/art-prompts.json`). U ostatního napiš
   prompt sám podle `references/art-direction.md` se stylem `ART_STYLE`. GPT na texty (`chat`) zapoj,
   když o to uživatel stojí – názvy, slogany, lore, flavor texty, nebo druhý názor na hotový obrázek.
3. **Skici.** `--quality low` nebo `medium`, 2–4 varianty (`--n`). Hotové obrázky si prohlédni nástrojem
   Read (soubory PNG umí zobrazit) a vyřaď zjevné chyby (text v obrázku, rámeček, motiv u okraje)
   dřív, než je ukážeš.
4. **Ukaž uživateli.** Pár obrázků pošli přes `SendUserFile` (`display: "render"`); u větší sady udělej
   galerii (`gallery <složka>` → `index.html`) a pošli tu. Zeptej se, co upravit.
5. **Iteruj.** Vybranou variantu dolaď přes `--ref vybrany.png --fidelity high` a prompt popisující jen změnu.
6. **Zamkni směr.** Když uživatel schválí styl, ulož 1–3 nejlepší obrázky do `design/anchors/` a další
   karty generuj s `--ref` na ně (konzistence celé sady). Změnu stylu samotného prováděj v `ART_STYLE`.
7. **Finály a import.** Schválené kusy přegeneruj v `--quality high`, pak
   `npx tsx scripts/art/import.ts design/drafts/cards/` a zkontroluj kartu ve hře (galerie `#/cards`).

Kolik to stojí: orientačně (ceník gpt-image-1, 2025) čtverec 1024 vyjde na ~0,01 $ low,
~0,04 $ medium, ~0,17 $ high; formát 1024×1536 zhruba 1,5× víc; reference zvyšují vstupní tokeny.
Ceny se mění, skript vypisuje spotřebu tokenů. **Před dávkou nad 10 obrázků nebo před čímkoli
v `high` napiš uživateli počet a odhad ceny a počkej na souhlas** – platí to on. Jednotlivé skici
pouštěj bez ptaní.

## 3. Příkazy

Spouštěj z kořene repa (relativní cesty se berou od aktuální složky). Uložené cesty skript píše na stdout,
po jedné na řádek; ke každému obrázku uloží `.json` s promptem, modelem a parametry.

```bash
# ilustrace karet ze zadání hry (na výšku 2:3, základny na šířku 3:2) → design/drafts/cards/<id>.png
node .claude/skills/chatgpt-design/scripts/gpt.mjs cards --ids pumpar,bara,vodarna --quality low
node .claude/skills/chatgpt-design/scripts/gpt.mjs cards --kind survivor --quality medium --ref design/anchors/style-1.png --dry-run
npx tsx scripts/art/import.ts design/drafts/cards/            # schválené do hry

# jeden obrázek / varianty (bez --out jde do design/drafts/<čas>-<slug>.png)
node .claude/skills/chatgpt-design/scripts/gpt.mjs image \
  --style design/style.txt --prompt "Key art: ..." --size 1536x1024 --quality low --n 3 --out-dir design/drafts/keyart

# úprava nebo „ve stylu“ podle referencí (až 16 obrázků; přepne na images/edits)
node .claude/skills/chatgpt-design/scripts/gpt.mjs image \
  --style design/style.txt --ref design/anchors/style-1.png \
  --prompt "Use the reference only for style... New subject: ..." --out design/drafts/bara.png

# průhledné pozadí (logo, booster, ikona)
node .claude/skills/chatgpt-design/scripts/gpt.mjs image --background transparent --format png --prompt "..."

# dávka celé sady (přeskočí hotové; --only jmeno1,jmeno2 --force přegeneruje vybrané)
node .claude/skills/chatgpt-design/scripts/gpt.mjs batch design/jobs/karty-v1.json --dry-run
node .claude/skills/chatgpt-design/scripts/gpt.mjs batch design/jobs/karty-v1.json --concurrency 2

# galerie k prohlédnutí
node .claude/skills/chatgpt-design/scripts/gpt.mjs gallery design/drafts/karty-v1

# text přes GPT (volitelně s obrázkem k posouzení, --json pro JSON výstup)
node .claude/skills/chatgpt-design/scripts/gpt.mjs chat \
  --system "Jsi art director karetní hry." --prompt "Navrhni 5 sloganů..." --out design/notes/slogany.md
node .claude/skills/chatgpt-design/scripts/gpt.mjs chat --image design/drafts/pumpar.png --prompt "Zhodnoť čitelnost..."

# dostupné modely
node .claude/skills/chatgpt-design/scripts/gpt.mjs models
```

`--style` čte text ze souboru a dá ho před prompt; pro styl hry si ho vytvoř z `docs/art-prompts.json`
(`node -e "console.log(require('./docs/art-prompts.json').style)" > design/style.txt`).
`cards` umí i `--n`, `--extra "…"` (doplněk na konec promptu), `--out-dir`, `--force`, `--concurrency`.

Další volby `image`: `--prompt-file`, `--mask m.png` (průhledná oblast = překreslit), `--compression 0-100`
(webp/jpeg), `--moderation low`, `--model`. `chat`: `--system-file`, `--effort low|medium|high`, `--model`.

Formát dávky (`design/jobs/*.json`); hodnoty z `defaults` platí pro všechny joby, job je může přepsat:

```json
{
  "defaults": {
    "style": "design/style.txt",
    "refs": ["design/anchors/style-1.png"],
    "size": "1536x1024",
    "quality": "medium",
    "outDir": "design/drafts/identity"
  },
  "jobs": [
    { "name": "keyart", "prompt": "Use the reference images only for ... Key art: ..." },
    { "name": "emblem", "prompt": "...", "size": "1024x1024", "background": "transparent" },
    { "name": "booster", "prompt": "...", "size": "1024x1536", "n": 2 }
  ]
}
```

`name` je název souboru. Obrázky pro hru pojmenuj podle id, které zná `scripts/art/prompts.ts`
(karty, `playmat`, `cardback`, `booster`, `tulak`), jinak je import přeskočí. Selhané joby skript vypíše a skončí kódem 2; stejný příkaz znovu spustí jen ty.

## 4. Výstupy

- `design/drafts/` – skici a průzkum (v `.gitignore`, necommitují se).
- `design/anchors/` – schválené kotvy stylu (commitovat), `design/gpt.json` – připnuté modely.
- `public/art/<id>.webp` + `src/client/gen/art.ts` – obrázky ve hře; vznikají **jen** přes
  `scripts/art/import.ts`, ručně je neupravuj.
- `design/identity/` – schválené logo, wordmark, key art mimo hru.
- `design/jobs/` – dávkové soubory, ať jde sada zopakovat.

Obrázky od uživatele (např. vygenerované ručně v ChatGPT) importuj stejným skriptem. Předtím je projdi:
skeny nebo napodobeniny karet jiné hry do hry nepatří (viz Originalita).

## 5. Originalita

Hra je vlastní projekt („vlastní název, karty, texty i grafika“ – README). „À la Radlands“ ber jako žánr:
postapo poušť, šrot, přeživší, souboj o vodu. Do promptů nepiš názvy cizích her, vydavatelů ani žijících
ilustrátorů, nepoužívej cizí artwork jako reference a nekopíruj cizí loga, rozvržení karet ani postavy.
Když uživatel chce přesnou kopii, řekni proč ne a nabídni vlastní variantu se stejnou atmosférou.
Podrobnosti v `references/art-direction.md`, oddíl 1.
