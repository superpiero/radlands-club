// Art direction + per-card subjects for AI-generated illustrations.
// All subjects describe ORIGINAL characters and places of "Poslední kapka".

export const ART_STYLE =
  'Painterly digital illustration for a premium collectible card game, original artwork. ' +
  'Setting: a sun-bleached post-apocalyptic Central European wasteland decades after the rivers dried up; water is the most precious resource. ' +
  'Visual language: warm ochre, rust orange, dusty sand and faded canvas-tarp browns; turquoise teal is reserved for water and water technology. ' +
  'Dramatic golden-hour rim lighting, a strong readable silhouette of the main subject, cinematic depth, atmospheric dust, subtle film grain and gritty hand-painted texture. ' +
  'Keep the main subject centred with some headroom so it still reads when cropped small. ' +
  'Absolutely no text, letters, numbers, logos, watermarks, card frames or borders – full-bleed artwork only.';

export interface ArtSpec { subject: string; landscape?: boolean }

export const ART: Record<string, ArtSpec> = {
  // ---------------- survivors ----------------
  pumpar: { subject: 'The pump keeper: a wiry old man in patched overalls and a welding cap cranking a rusty hand water pump on top of a tower of scrap and barrels; a thin stream of clear turquoise water glistens; dunes and broken power lines at dawn.' },
  bara: { subject: 'A broad-shouldered woman scavenger in a dusty duster coat resting a double-barrelled shotgun on her shoulder, confident half-smile, spent shells at her feet, a burnt-out bus behind her.' },
  prak: { subject: 'A barefoot teenage boy with goggles on his forehead aiming a home-made slingshot from the top of a rusty car roof, tongue out in concentration, wind blowing sand.' },
  zved: { subject: 'A lean scout lying flat on a rocky ridge, looking through battered binoculars across a valley of ruins, scarf over the mouth, long shadow at sunset.' },
  hana: { subject: 'A young female sapper in a leather apron and protective goggles carefully wiring a bundle of dynamite with a ticking clock, sparks, kneeling next to a concrete wall.' },
  felcar: { subject: 'A field medic with a red-cross armband stitching a wounded scavenger by lantern light inside a patched canvas tent, medical bag open, calm hands.' },
  rez: { subject: 'A muscular female blacksmith with rust-red braided hair hammering a car door into a wall plate on an improvised anvil, sparks flying, scrap fortress behind her.' },
  paserak: { subject: 'A sly smuggler in a long coat lined with hidden pockets, opening it to reveal bottles of water, tools and tins; moonlit back alley of a ruined town.' },
  naborar: { subject: 'A charismatic recruiter standing on an upturned crate shouting through a dented megaphone to a crowd of ragged wanderers, hand-painted banner without letters behind him.' },
  vymahac: { subject: 'A towering debt collector with brass knuckles and a heavy leather coat, cracking his knuckles in a doorway, menacing backlit silhouette.' },
  hlidkar: { subject: 'A tireless sentry manning an improvised mounted gun on a sandbag tower at night, searchlight beam cutting through the dust, alert eyes.' },
  marta: { subject: 'A stout storekeeper woman counting sealed water barrels in a dim warehouse, ledger under her arm, keys on her belt, shafts of light through the roof.' },
  bedrich: { subject: 'A huge gentle giant in welded scrap-metal armour holding a car-door shield, protecting a child behind him, dust storm swirling.' },
  rex: { subject: 'A scruffy loyal wasteland dog with a spiked collar and one torn ear, standing guard on a pile of rubble, teeth bared, fierce but lovable.' },
  jiskra: { subject: 'A young mechanic girl with oil-smudged cheeks and a headlamp, sparking an old generator back to life with jumper cables, grinning, tools everywhere.' },
  granatnik: { subject: 'A grenadier pulling the pin of a home-made grenade with his teeth, bandolier of grenades across his chest, explosion glow behind the ruined wall.' },
  bubenik: { subject: 'A wild drummer beating a war drum made from an oil barrel on a convoy truck roof, crowd of fighters cheering, dust and firelight.' },
  myska: { subject: 'A small quick scavenger girl rummaging through a junk pile with a magnet on a stick and a stuffed sack, mouse-like curiosity, glittering bits of metal.' },
  radista: { subject: 'A radio operator with big headphones hunched over a pile of glowing vacuum-tube radios in a bunker, antenna wires everywhere, focused face lit green.' },
  lasar: { subject: 'A wasteland wrangler on top of a rusty motorbike swinging a lasso over his head, about to rope a fleeing raider, dust cloud.' },
  ludmila: { subject: 'A stern grey-haired mayor woman in a patched formal coat standing at a makeshift town hall desk with a quill and scrolls, lantern light, small settlement behind her.' },
  prospektorka: { subject: 'A tough female prospector with a pickaxe and a headlamp cracking open rock in a narrow quarry, finding a glint of turquoise water seeping from the stone.' },
  minometcik: { subject: 'A mortar crew veteran dropping a shell into a scrap-built mortar tube behind sandbags, ears covered, a high arc of smoke into the sky.' },
  kat: { subject: 'A silent executioner in a hooded leather mask holding a heavy chain, standing in a doorway of a ruined chapel, ominous red sky.' },
  honak: { subject: 'A cowboy-like herder on a roaring dirt bike driving a pack of motorbike riders across the dunes, waving his hat, low sun.' },
  doktorka: { subject: 'A former surgeon woman in a stained white coat and round glasses with a stethoscope, operating table lit by car headlights inside a garage clinic.' },
  strazce: { subject: 'A grim guardian with a long spear and a gas mask standing in front of a deep stone well, protecting it from a dust storm, turquoise glow rising from the well.' },
  baron: { subject: 'A wealthy water baron in a ragged velvet coat and a crown made of pipe fittings, sitting on a throne of water tanks, holding a crystal glass of clear turquoise water.' },
  matka: { subject: 'A mysterious old matriarch wrapped in layered shawls and dust, surrounded by hooded wanderers who kneel around her, warm firelight and long shadows.' },
  prorok: { subject: 'A wild-bearded prophet on a rock raising a staff toward a giant dust storm full of lightning, robes whipping in the wind, apocalyptic sky.' },
  velitelka: { subject: 'A commanding female warlord in a visored helmet and a long coat standing on the hood of a lead war-truck of a raiding convoy, pointing forward, banners without symbols.' },

  // ---------------- operations ----------------
  sucho: { subject: 'A cracked dry riverbed under a merciless white sun, a dead boat stranded in the mud, heat haze, no people.' },
  karavana: { subject: 'A long caravan of hand-pulled carts and rusty trucks loaded with crates winding through a desert canyon at golden hour.' },
  delostrelectvo: { subject: 'An improvised artillery battery firing at night, muzzle flashes, shells streaking across the sky toward distant ruins.' },
  sanitka: { subject: 'An old ambulance van covered in welded armour plates and a hand-painted red cross racing through a dust storm, headlights blazing.' },
  boure: { subject: 'An enormous wall of sand rolling over a small settlement, people running for cover, the sky turning dark orange.' },
  sabotaz: { subject: 'A gloved hand cutting a wire with pliers in the dark next to a sparking control box, tense close-up, red warning light.' },
  podkop: { subject: 'Diggers in a narrow candle-lit tunnel under a fortress wall, wooden supports, a mine cart full of earth.' },
  pramen: { subject: 'A hidden underground spring in a cave, crystal-clear turquoise water bubbling between rocks, light falling from a crack in the ceiling.' },
  prepad: { subject: 'Shadowy raiders with night-vision goggles sneaking over a fence at night, green lenses glowing, moonlight.' },
  evakuace: { subject: 'People escaping through a back door of a burning shelter into a waiting truck, carrying bundles, urgent motion blur.' },
  poslednikapka: { subject: 'A single huge drop of turquoise water falling in slow motion toward a cracked desert floor, the whole wasteland reflected in it, dramatic sunset.' },
  vymena: { subject: 'Two traders bartering at a market stall, exchanging a canteen of water for a box of bolts, close-up of hands and goods.' },
  kyselydest: { subject: 'Rusty acid rain pouring from sick yellow-green clouds onto corroding metal rooftops, steam rising.' },
  vysadek: { subject: 'Supply crates and wanderers parachuting down from the sky on patched sail parachutes over the dunes at dawn.' },
  oaza: { subject: 'A miraculous green oasis with palm trees and a turquoise pool hidden among dunes, travellers kneeling to drink, soft light.' },

  // ---------------- bases (landscape) ----------------
  vodarna: { subject: 'A rusty water treatment plant with big filter tanks and pipes, a glowing turquoise filtration pool, guarded walls.', landscape: true },
  radiostanice: { subject: 'A hilltop radio station with a tall improvised antenna mast, satellite dish and blinking lights at dusk.', landscape: true },
  hnizdo: { subject: 'A machine-gun nest built from sandbags and car doors on a ruined overpass, overlooking a desert road.', landscape: true },
  dilna: { subject: 'A cluttered workshop in an old garage, workbenches, hanging tools, a half-repaired vehicle, warm lamp light.', landscape: true },
  trziste: { subject: 'A busy scrap market under colourful patched awnings, stalls of tools, canteens and spare parts, crowd of traders.', landscape: true },
  trhaviny: { subject: 'An explosives depot in a concrete bunker with crates of dynamite, hazard stripes painted without letters, a single lamp.', landscape: true },
  ubikace: { subject: 'Rows of tents and pallet shacks forming living quarters, laundry lines, campfires, evening.', landscape: true },
  bunkr: { subject: 'A massive cold-war concrete bunker entrance half buried in sand, heavy steel door, sandbags.', landscape: true },
  studna: { subject: 'An ancient stone well with a wooden winch and bucket in the middle of a dusty courtyard, turquoise glint deep inside.', landscape: true },
  srotiste: { subject: 'A vast scrapyard with towers of crushed cars, a crane with a magnet, sparks of someone cutting metal.', landscape: true },
  zbrojnice: { subject: 'A fortified armoury with racks of improvised rifles and ammo boxes behind a chain-link cage.', landscape: true },
  prehrada: { subject: 'A cracked concrete dam holding back the last reservoir of turquoise water in a canyon, patched with scrap.', landscape: true },
  stezka: { subject: 'A narrow smugglers\' path winding through rock canyons, footprints in the sand, a hidden cache under a ledge.', landscape: true },
  signal: { subject: 'A huge signal bonfire on a hill sending a column of black smoke into the orange sky, figures watching.', landscape: true },
  pevnost: { subject: 'A fortress made of three concentric scrap-metal walls on a mesa, watchtowers, flags without symbols.', landscape: true },
  vrakoviste: { subject: 'A graveyard of wrecked airplanes and buses half buried in dunes, people living inside the fuselages.', landscape: true },
  rusicka: { subject: 'A jamming station: a tangle of antennas and speakers emitting visible distortion waves, sparks, night.', landscape: true },
  hangar: { subject: 'A large aircraft hangar converted into a vehicle garage with rolling doors open, trucks and bikes inside.', landscape: true },
  vysilac: { subject: 'A tall transmitter tower with a red beacon on top above a town of shacks, radio waves suggested in the air.', landscape: true },
  krater: { subject: 'A huge impact crater with a small hidden settlement built on its inner slope, quiet and empty landscape.', landscape: true },
  nemocnice: { subject: 'The ruins of a hospital with one wing repaired, white sheets as curtains, a faded red cross painted on the roof.', landscape: true },
  vezeni: { subject: 'A prison made from shipping containers and bed-frame bars, a guard tower, barbed wire at dusk.', landscape: true },
  radar: { subject: 'A rotating radar dish on a hilltop bunker sweeping the horizon, glowing green screen light from a window.', landscape: true },
  minovepole: { subject: 'A minefield in front of a settlement wall, marker stones and buried mines, one mine exploding in the distance.', landscape: true },
  benzinka: { subject: 'An abandoned gas station turned into a stronghold, fuel tanks repurposed as water tanks, neon tubes broken.', landscape: true },
  skrys: { subject: 'A secret hideout under a trapdoor in a ruined house, a ladder leading down to a cosy lantern-lit room.', landscape: true },
  elektrarna: { subject: 'A small power plant of scavenged solar panels, wind turbines and a humming generator shed, cables everywhere.', landscape: true },
  kantyna: { subject: 'A canteen in a tin-roofed hall, a big steaming cooking pot, survivors eating at long tables, warm light.', landscape: true },
  strelnice: { subject: 'A shooting range with tin-can targets and dummy targets made of rags, shooters practising, dusty afternoon.', landscape: true },

  // ---------------- specials ----------------
  najezd: { subject: 'A raiding convoy of spiked cars and motorbikes charging over a dune toward the viewer, flames and dust, war cries.' },
  cisterna: { subject: 'A battered water tanker barrel on a cart with a turquoise tap dripping, sun glare on the metal.' },
  tulak: { subject: 'A lone hooded wanderer seen from behind walking into the endless desert, face hidden, long shadow, mysterious.' },

  // ---------------- table & product art ----------------
  playmat: { landscape: true, subject: 'Top-down view of an empty worn canvas game mat lying on a wooden table: a faded hand-drawn map of a dry wasteland (dried riverbeds, dunes, ruined roads, contour lines) printed on sand-coloured canvas, coffee stains, stitched edges; very low contrast so cards placed on it stay readable; no zones, no text. Format 16:9 wide.' },
  cardback: { subject: 'Card back design: a symmetrical emblem of a single turquoise water drop inside a rusty riveted metal ring, surrounded by stencil-like ornamental patterns on dark teal-and-rust textured background, centred and symmetrical, no text.' },
  booster: { subject: 'Product shot of a sealed foil booster pack shaped like a small battered jerrycan wrapper, teal and rust colours, a water-drop emblem in the centre, hazard tape across the top, dramatic studio lighting on a dark background, no text.' },
};
