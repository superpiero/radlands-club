// Card database for "Poslední kapka".
// All card names, abilities, texts and flavour are original to this project.
// Each definition is both data (for UI / docs) and script (for the engine).

import type { Game, Gen } from './game';
import type { CardKind, JunkKind, PlayerIdx } from './types';

export interface Ctx {
  /** Player using the card. */
  p: PlayerIdx;
  /** uid of the source card (person / base / event instance). */
  uid: string;
}

export interface AbilityDef {
  cost: number;
  text: string;
  /** Extra precondition (targets available, positional requirement...). */
  canUse?: (g: Game, ctx: Ctx) => boolean;
  /** Human readable reason shown when canUse fails (string or computed). */
  needs?: string | ((g: Game, ctx: Ctx) => string);
  run: (g: Game, ctx: Ctx) => Gen;
}

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  /** Water cost to play (survivors / operations). */
  cost?: number;
  junk?: JunkKind;
  /** Operation countdown (0 = instant). Raid = 2. */
  countdown?: number;
  /** Base: cards drawn at setup. */
  draw?: number;
  /** Base: damage needed to destroy (default 2: damaged -> destroyed). */
  hp?: number;
  abilities: AbilityDef[];
  /** Always-on rule text (shown in brackets on the card). */
  trait?: string;
  /** Operation effect text. */
  effectText?: string;
  resolve?: (g: Game, ctx: Ctx) => Gen;
  canPlay?: (g: Game, ctx: Ctx) => boolean;
  playNeeds?: string;
  flavor: string;
  /** game-icons.net icon name (see scripts/build-icons.ts). */
  icon: string;
  /** Hue used for the card art background. */
  hue: number;
  copies: number;
  /** Collectible rarity (collection mode). */
  rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
  /** false = never in boosters/decks (special cards). */
  collectible?: boolean;
  /** Short tags for the card browser / bot. */
  tags?: string[];
}

const S = (d: Omit<CardDef, 'kind' | 'copies'> & { copies?: number }): CardDef => ({ kind: 'survivor', copies: 2, ...d });
const O = (d: Omit<CardDef, 'kind' | 'copies' | 'abilities'> & { copies?: number }): CardDef => ({ kind: 'operation', copies: 2, abilities: [], ...d });
const B = (d: Omit<CardDef, 'kind' | 'copies'>): CardDef => ({ kind: 'base', copies: 1, ...d });

// ---------------------------------------------------------------------------
// SURVIVORS (přeživší) – 24 designs × 2 copies
// ---------------------------------------------------------------------------
export const SURVIVORS: CardDef[] = [
  S({
    id: 'pumpar', name: 'Pumpař', cost: 1, junk: 'water', icon: 'water-tower', hue: 195,
    flavor: 'Každá pumpa vrže jinak. On zná všechny.',
    abilities: [{
      cost: 1, text: 'Lízni kartu. Pokud pak máš v ruce nejvýš 1 kartu, lízni další.',
      *run(g, c) { g.draw(c.p, 1); if (g.handSize(c.p) <= 1) g.draw(c.p, 1); },
    }],
    tags: ['economy'],
  }),
  S({
    id: 'bara', name: 'Brokovnice Bára', cost: 2, junk: 'injure', icon: 'shotgun', hue: 14,
    flavor: '„Dvě rány. Víc jich nikdy nepotřebuju.“',
    abilities: [{
      cost: 2, text: 'Poškoď. Pokud tím zničíš přeživšího, lízni kartu.',
      canUse: (g, c) => g.hasDamageTarget(c.p, 'damage'),
      *run(g, c) {
        const r = yield* g.damageChoose(c, { kind: 'damage' });
        if (r && r.destroyedPerson) g.draw(c.p, 1);
      },
    }],
    tags: ['attack'],
  }),
  S({
    id: 'prak', name: 'Kluk s prakem', cost: 1, junk: 'drifter', icon: 'slingshot', hue: 40,
    flavor: 'Malý, rychlý a vždycky v první řadě.',
    abilities: [{
      cost: 1, text: 'Zraň. Lze použít, jen když tato karta stojí nekrytá.',
      needs: (g, c) => (g.isUnprotected(c.uid) ? 'Soupeř nemá nekrytého přeživšího, kterého by šlo zranit.' : 'Musí stát nekrytý (vepředu).'),
      canUse: (g, c) => g.isUnprotected(c.uid) && g.hasDamageTarget(c.p, 'injure'),
      *run(g, c) { yield* g.damageChoose(c, { kind: 'injure' }); },
    }],
    tags: ['attack'],
  }),
  S({
    id: 'zved', name: 'Zvěd', cost: 1, junk: 'draw', icon: 'binoculars', hue: 90,
    flavor: 'Vidí díru v každé obraně.',
    abilities: [{
      cost: 1, text: 'Vyber soupeřův sloupec. Do konce tahu jsou všechny karty v něm nekryté.',
      canUse: (g, c) => g.exposableColumns(c.p).length > 0,
      *run(g, c) { yield* g.exposeColumnChoose(c); },
    }],
    tags: ['support'],
  }),
  S({
    id: 'hana', name: 'Ženistka Hana', cost: 2, junk: 'raid', icon: 'dynamite', hue: 0,
    flavor: 'Tiká to. Vždycky to tiká.',
    abilities: [{
      cost: 1, text: 'Polož nálož na nekrytou soupeřovu základnu (bez nálože). Na začátku tvého příštího tahu vybuchne a základnu poškodí, i když bude krytá.',
      canUse: (g, c) => g.chargeTargets(c.p).length > 0,
      *run(g, c) { yield* g.placeChargeChoose(c); },
    }],
    tags: ['attack', 'base'],
  }),
  S({
    id: 'felcar', name: 'Felčar', cost: 1, junk: 'restore', icon: 'medical-pack', hue: 140,
    flavor: 'Šije nití z padáků. Drží to.',
    abilities: [{
      cost: 1, text: 'Oprav svého poškozeného přeživšího (nebo zneškodni nálož). Opravený přeživší zůstává připravený.',
      canUse: (g, c) => g.restoreTargets(c.p, { peopleOnly: true }).length > 0,
      needs: 'Nemáš poškozeného přeživšího ani nálož k zneškodnění.',
      *run(g, c) { yield* g.restoreChoose(c, { keepReady: true, peopleOnly: true }); },
    }],
    tags: ['support'],
  }),
  S({
    id: 'rez', name: 'Kovářka Rez', cost: 2, junk: 'restore', icon: 'anvil-impact', hue: 25,
    flavor: 'Svařuje zdi z kapot aut.',
    abilities: [{
      cost: 2, text: 'Oprav svou poškozenou základnu (nebo zneškodni nálož).',
      canUse: (g, c) => g.restoreTargets(c.p, { basesOnly: true }).length > 0,
      *run(g, c) { yield* g.restoreChoose(c, { basesOnly: true }); },
    }],
    tags: ['support', 'base'],
  }),
  S({
    id: 'paserak', name: 'Pašerák', cost: 1, junk: 'water', icon: 'swap-bag', hue: 270,
    flavor: 'Nic nemá, všechno sežene.',
    abilities: [{
      cost: 1, text: 'Prohlédni si vrchní 2 karty balíčku. Jednu si vezmi do ruky, druhou dej dospod balíčku.',
      *run(g, c) { yield* g.smuggle(c); },
    }],
    tags: ['economy'],
  }),
  S({
    id: 'naborar', name: 'Náborář', cost: 1, junk: 'drifter', icon: 'megaphone', hue: 300,
    flavor: '„Jídlo, voda, střecha. Podepiš tady.“',
    abilities: [{
      cost: 1, text: 'Naverbuj tuláka. Lze použít, jen když máš ve hře méně přeživších než soupeř.',
      needs: (g, c) => (g.peopleCount(c.p) < g.peopleCount(g.opp(c.p)) ? 'Nemáš volné místo pro tuláka.' : 'Musíš mít méně přeživších než soupeř.'),
      canUse: (g, c) => g.peopleCount(c.p) < g.peopleCount(g.opp(c.p)) && g.hasFreeSlot(c.p),
      *run(g, c) { yield* g.gainDrifter(c.p); },
    }],
    tags: ['people'],
  }),
  S({
    id: 'vymahac', name: 'Vymahač', cost: 2, junk: 'injure', icon: 'brass-knuckles', hue: 340,
    flavor: 'Dluhy se v pustině platí hned.',
    abilities: [{
      cost: 1, text: 'Omrač nekrytého nepřítele: během soupeřova příštího tahu nebude připravený.',
      canUse: (g, c) => g.stunTargets(c.p).length > 0,
      *run(g, c) { yield* g.stunChoose(c); },
    }],
    tags: ['control'],
  }),
  S({
    id: 'hlidkar', name: 'Hlídkař', cost: 2, junk: 'draw', icon: 'sentry-gun', hue: 60,
    flavor: 'Nespí. Nikdy.',
    abilities: [],
    trait: 'Jednou za tah: když soupeř poškodí nebo zraní jinou tvou kartu v tomto sloupci, můžeš zranit nekrytého nepřítele.',
    tags: ['defense'],
  }),
  S({
    id: 'marta', name: 'Skladnice Marta', cost: 2, junk: 'water', icon: 'barrel', hue: 205,
    flavor: 'Co dneska ušetříš, zítra vypiješ.',
    abilities: [{
      cost: 1, text: 'Tato voda zůstane na Martě jako zásoba. Na začátku tvého příštího tahu získáš 2 vody navíc (pokud je Marta stále ve hře).',
      canUse: (g, c) => (g.findPerson(c.uid)?.person.stash ?? 0) === 0,
      *run(g, c) { g.setStash(c.uid); },
    }],
    tags: ['economy'],
  }),
  S({
    id: 'bedrich', name: 'Bedřich Pancéř', cost: 2, junk: 'restore', icon: 'shield-bash', hue: 220,
    flavor: 'Chodící barikáda s dobrým srdcem.',
    trait: 'Zranění na Bedřicha nepůsobí (lze ho jen poškodit nebo zničit).',
    abilities: [{
      cost: 1, text: 'Přesuň Bedřicha do jiného sloupce s volným místem, na přední pozici.',
      canUse: (g, c) => g.bedrichMoves(c).length > 0,
      *run(g, c) { yield* g.bedrichMove(c); },
    }],
    tags: ['defense'],
  }),
  S({
    id: 'rex', name: 'Pes Rex', cost: 1, junk: 'drifter', icon: 'sniffing-dog', hue: 30,
    flavor: 'Hodný pes. Většinou.',
    trait: 'I když je poškozený: když je Rex zničen, naverbuj tuláka.',
    abilities: [],
    tags: ['people', 'defense'],
  }),
  S({
    id: 'jiskra', name: 'Mechanička Jiskra', cost: 2, junk: 'water', icon: 'auto-repair', hue: 50,
    flavor: 'Rozebere generátor poslepu. Složí ho dvakrát rychleji.',
    abilities: [{
      cost: 1, text: 'Vyber svou základnu, jejíž schopnost jsi v tomto tahu už použil. Je znovu připravená.',
      canUse: (g, c) => g.usedBases(c.p).length > 0,
      *run(g, c) { yield* g.rereadyBaseChoose(c); },
    }],
    tags: ['economy', 'base'],
  }),
  S({
    id: 'granatnik', name: 'Granátník', cost: 3, junk: 'injure', icon: 'grenade', hue: 100,
    flavor: 'Pojistka ven, starosti pryč.',
    abilities: [{
      cost: 2, text: 'Poškoď. Pokud tím zničíš přeživšího a v jeho sloupci stojí další přeživší, zraň i toho.',
      canUse: (g, c) => g.hasDamageTarget(c.p, 'damage'),
      *run(g, c) {
        const r = yield* g.damageChoose(c, { kind: 'damage' });
        if (r && r.destroyedPerson && r.col !== undefined) yield* g.injureFrontOfColumn(c, r.owner, r.col);
      },
    }],
    tags: ['attack'],
  }),
  S({
    id: 'bubenik', name: 'Bubeník', cost: 2, junk: 'draw', icon: 'drum', hue: 320,
    flavor: 'Rytmus, který zvedá mrtvé z postele.',
    abilities: [{
      cost: 1, text: 'Jiný tvůj nepoškozený přeživší, který v tomto tahu použil schopnost, je znovu připravený.',
      canUse: (g, c) => g.usedPeople(c.p, c.uid).length > 0,
      *run(g, c) { yield* g.rereadyPersonChoose(c); },
    }],
    tags: ['support'],
  }),
  S({
    id: 'myska', name: 'Sběračka Myška', cost: 2, junk: 'drifter', icon: 'hand-bag', hue: 280,
    flavor: 'Co jiní zahodí, ona zvedne.',
    abilities: [{
      cost: 2, text: 'Vezmi si do ruky vrchní kartu odhazovacího balíčku.',
      canUse: (g, c) => g.discardOf(c.p).length > 0,
      needs: 'Odhazovací balíček je prázdný.',
      *run(g, c) { g.takeTopDiscard(c.p); },
    }],
    tags: ['economy'],
  }),
  S({
    id: 'radista', name: 'Radista', cost: 1, junk: 'raid', icon: 'radio-tower', hue: 180,
    flavor: '„Tady Kapka, příjem.“',
    abilities: [{
      cost: 1, text: 'Posuň svou operaci ve frontě o 1 místo vpřed (na volné místo). Z místa 1 se operace hned vyhodnotí.',
      canUse: (g, c) => g.advanceableEvents(c.p).length > 0,
      *run(g, c) { yield* g.advanceEventChoose(c); },
    }],
    tags: ['events'],
  }),
  S({
    id: 'lasar', name: 'Lasař', cost: 2, junk: 'raid', icon: 'lasso', hue: 10,
    flavor: 'Kdo se schovává vzadu, toho vytáhne dopředu.',
    abilities: [{
      cost: 1, text: 'Vyber soupeřův sloupec se dvěma přeživšími a prohoď jejich pořadí.',
      canUse: (g, c) => g.swappableEnemyColumns(c.p).length > 0,
      *run(g, c) { yield* g.lassoChoose(c); },
    }],
    tags: ['control'],
  }),
  S({
    id: 'ludmila', name: 'Starostka Ludmila', cost: 2, junk: 'draw', icon: 'scroll-quill', hue: 240,
    flavor: 'Pamatuje si každého, kdo dluží vodu.',
    trait: 'Na začátku tvého tahu: pokud nemáš ve frontě žádnou operaci, lízni kartu.',
    abilities: [],
    tags: ['economy'],
  }),
  S({
    id: 'prospektorka', name: 'Prospektorka', cost: 1, junk: 'water', icon: 'mining', hue: 70,
    flavor: 'Kope tam, kde ostatní jen plivou.',
    abilities: [{
      cost: 2, text: 'Lízni 2 karty, pak 1 kartu z ruky odhoď.',
      *run(g, c) { g.draw(c.p, 2); yield* g.discardChoose(c.p, 1, 'Prospektorka: odhoď 1 kartu z ruky'); },
    }],
    tags: ['economy'],
  }),
  S({
    id: 'minometcik', name: 'Minometčík', cost: 3, junk: 'raid', icon: 'mortar', hue: 110,
    flavor: 'Za zeď? Za zeď je to nejlepší.',
    abilities: [{
      cost: 2, text: 'Zraň krytého přeživšího, který stojí vzadu v soupeřově sloupci.',
      canUse: (g, c) => g.backlineTargets(c.p).length > 0,
      *run(g, c) { yield* g.mortarChoose(c); },
    }],
    tags: ['attack'],
  }),
  S({
    id: 'kat', name: 'Kat', cost: 3, junk: 'injure', icon: 'executioner-hood', hue: 355,
    flavor: 'Dokončí, co jiní začali.',
    abilities: [{
      cost: 2, text: 'Znič poškozeného nepřítele (i krytého).',
      canUse: (g, c) => g.damagedEnemies(c.p).length > 0,
      *run(g, c) { yield* g.executeChoose(c); },
    }],
    tags: ['attack'],
  }),
];

// ---------------------------------------------------------------------------
// OPERATIONS (operace / události) – 12 designs × 2 copies
// ---------------------------------------------------------------------------
export const OPERATIONS: CardDef[] = [
  O({
    id: 'sucho', name: 'Sucho', cost: 2, countdown: 1, junk: 'water', icon: 'desert', hue: 35,
    effectText: 'Soupeř získá ve svém příštím tahu o 1 vodu méně.',
    flavor: 'Řeka zmizela přes noc.',
    *resolve(g, c) { g.applyDrought(g.opp(c.p)); },
  }),
  O({
    id: 'karavana', name: 'Karavana', cost: 1, countdown: 2, junk: 'draw', icon: 'caravan', hue: 45,
    effectText: 'Lízni 3 karty.',
    flavor: 'Velbloudi nejsou. Ale vozíky ano.',
    *resolve(g, c) { g.draw(c.p, 3); },
  }),
  O({
    id: 'delostrelectvo', name: 'Dělostřelectvo', cost: 2, countdown: 2, junk: 'injure', icon: 'cannon-shot', hue: 15,
    effectText: 'Dvakrát poškoď (můžeš i stejnou kartu).',
    flavor: 'Nejdřív hrom, pak ticho.',
    *resolve(g, c) {
      yield* g.damageChoose(c, { kind: 'damage', title: 'Dělostřelectvo: 1. zásah' });
      yield* g.damageChoose(c, { kind: 'damage', title: 'Dělostřelectvo: 2. zásah' });
    },
  }),
  O({
    id: 'sanitka', name: 'Sanitka', cost: 2, countdown: 2, junk: 'restore', icon: 'ambulance', hue: 130,
    effectText: 'Oprav všechny své poškozené karty (přeživší i základny) a zneškodni nálože na svých základnách.',
    flavor: 'Siréna nefunguje, ale houká řidič.',
    *resolve(g, c) { g.restoreAll(c.p); },
  }),
  O({
    id: 'boure', name: 'Písečná bouře', cost: 2, countdown: 2, junk: 'draw', icon: 'sandstorm', hue: 30,
    effectText: 'Omrač všechny soupeřovy přeživší (během jeho příštího tahu nebudou připravení).',
    flavor: 'Písek v očích, písek v hlavních.',
    *resolve(g, c) { g.stunAll(g.opp(c.p)); },
  }),
  O({
    id: 'sabotaz', name: 'Sabotáž', cost: 1, countdown: 0, junk: 'raid', icon: 'cut-palm', hue: 330,
    effectText: 'Odstraň jednu soupeřovu operaci z jeho fronty. (Nájezd se mu vrátí, jiné operace odhoď.)',
    flavor: 'Přestřižený drát, ztracená zpráva.',
    canPlay: (g, c) => g.opponentEvents(c.p).length > 0,
    playNeeds: 'Soupeř nemá žádnou operaci ve frontě.',
    *resolve(g, c) { yield* g.sabotageChoose(c); },
  }),
  O({
    id: 'podkop', name: 'Podkop', cost: 1, countdown: 3, junk: 'injure', icon: 'mine-wagon', hue: 25,
    effectText: 'Poškoď libovolnou soupeřovu základnu (i krytou).',
    flavor: 'Kopali tři noci. Stálo to za to.',
    *resolve(g, c) { yield* g.damageBaseAnyChoose(c, 'Podkop: vyber soupeřovu základnu'); },
  }),
  O({
    id: 'pramen', name: 'Skrytý pramen', cost: 0, countdown: 3, junk: 'water', icon: 'water-drop', hue: 200,
    effectText: 'Získej 3 vody navíc.',
    flavor: 'Hluboko pod pískem pořád teče.',
    *resolve(g, c) { g.gainWater(c.p, 3); },
  }),
  O({
    id: 'prepad', name: 'Noční přepad', cost: 1, countdown: 1, junk: 'injure', icon: 'night-vision', hue: 250,
    effectText: 'Zraň. Pokud má soupeř 4 nebo více přeživších, zraň znovu.',
    flavor: 'Bez světla, bez zvuku, bez slitování.',
    *resolve(g, c) {
      const many = g.peopleCount(g.opp(c.p)) >= 4;
      yield* g.damageChoose(c, { kind: 'injure', title: 'Noční přepad: zraň nepřítele' });
      if (many) yield* g.damageChoose(c, { kind: 'injure', title: 'Noční přepad: druhé zranění' });
    },
  }),
  O({
    id: 'evakuace', name: 'Evakuace', cost: 1, countdown: 0, junk: 'drifter', icon: 'exit-door', hue: 150,
    effectText: 'Vrať svého přeživšího (ne tuláka) do ruky. Pak naverbuj tuláka.',
    flavor: 'Kdo uteče, ten se vrátí.',
    canPlay: (g, c) => g.ownFaceUpPeople(c.p).length > 0,
    playNeeds: 'Nemáš žádného přeživšího lícem nahoru.',
    *resolve(g, c) { yield* g.evacuateChoose(c); },
  }),
  O({
    id: 'poslednikapka', name: 'Poslední kapka', cost: 3, countdown: 3, junk: 'water', icon: 'drop', hue: 190,
    effectText: 'Poškoď dvě různé soupeřovy základny (i kryté).',
    flavor: 'Když dojde voda, dojde i trpělivost.',
    *resolve(g, c) {
      const first = yield* g.damageBaseAnyChoose(c, 'Poslední kapka: první základna');
      yield* g.damageBaseAnyChoose(c, 'Poslední kapka: druhá základna', first ? [first] : []);
    },
  }),
  O({
    id: 'vymena', name: 'Výměnný obchod', cost: 0, countdown: 0, junk: 'draw', icon: 'trade', hue: 55,
    effectText: 'Odhoď až 2 karty z ruky. Pak lízni o 1 kartu víc, než kolik jsi odhodil.',
    flavor: 'Dva šrouby za jednu konzervu. Fér.',
    *resolve(g, c) { const n = yield* g.discardUpTo(c.p, 2, 'Výměnný obchod: odhoď až 2 karty'); g.draw(c.p, n + 1); },
  }),
];

// ---------------------------------------------------------------------------
// COLLECTION-ONLY CARDS (rare & legendary) – not in the classic shared deck
// ---------------------------------------------------------------------------
export const COLLECTION_SURVIVORS: CardDef[] = [
  S({
    id: 'honak', name: 'Honák Vítek', cost: 2, junk: 'raid', icon: 'cowboy-boot', hue: 28, copies: 0, rarity: 'rare',
    flavor: 'Žene stádo motorek přes duny.',
    abilities: [{ cost: 2, text: 'Nájezd: zahraj nebo posuň svůj Nájezd.', canUse: (g, c) => g.canRaid(c.p), needs: 'Nájezd nejde posunout.', *run(g, c) { yield* g.raid(c.p); } }],
  }),
  S({
    id: 'doktorka', name: 'Doktorka Iva', cost: 3, junk: 'restore', icon: 'stethoscope', hue: 150, copies: 0, rarity: 'rare',
    flavor: 'Diplom spálila. Ruce si nechala.',
    abilities: [{
      cost: 2, text: 'Oprav až 2 své poškozené karty.',
      canUse: (g, c) => g.restoreTargets(c.p, {}).length > 0,
      *run(g, c) { yield* g.restoreChoose(c, {}); if (g.restoreTargets(c.p, {}).length) yield* g.restoreChoose(c, { optional: true }); },
    }],
  }),
  S({
    id: 'strazce', name: 'Strážce studny', cost: 2, junk: 'water', icon: 'guarded-tower', hue: 205, copies: 0, rarity: 'rare',
    flavor: 'Kdo chce vodu, musí přes něj.',
    trait: 'Dokud je Strážce nepoškozený, základnu v jeho sloupci nelze poškodit Nájezdem.',
    abilities: [],
  }),
  S({
    id: 'baron', name: 'Vodní baron', cost: 3, junk: 'water', icon: 'crowned-heart', hue: 195, copies: 0, rarity: 'legendary',
    flavor: 'Vlastní poslední čerpadlo. A ví to.',
    trait: 'Na začátku tvého tahu získáš 1 vodu navíc.',
    abilities: [{ cost: 2, text: 'Lízni 2 karty.', *run(g, c) { g.draw(c.p, 2); } }],
  }),
  S({
    id: 'matka', name: 'Matka Prachu', cost: 3, junk: 'drifter', icon: 'hood', hue: 35, copies: 0, rarity: 'legendary',
    flavor: 'Každý ztracený má u ní místo.',
    trait: 'Tvoji tuláci vydrží dvě poškození (první je jen poškodí).',
    abilities: [{
      cost: 2, text: 'Naverbuj 2 tuláky.',
      canUse: (g, c) => g.hasFreeSlot(c.p), needs: 'Nemáš volné místo.',
      *run(g, c) { yield* g.gainDrifter(c.p); yield* g.gainDrifter(c.p); },
    }],
  }),
  S({
    id: 'prorok', name: 'Prorok Bouře', cost: 4, junk: 'injure', icon: 'lightning-storm', hue: 260, copies: 0, rarity: 'legendary',
    flavor: '„Nebe vám to spočítá.“',
    abilities: [{
      cost: 3, text: 'Poškoď každého nekrytého soupeřova přeživšího.',
      canUse: (g, c) => g.damageTargets(c.p, 'damage').some((uid) => !!g.findPerson(uid)),
      needs: 'Soupeř nemá žádného nekrytého přeživšího.',
      *run(g, c) { yield* g.stormSweep(c); },
    }],
  }),
  S({
    id: 'velitelka', name: 'Velitelka Ocel', cost: 3, junk: 'raid', icon: 'visored-helm', hue: 12, copies: 0, rarity: 'legendary',
    flavor: 'Plán má vždycky. Záložní taky.',
    trait: 'Když tvůj Nájezd poškodí základnu, lízni 2 karty.',
    abilities: [{ cost: 1, text: 'Nájezd: zahraj nebo posuň svůj Nájezd.', canUse: (g, c) => g.canRaid(c.p), needs: 'Nájezd nejde posunout.', *run(g, c) { yield* g.raid(c.p); } }],
  }),
];

export const COLLECTION_OPERATIONS: CardDef[] = [
  O({
    id: 'kyselydest', name: 'Kyselý déšť', cost: 2, countdown: 2, junk: 'injure', icon: 'acid', hue: 95, copies: 0, rarity: 'rare',
    effectText: 'Poškoď každou nekrytou soupeřovu základnu.',
    flavor: 'Z mraků teče rez.',
    *resolve(g, c) { yield* g.acidRain(c); },
  }),
  O({
    id: 'vysadek', name: 'Výsadek', cost: 1, countdown: 1, junk: 'drifter', icon: 'parachute', hue: 210, copies: 0, rarity: 'rare',
    effectText: 'Naverbuj 2 tuláky. Pak lízni kartu.',
    flavor: 'Padáky ze starých plachet. Většinou drží.',
    *resolve(g, c) { yield* g.gainDrifter(c.p); yield* g.gainDrifter(c.p); g.draw(c.p, 1); },
  }),
  O({
    id: 'oaza', name: 'Oáza', cost: 2, countdown: 3, junk: 'water', icon: 'palm-tree', hue: 160, copies: 0, rarity: 'legendary',
    effectText: 'Oprav všechny své karty a získej 3 vody navíc.',
    flavor: 'Možná je to přelud. Ale voda je mokrá.',
    *resolve(g, c) { g.restoreAll(c.p); g.gainWater(c.p, 3); },
  }),
];

SURVIVORS.push(...COLLECTION_SURVIVORS);
OPERATIONS.push(...COLLECTION_OPERATIONS);

// ---------------------------------------------------------------------------
// SPECIAL CARDS
// ---------------------------------------------------------------------------
export const RAID: CardDef = {
  id: 'najezd', name: 'Nájezd', kind: 'raid', countdown: 2, abilities: [], copies: 0,
  effectText: 'Soupeř si vybere jednu svou základnu a ta je poškozena. Pak se Nájezd vrací k tobě.',
  flavor: 'Prach, motory, křik.', icon: 'flaming-claw', hue: 8,
  *resolve(g, c) { yield* g.resolveRaid(c.p); },
};

export const CISTERN: CardDef = {
  id: 'cisterna', name: 'Cisterna', kind: 'cistern', junk: 'water', abilities: [], copies: 0,
  effectText: 'Akce: zaplať 1 vodu a vezmi Cisternu do ruky. Rozebráním získáš vodu navíc a Cisterna se vrátí do tvé zóny.',
  flavor: 'Rezavá, děravá, nenahraditelná.', icon: 'oil-drum', hue: 200,
};

export const DRIFTER: CardDef = {
  id: 'tulak', name: 'Tulák', kind: 'survivor', abilities: [], copies: 0,
  trait: 'Karta lícem dolů bez schopností. Když je poškozen, je zničen a vrací se lícem dolů na balíček.',
  flavor: 'Nikdo nezná jeho jméno.', icon: 'hooded-figure', hue: 0,
};

// ---------------------------------------------------------------------------
// BASES (základny) – 29 designs
// ---------------------------------------------------------------------------
export const BASES: CardDef[] = [
  B({
    id: 'vodarna', name: 'Vodárna', draw: 1, icon: 'water-tank', hue: 195,
    flavor: 'Poslední fungující filtr v okolí.',
    abilities: [{ cost: 1, text: 'Získej 2 vody navíc.', *run(g, c) { g.gainWater(c.p, 2); } }],
  }),
  B({
    id: 'radiostanice', name: 'Radiostanice', draw: 2, icon: 'radar-dish', hue: 175,
    flavor: 'Šum, šum, šum… a pak varování.',
    abilities: [{
      cost: 1, text: 'Prohlédni si vrchní 3 karty balíčku a vrať je v libovolném pořadí.',
      canUse: (g, c) => g.deckOf(c.p).length > 0,
      needs: 'Balíček je prázdný.',
      *run(g, c) { yield* g.reorderTop(c.p, 3); },
    }],
  }),
  B({
    id: 'hnizdo', name: 'Kulometné hnízdo', draw: 2, icon: 'machine-gun', hue: 20,
    flavor: 'Pytle s pískem a nekonečná trpělivost.',
    abilities: [{
      cost: 2, text: 'Zraň.',
      canUse: (g, c) => g.hasDamageTarget(c.p, 'injure'),
      *run(g, c) { yield* g.damageChoose(c, { kind: 'injure' }); },
    }],
  }),
  B({
    id: 'dilna', name: 'Dílna', draw: 2, icon: 'spanner', hue: 35,
    flavor: 'Tady se z šrotu dělají zázraky.',
    abilities: [{
      cost: 1, text: 'Oprav svého poškozeného přeživšího, nebo zneškodni nálož na své základně.',
      canUse: (g, c) => g.restoreTargets(c.p, { peopleOnly: true }).length > 0,
      needs: 'Nemáš poškozeného přeživšího ani nálož k zneškodnění.',
      *run(g, c) { yield* g.restoreChoose(c, { peopleOnly: true }); },
    }],
  }),
  B({
    id: 'trziste', name: 'Tržiště', draw: 1, icon: 'shop', hue: 48,
    flavor: 'Smlouvá se nožem i úsměvem.',
    abilities: [{
      cost: 1, text: 'Odhoď kartu z ruky, pak lízni 2 karty.',
      canUse: (g, c) => g.discardableHand(c.p).length > 0,
      needs: 'Nemáš kartu, kterou bys odhodil.',
      *run(g, c) { yield* g.discardChoose(c.p, 1, 'Tržiště: odhoď kartu'); g.draw(c.p, 2); },
    }],
  }),
  B({
    id: 'trhaviny', name: 'Sklad trhavin', draw: 1, icon: 'explosive-materials', hue: 5,
    flavor: 'Kouření přísně zakázáno.',
    abilities: [{
      cost: 1, text: 'Polož nálož na nekrytou soupeřovu základnu (bez nálože). Na začátku tvého příštího tahu vybuchne a základnu poškodí, i když bude krytá.',
      canUse: (g, c) => g.chargeTargets(c.p).length > 0,
      *run(g, c) { yield* g.placeChargeChoose(c); },
    }],
  }),
  B({
    id: 'ubikace', name: 'Ubikace', draw: 1, icon: 'camping-tent', hue: 85,
    flavor: 'Postel je postel, i když je z palet.',
    abilities: [{
      cost: 1, text: 'Naverbuj tuláka.',
      canUse: (g, c) => g.hasFreeSlot(c.p),
      needs: 'Nemáš volné místo pro přeživšího.',
      *run(g, c) { yield* g.gainDrifter(c.p); },
    }],
  }),
  B({
    id: 'bunkr', name: 'Bunkr', draw: 1, icon: 'bunker', hue: 210,
    flavor: 'Beton z doby, kdy se ještě věřilo na budoucnost.',
    trait: 'Dokud v tomto sloupci stojí 2 nepoškození přeživší, Bunkr nelze poškodit (ani nájezdem).',
    abilities: [],
  }),
  B({
    id: 'studna', name: 'Studna', draw: 0, icon: 'well', hue: 200,
    flavor: 'Hluboká, studená, střežená.',
    trait: 'Na začátku tvého tahu, pokud Studna není poškozená, získáš 1 vodu navíc.',
    abilities: [],
  }),
  B({
    id: 'srotiste', name: 'Šrotiště', draw: 2, icon: 'gear-hammer', hue: 28,
    flavor: 'Všechno se dá rozebrat. Dvakrát.',
    abilities: [{
      cost: 1, text: 'Rozeber kartu z ruky: její efekt rozebrání se provede dvakrát.',
      canUse: (g, c) => g.handSize(c.p) > 0,
      needs: 'Nemáš kartu v ruce.',
      *run(g, c) { yield* g.doubleJunkChoose(c); },
    }],
  }),
  B({
    id: 'zbrojnice', name: 'Zbrojnice', draw: 0, icon: 'ammo-box', hue: 0,
    flavor: 'Náboje se tu počítají po kusech.',
    abilities: [{
      cost: 2, text: 'Poškoď.',
      canUse: (g, c) => g.hasDamageTarget(c.p, 'damage'),
      *run(g, c) { yield* g.damageChoose(c, { kind: 'damage' }); },
    }],
  }),
  B({
    id: 'prehrada', name: 'Přehrada', draw: 2, icon: 'dam', hue: 205,
    flavor: 'Co přiteče dnes, vyteče zítra.',
    abilities: [{
      cost: 0, text: 'Ulož 1 nebo 2 své vody do Přehrady. Na začátku tvého příštího tahu je získáš zpět jako vodu navíc.',
      canUse: (g, c) => g.state.players[c.p].water > 0,
      needs: 'Nemáš žádnou vodu k uložení.',
      *run(g, c) { yield* g.storeWaterChoose(c); },
    }],
  }),
  B({
    id: 'stezka', name: 'Pašerácká stezka', draw: 1, icon: 'footprint', hue: 75,
    flavor: 'Mapu nenajdeš. Musíš znát lidi.',
    trait: 'Tvoje první akce Lízni kartu v každém tahu stojí 1 vodu místo 2.',
    abilities: [],
  }),
  B({
    id: 'signal', name: 'Signální oheň', draw: 1, icon: 'campfire', hue: 18,
    flavor: 'Kouř je vidět na kilometry. Přesně o to jde.',
    abilities: [{ cost: 2, text: 'Nájezd: zahraj nebo posuň svůj Nájezd.', canUse: (g, c) => g.canRaid(c.p), needs: 'Nájezd nejde posunout.', *run(g, c) { yield* g.raid(c.p); } }],
  }),
  B({
    id: 'pevnost', name: 'Pevnost', draw: 1, hp: 3, icon: 'castle', hue: 230,
    flavor: 'Tři zdi. Tři šance.',
    trait: 'Pevnost je zničena až třetím poškozením.',
    abilities: [],
  }),
  B({
    id: 'vrakoviste', name: 'Vrakoviště', draw: 1, icon: 'car-wheel', hue: 15,
    flavor: 'Mezi vraky se dá žít. Nějak.',
    abilities: [{
      cost: 0, text: 'Odhoď kartu z ruky: naverbuj tuláka.',
      canUse: (g, c) => g.discardableHand(c.p).length > 0 && g.hasFreeSlot(c.p),
      needs: 'Potřebuješ kartu v ruce a volné místo.',
      *run(g, c) { yield* g.discardChoose(c.p, 1, 'Vrakoviště: odhoď kartu'); yield* g.gainDrifter(c.p); },
    }],
  }),
  B({
    id: 'rusicka', name: 'Rušička', draw: 2, icon: 'static-waves', hue: 290,
    flavor: 'Bzzzzzz.',
    abilities: [{
      cost: 1, text: 'Soupeř náhodně odhodí kartu z ruky. (Cisterna se mu vrátí do zóny.)',
      canUse: (g, c) => g.handSize(g.opp(c.p)) > 0,
      needs: 'Soupeř nemá v ruce žádnou kartu.',
      *run(g, c) { g.randomDiscard(g.opp(c.p)); },
    }],
  }),
  B({
    id: 'hangar', name: 'Hangár', draw: 2, icon: 'mechanic-garage', hue: 215,
    flavor: 'Kola, pásy, nebo aspoň trakař.',
    abilities: [{
      cost: 1, text: 'Prohoď přeživší ve dvou svých sloupcích (všichni se přesunou k druhé základně).',
      canUse: (g, c) => g.peopleCount(c.p) > 0,
      needs: 'Nemáš žádné přeživší k přesunu.',
      *run(g, c) { yield* g.swapColumnsChoose(c); },
    }],
  }),
  B({
    id: 'vysilac', name: 'Vysílač', draw: 0, icon: 'satellite-communication', hue: 165,
    flavor: 'Rozkazy letí rychleji než kulky.',
    trait: 'Tvoje operace (i Nájezd) se ve frontě umisťují o 1 místo blíž (nejméně na místo 1).',
    abilities: [],
  }),
  B({
    id: 'krater', name: 'Kráter', draw: 3, icon: 'hole', hue: 25,
    flavor: 'Nic tu není. Proto tu nikdo neotravuje.',
    abilities: [],
  }),
  B({
    id: 'nemocnice', name: 'Ruiny nemocnice', draw: 1, icon: 'hospital-cross', hue: 135,
    flavor: 'Prázdné postele, plné sklady obvazů.',
    abilities: [{
      cost: 3, text: 'Oprav jinou svou poškozenou kartu (přeživšího i základnu), nebo zneškodni nálož.',
      canUse: (g, c) => g.restoreTargets(c.p, { exclude: c.uid }).length > 0,
      *run(g, c) { yield* g.restoreChoose(c, { exclude: c.uid }); },
    }],
  }),
  B({
    id: 'vezeni', name: 'Vězení', draw: 2, icon: 'prisoner', hue: 260,
    flavor: 'Mříže ze starých postelí. Pořád drží.',
    abilities: [{
      cost: 1, text: 'Omrač nekrytého nepřítele: během soupeřova příštího tahu nebude připravený.',
      canUse: (g, c) => g.stunTargets(c.p).length > 0,
      *run(g, c) { yield* g.stunChoose(c); },
    }],
  }),
  B({
    id: 'radar', name: 'Radar', draw: 1, icon: 'radar-sweep', hue: 150,
    flavor: 'Vidíme vás. Všechny.',
    abilities: [{
      cost: 1, text: 'Prohlédni si soupeřovu ruku. Pak lízni kartu.',
      *run(g, c) { yield* g.peekHand(c.p); g.draw(c.p, 1); },
    }],
  }),
  B({
    id: 'minovepole', name: 'Minové pole', draw: 2, icon: 'land-mine', hue: 40,
    flavor: 'Chodí se jen po kamenech. Po kterých, to víme jen my.',
    trait: 'Když tuto základnu poškodí schopnost soupeřova přeživšího, ten přeživší je zraněn (i když je krytý).',
    abilities: [],
  }),
  B({
    id: 'benzinka', name: 'Benzínka', draw: 2, icon: 'fuel-tank', hue: 58,
    flavor: 'Benzín už není. Ale nádrže se hodí.',
    abilities: [{
      cost: 1, text: 'Posuň svou operaci ve frontě o 1 místo vpřed (na volné místo). Z místa 1 se hned vyhodnotí.',
      canUse: (g, c) => g.advanceableEvents(c.p).length > 0,
      *run(g, c) { yield* g.advanceEventChoose(c); },
    }],
  }),
  B({
    id: 'skrys', name: 'Skrýš', draw: 2, icon: 'floor-hatch', hue: 120,
    flavor: 'Pod podlahou je místo pro jednoho.',
    abilities: [{
      cost: 1, text: 'Vrať svého nepoškozeného přeživšího (ne tuláka) do ruky.',
      canUse: (g, c) => g.ownFaceUpPeople(c.p, true).length > 0,
      *run(g, c) { yield* g.returnPersonChoose(c, true); },
    }],
  }),
  B({
    id: 'elektrarna', name: 'Elektrárna', draw: 0, icon: 'power-generator', hue: 52,
    flavor: 'Bzučí, jiskří, svítí. Někdy.',
    abilities: [{ cost: 1, text: 'Lízni kartu.', *run(g, c) { g.draw(c.p, 1); } }],
  }),
  B({
    id: 'kantyna', name: 'Kantýna', draw: 1, icon: 'cooking-pot', hue: 32,
    flavor: 'Polévka z ničeho. Ale teplá.',
    trait: 'První přeživší, kterého v každém tahu zahraješ, stojí o 1 vodu méně.',
    abilities: [],
  }),
  B({
    id: 'strelnice', name: 'Střelnice', draw: 2, icon: 'target-arrows', hue: 345,
    flavor: 'Plechovky už došly. Teď se střílí na tuláky.',
    abilities: [{
      cost: 1, text: 'Zraň nekrytého tuláka.',
      canUse: (g, c) => g.drifterTargets(c.p).length > 0,
      needs: 'Soupeř nemá nekrytého tuláka.',
      *run(g, c) { yield* g.shootDrifterChoose(c); },
    }],
  }),
];

// ---------------------------------------------------------------------------
// RARITIES (collection mode)
// ---------------------------------------------------------------------------
const RARITY: Record<string, CardDef['rarity']> = {
  pumpar: 'common', prak: 'common', zved: 'common', felcar: 'common', paserak: 'common', naborar: 'common',
  rex: 'common', prospektorka: 'common', radista: 'common',
  bara: 'uncommon', hana: 'uncommon', rez: 'uncommon', vymahac: 'uncommon', hlidkar: 'uncommon', marta: 'uncommon',
  bedrich: 'uncommon', jiskra: 'uncommon', bubenik: 'uncommon', myska: 'uncommon', lasar: 'uncommon', ludmila: 'uncommon',
  granatnik: 'rare', minometcik: 'rare', kat: 'rare',
  karavana: 'common', pramen: 'common', prepad: 'common', vymena: 'common',
  sucho: 'uncommon', delostrelectvo: 'uncommon', sanitka: 'uncommon', evakuace: 'uncommon', podkop: 'uncommon',
  sabotaz: 'rare', boure: 'rare', poslednikapka: 'rare',
};
for (const c of [...SURVIVORS, ...OPERATIONS]) c.rarity = c.rarity ?? RARITY[c.id] ?? 'common';
for (const c of [RAID, CISTERN, DRIFTER, ...BASES]) c.collectible = false;

export const ALL_CARDS: CardDef[] = [...SURVIVORS, ...OPERATIONS, ...BASES, RAID, CISTERN, DRIFTER];

export const CARDS: Record<string, CardDef> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

export function cardDef(id: string): CardDef {
  const d = CARDS[id];
  if (!d) throw new Error(`Unknown card id: ${id}`);
  return d;
}

export const JUNK_LABEL: Record<JunkKind, string> = {
  raid: 'Nájezd',
  injure: 'Zranit',
  restore: 'Opravit',
  draw: 'Líznout',
  drifter: 'Tulák',
  water: 'Voda navíc',
};

export const JUNK_TEXT: Record<JunkKind, string> = {
  raid: 'Zahraj svůj Nájezd do fronty, nebo ho posuň o 1 místo vpřed.',
  injure: 'Poškoď nekrytého nepřítele (jen přeživší).',
  restore: 'Oprav svého poškozeného přeživšího, nebo zneškodni nálož na své základně.',
  draw: 'Lízni kartu.',
  drifter: 'Naverbuj tuláka (vrchní karta balíčku lícem dolů).',
  water: 'Získej 1 vodu navíc.',
};

/** Build the shuffled draw deck contents (ids only). */
export function deckList(): string[] {
  const ids: string[] = [];
  for (const c of [...SURVIVORS, ...OPERATIONS]) for (let i = 0; i < c.copies; i++) ids.push(c.id);
  return ids;
}
