import { useState } from 'react';
import { go } from '../App';
import { HowToPlay } from '../components/HowToPlay';
import { Card, CardBack } from '../components/Card';
import { Icon } from '../components/Icon';

export function Rules() {
  const [show, setShow] = useState(false);
  return (
    <div className="page">
      <div className="inner">
        <div className="topnav">
          <button className="btn small" onClick={() => go('/')}><Icon name="return-arrow" /> Domů</button>
          <button className="btn small" onClick={() => go('/cards')}><Icon name="magnifying-glass" /> Databáze karet</button>
        </div>
        <h1>Pravidla</h1>
        <p><button className="btn primary" onClick={() => setShow(true)}><Icon name="play-button" /> Jak hrát za 2 minuty</button></p>
        {show && <HowToPlay onClose={() => setShow(false)} />}
        <p className="note">
          <b>Cíl hry:</b> zničit všechny tři soupeřovy základny. Kdo to dokáže, vyhrává okamžitě – i uprostřed tahu.
        </p>

        <h2>Co je na stole</h2>
        <ul>
          <li><b>Základny</b> – každý hráč má 3. Před každou základnou je <b>sloupec</b> pro nejvýš 2 přeživší (celkem max. 6).</li>
          <li><b>Přeživší</b> – postavy, které chrání základny a mají schopnosti. Stojí vodu.</li>
          <li><b>Operace</b> – silné jednorázové efekty, které se odpočítávají ve <b>frontě</b> (místa 1–3).</li>
          <li><b>Nájezd</b> – každý hráč má vlastní kartu Nájezdu. Když dorazí, soupeř si vybere jednu svou základnu a ta je poškozena – <i>i když je krytá</i>.</li>
          <li><b>Cisterna</b> – za 1 vodu ji vezmeš do ruky; později ji rozebereš za +1 vodu. Tak si můžeš „přenést“ vodu do dalšího tahu.</li>
          <li><b>Tulák</b> – přeživší lícem dolů (vrchní karta balíčku). Nemá schopnosti, jen kryje. Nikdo neví, co je na jeho rubu.</li>
        </ul>
        <div className="cardrow" style={{ margin: '10px 0 0' }}>
          <Card id="bara" noZoom />
          <Card id="karavana" noZoom />
          <Card id="studna" noZoom />
          <CardBack id="tulak" noZoom />
        </div>

        <h2>Příprava</h2>
        <ol>
          <li>Každý dostane 6 náhodných základen a tajně si vybere 3 (nebo hrajte s náhodnými). Pořadí určuje sloupce.</li>
          <li>Do ruky si každý lízne tolik karet, kolik je součet čísel <Icon name="card-draw" /> na jeho základnách.</li>
          <li>Los určí hráče, který vybere, kdo začne. <b>Začínající hráč dostane v prvním tahu jen 1 vodu.</b></li>
        </ol>

        <h2>Průběh tahu</h2>
        <ol>
          <li><b>Začátek tahu</b> – vyhodnotí se efekty „na začátku tahu“ (vybuchnou nálože, vrátí se uložená voda…).</li>
          <li><b>Operace</b> – operace na místě 1 se vyhodnotí a odhodí (Nájezd se vrátí k majiteli). Pak se všechny operace ve frontě posunou o 1 místo vpřed.</li>
          <li><b>Doplnění</b> – dostaneš <b>3 vody</b> a lízneš 1 kartu. Voda se mezi tahy nepřenáší.</li>
          <li><b>Akce</b> – v libovolném pořadí a kolikrát chceš:
            <ul>
              <li><b>Zahrát přeživšího</b> – zaplať cenu a postav ho do sloupce (vepředu nebo vzadu). V tahu, kdy přišel, není připravený.</li>
              <li><b>Zahrát operaci</b> – zaplať cenu a polož ji do fronty na místo podle odpočtu <Icon name="sands-of-time" />. Je-li obsazeno, jde na první volné místo za ním. Operace s ⚡ se vyhodnotí hned.</li>
              <li><b>Rozebrat kartu</b> – odhoď kartu z ruky a proveď její efekt rozebrání (ikona v rohu karty). Zadarmo!</li>
              <li><b>Použít schopnost</b> připravené karty – zaplať cenu ve vodě; karta pak do konce tahu není připravená.</li>
              <li><b>Líznout kartu</b> za 2 vody, nebo <b>vzít Cisternu</b> za 1 vodu.</li>
            </ul>
          </li>
          <li><b>Konec tahu</b> – nevyužitá voda propadá.</li>
        </ol>

        <h2>Krytí a útoky</h2>
        <ul>
          <li>Karta je <b>krytá</b>, když před ní stojí tvůj přeživší. Základna je krytá, když je v jejím sloupci aspoň jeden přeživší. Přeživší vzadu je krytý tím vepředu.</li>
          <li><b>Poškodit</b> lze, pokud karta neříká jinak, jen <b>nekrytou</b> soupeřovu kartu (přeživšího nebo základnu).</li>
          <li><b>Zranit</b> = poškodit nekrytého přeživšího (ne základnu).</li>
          <li><b>Nepřítel</b> = soupeřův přeživší (včetně tuláků). Základna nepřítel není.</li>
          <li>Poškozená karta dostane prasklinu. <b>Druhé poškození ji zničí.</b> Poškozený přeživší není připravený a jeho vlastnost neplatí.</li>
          <li>Tulák je zničen už prvním poškozením a vrací se lícem dolů navrch balíčku.</li>
          <li>Když je zničen přeživší vzadu, ten vepředu se posune k základně.</li>
          <li><b>Opravit</b> = odstranit jedno poškození z vlastní karty (opravený přeživší není v tomto tahu připravený).</li>
        </ul>

        <h2>Efekty rozebrání</h2>
        <table>
          <tbody>
            <tr><td><Icon name="flaming-claw" /> Nájezd</td><td>Pošli svůj Nájezd do fronty (místo 2), nebo ho posuň o 1 vpřed. Z místa 1 zaútočí hned.</td></tr>
            <tr><td><Icon name="human-target" /> Zranit</td><td>Poškoď nekrytého nepřítele.</td></tr>
            <tr><td><Icon name="bandage-roll" /> Opravit</td><td>Oprav svou poškozenou kartu (nebo zneškodni nálož na své základně).</td></tr>
            <tr><td><Icon name="card-draw" /> Líznout</td><td>Lízni kartu.</td></tr>
            <tr><td><Icon name="hooded-figure" /> Tulák</td><td>Postav vrchní kartu balíčku lícem dolů do svého sloupce.</td></tr>
            <tr><td><Icon name="water-drop" /> Voda navíc</td><td>Získej 1 vodu pro tento tah.</td></tr>
          </tbody>
        </table>

        <h2>Jak poznáš stavy karet na stole</h2>
        <table>
          <tbody>
            <tr><td><b>Svítící tyrkysový okraj</b></td><td>Karta je připravená a můžeš teď použít její schopnost.</td></tr>
            <tr><td><b>Vybledlá karta + přesýpací hodiny</b></td><td>Karta není připravená (zahrána / použita / opravena v tomto tahu). Najetím myší zjistíš důvod.</td></tr>
            <tr><td><b>Natočená karta s červenou prasklinou „POŠKOZEN“</b></td><td>Poškozená – další poškození ji zničí.</td></tr>
            <tr><td><b>Šedá základna „ZNIČENO“</b></td><td>Zničená základna. Do sloupce lze dál hrát přeživší.</td></tr>
            <tr><td><Icon name="shield" /> <b>Štít</b></td><td>Karta je krytá – běžný útok ji nezasáhne.</td></tr>
            <tr><td><Icon name="knockout" /> <b>Fialový odznak</b></td><td>Omráčený přeživší – v příštím tahu majitele nebude připravený.</td></tr>
            <tr><td><Icon name="time-dynamite" /> <b>NÁLOŽ</b></td><td>Na začátku tahu toho, kdo ji položil, vybuchne a základnu poškodí (i krytou). Oprava ji zneškodní.</td></tr>
            <tr><td><Icon name="water-drop" /> <b>Modrý odznak</b></td><td>Uložená voda (Skladnice Marta, Přehrada) – vrátí se na začátku tvého tahu.</td></tr>
            <tr><td><b>Červeně šrafovaný sloupec „ODKRYTO“</b></td><td>Zvěd odkryl sloupec – do konce tahu je v něm vše nekryté.</td></tr>
            <tr><td><b>Pulzující rámeček</b></td><td>Platný cíl pro právě prováděnou volbu (červená = útok, zelená = pomoc, zlatá = výběr).</td></tr>
          </tbody>
        </table>

        <h2>Další pravidla</h2>
        <ul>
          <li>Vlastnosti (text v kurzívě) platí stále – u přeživších jen dokud nejsou poškození, u základen dokud nejsou zničené.</li>
          <li>Útočné efekty nesmíš použít na své vlastní karty, pokud to karta výslovně neříká.</li>
          <li>Když dojde balíček, zamíchá se odhazovací balíček jako nový. <b>Když dojde podruhé, hra končí remízou.</b></li>
          <li>Ruka nemá limit. Odhazovací balíček je veřejný jen vrchní kartou.</li>
          <li>Dokud neodhalíš novou informaci (líznutí, rozhodnutí soupeře…), můžeš akci vrátit tlačítkem <b>Zpět</b> (Ctrl+Z). Rozdělanou volbu zrušíš klávesou Esc.</li>
        </ul>

        <h2>Rychlé rady</h2>
        <ul>
          <li>Cenné přeživší stav <b>dozadu</b> – vepředu je nekryje nic.</li>
          <li>Nájezd je hlavní zdroj poškození základen. Karty s ikonou <Icon name="flaming-claw" /> rozebírej, když potřebuješ tlak.</li>
          <li>Zbyla ti 1 voda? Vezmi Cisternu. Zbyly 2? Lízni kartu.</li>
        </ul>
        <p className="muted" style={{ marginTop: 30 }}>Poslední kapka je samostatná hra vytvořená pro kamarády. Ikony: game-icons.net (CC BY 3.0).</p>
      </div>
    </div>
  );
}
