---
name: chatgpt-design
description: Generuje vizuální identitu a design karet pro karetní hru Poslední kapka (postapo duel o vodu, žánrově „à la Radlands“) přes uživatelův OpenAI/ChatGPT účet – obrázky modelem gpt-image (generování i úpravy podle referencí, dávky celých sad karet), texty a druhý názor přes GPT. Použij vždy, když uživatel chce logo, emblém, wordmark, key art, moodboard, paletu nebo styl, ilustraci karty (přeživší, operace, základny), rámeček nebo layout karty, rub karty, booster, textury či ikony – nebo řekne „vygeneruj/nakresli přes ChatGPT, GPT, OpenAI, DALL-E“, „udělej art pro Pumpaře“, „identita hry ala Radlands“, i když slovo ChatGPT nepadne. Nepoužívej pro úpravy pravidel, enginu nebo CSS bez generování grafiky.
---

# ChatGPT design pro Poslední kapku

Tenhle skill volá OpenAI API uživatelovým klíčem: obrázky přes `gpt-image-*`, texty přes `gpt-*`
(Responses API). Všechno jde přes jeden skript bez závislostí, `scripts/gpt.mjs` vedle tohoto souboru
(v repu: `.claude/skills/chatgpt-design/scripts/gpt.mjs`, Node 20+). Skript sám vybere nejnovější
dostupný model (lze přebít `--model` nebo `OPENAI_IMAGE_MODEL` / `OPENAI_TEXT_MODEL`).

Prompty a styl jsou v `references/art-direction.md`. **Přečti ho před prvním promptem** – je tam,
co „à la Radlands“ znamená a co ne, paleta a písma hry, velikosti pro jednotlivé typy karet,
startovní style lock a jak udržet sadu konzistentní.

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
- **insufficient_quota:** dobít kredit v Billing.

## 2. Pracovní postup

1. **Kontext.** Zjisti, co přesně chce (který výstup, které karty, kolik variant). U karet si vytáhni data
   z `docs/cards.json`. Podívej se, jestli existuje `design/style-lock.txt` a `design/anchors/` – pokud ano,
   jsou to schválená rozhodnutí, drž se jich.
2. **Prompt.** Napiš ho sám podle `references/art-direction.md` (znáš repo a pravidla lépe než GPT).
   GPT na texty (`chat`) zapoj, když o to uživatel stojí – názvy, slogany, lore, flavor texty, nebo
   druhý názor na hotový obrázek.
3. **Skici.** `--quality low` nebo `medium`, 2–4 varianty (`--n`). Hotové obrázky si prohlédni nástrojem
   Read (soubory PNG umí zobrazit) a vyřaď zjevné chyby (text v obrázku, rámeček, motiv u okraje)
   dřív, než je ukážeš.
4. **Ukaž uživateli.** Pár obrázků pošli přes `SendUserFile` (`display: "render"`); u větší sady udělej
   galerii (`gallery <složka>` → `index.html`) a pošli tu. Zeptej se, co upravit.
5. **Iteruj.** Vybranou variantu dolaď přes `--ref vybrany.png --fidelity high` a prompt popisující jen změnu.
6. **Zamkni směr.** Když uživatel schválí styl, ulož style lock do `design/style-lock.txt` a 1–3 nejlepší
   obrázky do `design/anchors/`. Všechny další obrázky pak jedou s `--style` a `--ref` na kotvy.
7. **Finály.** Schválené kusy přegeneruj v `--quality high` a ulož mimo drafty (viz Výstupy).

Kolik to stojí: orientačně (ceník gpt-image-1, 2025) čtverec 1024 vyjde na ~0,01 $ low,
~0,04 $ medium, ~0,17 $ high; formát 1024×1536 zhruba 1,5× víc; reference zvyšují vstupní tokeny.
Ceny se mění, skript vypisuje spotřebu tokenů. **Před dávkou nad 10 obrázků nebo před čímkoli
v `high` napiš uživateli počet a odhad ceny a počkej na souhlas** – platí to on. Jednotlivé skici
pouštěj bez ptaní.

## 3. Příkazy

Spouštěj z kořene repa (relativní cesty se berou od aktuální složky). Uložené cesty skript píše na stdout,
po jedné na řádek; ke každému obrázku uloží `.json` s promptem, modelem a parametry.

```bash
# jeden obrázek / varianty (bez --out jde do design/drafts/<čas>-<slug>.png)
node .claude/skills/chatgpt-design/scripts/gpt.mjs image \
  --style design/style-lock.txt --prompt "Card illustration: ..." \
  --size 1024x1024 --quality low --n 3 --out-dir design/drafts/pumpar

# úprava nebo „ve stylu“ podle referencí (až 16 obrázků; přepne na images/edits)
node .claude/skills/chatgpt-design/scripts/gpt.mjs image \
  --style design/style-lock.txt --ref design/anchors/style-1.png \
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

Další volby `image`: `--prompt-file`, `--mask m.png` (průhledná oblast = překreslit), `--compression 0-100`
(webp/jpeg), `--moderation low`, `--model`. `chat`: `--system-file`, `--effort low|medium|high`, `--model`.

Formát dávky (`design/jobs/*.json`); hodnoty z `defaults` platí pro všechny joby, job je může přepsat:

```json
{
  "defaults": {
    "style": "design/style-lock.txt",
    "refs": ["design/anchors/style-1.png"],
    "size": "1024x1024",
    "quality": "medium",
    "outDir": "design/drafts/karty-v1"
  },
  "jobs": [
    { "name": "pumpar", "prompt": "Use the reference images only for ... Card illustration: ..." },
    { "name": "vodarna", "prompt": "...", "size": "1024x1536" },
    { "name": "sucho", "prompt": "...", "n": 2 }
  ]
}
```

`name` je název souboru – u karet použij `id` karty z `docs/cards.json`, ať se dá art později spárovat
s kartou. Selhané joby skript vypíše a skončí kódem 2; stejný příkaz znovu spustí jen ty.

## 4. Výstupy

- `design/drafts/` – skici a průzkum (v `.gitignore`, necommitují se).
- `design/style-lock.txt`, `design/anchors/` – schválený styl a kotvy (commitovat).
- `design/identity/` – schválené logo, wordmark, key art, paleta, booster, rub.
- `design/cards/<id>.webp` – schválené ilustrace karet.
- `design/jobs/` – dávkové soubory, ať jde sada zopakovat.

Do hry (`public/`, `src/client/…`) obrázky zapojuj, jen když o to uživatel požádá – je to samostatná
změna kódu karet (`Card.tsx` dnes kreslí procedurální scény).

## 5. Originalita

Hra je vlastní projekt („vlastní název, karty, texty i grafika“ – README). „À la Radlands“ ber jako žánr:
postapo poušť, šrot, přeživší, souboj o vodu. Do promptů nepiš názvy cizích her, vydavatelů ani žijících
ilustrátorů, nepoužívej cizí artwork jako reference a nekopíruj cizí loga, rozvržení karet ani postavy.
Když uživatel chce přesnou kopii, řekni proč ne a nabídni vlastní variantu se stejnou atmosférou.
Podrobnosti v `references/art-direction.md`, oddíl 1.
