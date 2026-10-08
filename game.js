'use strict';
(function () {

// ================= Ayarlar (ekonomiyi buradan dengeleyebilirsin) =================
const CFG = {
  START_COINS: 800,           // başlangıç: 10 modern paketlik jeton (paket 80)
  SELL_PER_USD: 20,           // Pokébank: 1$ değerindeki kart = 20 jeton
  BANK_MIN_VALUE: 0.5,        // Pokébank bu değerin altındaki kartları almaz ($)
  PACK_MARKUP: 1.2,           // paket fiyatı = satılabilir kartların beklenen değeri x bu çarpan
  MIN_PACK_PRICE: 80,
  NEW_SPECIES_BONUS: 10,      // yeni bir Pokémon'un ilk kartı
  TARGET_BONUS: 150,          // bir Pokémon'un hedef kartını (illustration) bulmak
  NEW_TRAINER_BONUS: 5,       // yeni bir trainer'ın ilk kartı
  TRAINER_TARGET_BONUS: 50,   // bir trainer'ın hedef kartını bulmak
  ILLUS_RATE: 0.125,          // pakette Illustration Rare çıkma şansı (~1/8)
  SPECIAL_ILLUS_RATE: 0.033,  // pakette Special Illustration Rare çıkma şansı (~1/30)
  GOD_PACK_CHANCE: 1 / 500,   // tüm kartları nadir / illustration olan paket
  // İş (clicker): tıkla jeton kazan, yardımcı al pasif gelir kazan
  CLICK_BASE: 1,              // ilk tıklama başı jeton
  COMBO_MAX: 50,              // bu kadar hızlı tıklamada kombo x2'ye ulaşır
  COMBO_TIMEOUT: 1200,        // ms; bu kadar tıklamazsan kombo sıfırlanır
  HELPER_COST_GROWTH: 1.15,   // her yardımcı alımında fiyat artışı
  IDLE_CAP_HOURS: 4,          // oyun kapalıyken en fazla bu kadar saatlik pasif gelir sayılır
  SHINY_MIN_SEC: 60,          // shiny Pokémon en erken / en geç bu aralıkta çıkar
  SHINY_MAX_SEC: 180,
  SHINY_STAY_SEC: 9,          // ekranda kalma süresi
  BULK_COUNT: 10,
  PAGE_SIZE: 60,
  IMG_BASE: 'https://images.pokemontcg.io/',
  SPRITE: n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${n}.png`,
  ANIM_SPRITE: n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${n}.gif`,
};
const SAVE_KEY = 'pokekart_save_v1';

// İş (clicker) yardımcıları: satın aldıkça saniye başı jeton üretirler.
// cps = tanesi başına saniyede jeton, cost = ilk fiyat, req = gereken tamamlanmış Pokédex sayısı
const HELPERS = [
  { id: 'chansey', name: 'Chansey', role: 'Pokémon Center', sprite: 113, cps: 0.1, cost: 30, req: 0, icon: '💊' },
  { id: 'tropius', name: 'Tropius', role: 'Berry çiftliği', sprite: 357, cps: 0.5, cost: 250, req: 0, icon: '🍓' },
  { id: 'meowth', name: 'Meowth', role: 'PokéMart', sprite: 52, cps: 2, cost: 1500, req: 10, icon: '💰' },
  { id: 'porygon', name: 'Porygon', role: 'Laboratuvar', sprite: 137, cps: 8, cost: 9000, req: 30, icon: '🔬' },
  { id: 'machamp', name: 'Machamp', role: 'Gym', sprite: 68, cps: 30, cost: 60000, req: 80, icon: '💪' },
  { id: 'lucario', name: 'Lucario', role: 'Elite Four', sprite: 448, cps: 100, cost: 400000, req: 150, icon: '⚔️' },
  { id: 'dragonite', name: 'Dragonite', role: 'Şampiyonluk', sprite: 149, cps: 350, cost: 2500000, req: 250, icon: '👑' },
];
// Tek seferlik yükseltmeler. add: tıklamaya sabit ek, clickMul: tıklama çarpanı, allMul: tüm kazanç çarpanı,
// cpsFrac: tıklama başına pasif gelirin bu oranı kadar ek, shinyRate: shiny sıklığı çarpanı, helper: o yardımcının üretimi x2
const UPGRADES = [
  { id: 'glove', name: 'Antrenman Eldiveni', icon: '🥊', desc: 'Tıklama +1 jeton', cost: 100, add: 1 },
  { id: 'shoes', name: 'Koşu Ayakkabısı', icon: '👟', desc: 'Tıklama x2', cost: 800, clickMul: 2 },
  { id: 'band', name: 'Choice Band', icon: '🎽', desc: 'Tıklama +5 jeton', cost: 5000, add: 5 },
  { id: 'lucky', name: 'Lucky Egg', icon: '🥚', desc: 'Tıklama x2', cost: 25000, clickMul: 2 },
  { id: 'share', name: 'Exp. Share', icon: '📡', desc: "Her tıklama saniye başı gelirin %5'ini de verir", cost: 60000, cpsFrac: 0.05 },
  { id: 'amulet', name: 'Amulet Coin', icon: '🪙', desc: 'Tüm kazanç x1,5', cost: 200000, allMul: 1.5 },
  { id: 'charm', name: 'Shiny Charm', icon: '✨', desc: 'Shiny Pokémon 2 kat sık çıkar', cost: 500000, shinyRate: 2 },
  { id: 'master', name: 'Master Ball', icon: '🟣', desc: 'Tıklama x3', cost: 2000000, clickMul: 3 },
  // her yardımcıdan 10 tane olunca açılan eğitim yükseltmeleri
  ...HELPERS.map(h => ({ id: 'train_' + h.id, name: `${h.name} eğitimi`, icon: h.icon, desc: `${h.name} 2 kat üretir`, cost: h.cost * 25, helper: h.id, needCount: 10 })),
];

// Nadirlik seviyeleri: 0 Common, 1 Uncommon, 2 Rare, 3 Holo, 4 ex/V/GX, 5 Ultra, 6 Secret/Hyper
const RARE_TIER_W = [0, 0, 60, 25, 10, 4, 1];   // nadir slotunda seviye olasılıkları (seviye grubu başına)
const ANY_SLOT_W = [50, 30, 12, 5, 2, 0.7, 0.3];  // karışık slotta kart başına ağırlık
const TIER_DEFAULT_PRICE = [0.08, 0.15, 0.4, 1.2, 4, 12, 35];
const GENS = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = n => Math.floor(n).toLocaleString('tr-TR');
const usd = v => '$' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2));

if (!window.POKE_DATA) {
  document.body.innerHTML = `<div class="nodata"><h1>Kart verisi bulunamadı</h1>
    <p>Oyunu ilk kez açıyorsan önce oyun klasöründeki <b>veri-guncelle.bat</b> dosyasına çift tıkla.
    Tüm kartları ve fiyatları internetten indirip <code>data/cards.js</code> dosyasını oluşturacak (birkaç dakika sürer).</p>
    <p>Bittikten sonra bu sayfayı yenile (F5).</p></div>`;
  return;
}

// ================= Veriyi hazırla =================
function tierOf(rarity) {
  const s = rarity.toLowerCase();
  if (s === 'common') return 0;
  if (s === 'uncommon') return 1;
  if (s === 'rare') return 2;
  if (/special illustration|hyper|secret|rainbow|gold|crown|black white/.test(s)) return 6;
  if (/illustration rare|ultra|vmax|vstar|shiny|shining|star|prism|legend|amazing|radiant|ace|trainer gallery|mega.attack/.test(s)) return 5;
  if (/double rare|\bex\b|gx|\bv\b|break|prime|lv\.x/.test(s)) return 4;
  if (/holo/.test(s)) return 3;
  return 2;
}

const D = window.POKE_DATA;
const SETS = D.sets.map((s, i) => ({ i, id: s[0], name: s[1], series: s[2], date: s[3] || '', total: s[4], logo: s[5], symbol: s[6], cards: [] }));
// Fiyatı olmayan eski küçük setlerin (McDonald's, trainer kit) görselleri de yok, onları atla.
// Yeni setlerin görselleri ayrı bir sunucudan (tam URL) gelir; fiyatları henüz yoksa nadirliğe göre tahmini değer kullanılır.
const usableSets = new Set();
for (const r of D.cards) if (r[6] > 0 || /^https?:/.test(r[7])) usableSets.add(r[2]);
const CARDS = [];
const BY_ID = new Map();
for (const r of D.cards) {
  const set = SETS[r[2]];
  if (!set || !usableSets.has(r[2])) continue;
  const rarity = D.rarities[r[4]] || 'Promo';
  const c = { id: r[0], name: r[1], set, num: r[3], rarity, tier: tierOf(rarity), dex: Array.isArray(r[5]) ? [...new Set(r[5])] : [], price: r[6], img: r[7], st: r[8], sub: r[9] || '' };
  if (c.st === 1) c.dex = [];   // trainer kartları Pokédex'e değil trainer destesine sayılır
  c.illus = /illustration rare/i.test(rarity);          // Illustration Rare + Special Illustration Rare
  c.sir = /special illustration/i.test(rarity);
  c.value = c.price > 0 ? c.price : TIER_DEFAULT_PRICE[c.tier];
  CARDS.push(c);
  BY_ID.set(c.id, c);
  set.cards.push(c);
}

function prettyName(slug) {
  if (!slug) return null;
  const fix = {
    'nidoran-f': 'Nidoran♀', 'nidoran-m': 'Nidoran♂', 'mr-mime': 'Mr. Mime', 'mime-jr': 'Mime Jr.', 'mr-rime': 'Mr. Rime',
    'farfetchd': "Farfetch'd", 'sirfetchd': "Sirfetch'd", 'ho-oh': 'Ho-Oh', 'porygon-z': 'Porygon-Z', 'type-null': 'Type: Null',
    'jangmo-o': 'Jangmo-o', 'hakamo-o': 'Hakamo-o', 'kommo-o': 'Kommo-o', 'flabebe': 'Flabébé',
  };
  return fix[slug] || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Pokédex: hedef = Pokémon'un illustration kartlarından herhangi biri; illustration kartı yoksa en değerli kartı
let maxDex = D.species.length;
for (const c of CARDS) for (const n of c.dex) if (n > maxDex && n < 2000) maxDex = n;
const SPECIES = [];
for (let n = 1; n <= maxDex; n++) SPECIES[n] = { n, name: prettyName(D.species[n - 1]), cards: [] };
for (const c of CARDS) for (const n of c.dex) if (SPECIES[n]) SPECIES[n].cards.push(c);
const DEX = [];
for (let n = 1; n <= maxDex; n++) {
  const sp = SPECIES[n];
  if (!sp.cards.length) continue;
  sp.cards.sort((a, b) => b.value - a.value);
  sp.best = sp.cards.find(c => c.price > 0) || sp.cards[0];   // tahmini değerli kartlar yerine gerçek fiyatlı olanı tercih et
  const illus = sp.cards.filter(c => c.illus);
  sp.mode = illus.length ? 'illus' : 'best';
  sp.targets = illus.length ? illus : [sp.best];
  if (!sp.name) sp.name = sp.best.name;
  DEX.push(sp);
}
const TARGET_IDS = new Set();
for (const sp of DEX) for (const c of sp.targets) TARGET_IDS.add(c.id);

// Trainer destesi: aynı trainer'ın farklı baskıları tek girişte toplanır
// ("Professor's Research (Professor Oak)" ve "(Professor Sada)" -> "Professor's Research").
// Hedef Pokédex ile aynı: illustration versiyonu, yoksa en değerli kart.
const TRAINER_TYPES = { S: 'Supporter', I: 'Item', D: 'Stadium', T: 'Pokémon Tool' };
const trainerKey = name => name.replace(/\s*\(.*\)\s*$/, '').trim();
const TRAINER_MAP = new Map();
for (const c of CARDS) {
  if (c.st !== 1) continue;
  const k = trainerKey(c.name);
  if (!TRAINER_MAP.has(k)) TRAINER_MAP.set(k, { name: k, cards: [] });
  TRAINER_MAP.get(k).cards.push(c);
}
const TRAINERS = [...TRAINER_MAP.values()].sort((a, b) => a.name.localeCompare(b.name));
const TRAINER_TARGET_IDS = new Set();
TRAINERS.forEach((t, i) => {
  t.i = i;
  t.cards.sort((a, b) => b.value - a.value);
  t.best = t.cards.find(c => c.price > 0) || t.cards[0];
  const illus = t.cards.filter(c => c.illus);
  t.mode = illus.length ? 'illus' : 'best';
  t.targets = illus.length ? illus : [t.best];
  const subs = {};
  for (const c of t.cards) if (c.sub) subs[c.sub] = (subs[c.sub] || 0) + 1;
  t.sub = Object.keys(subs).sort((a, b) => subs[b] - subs[a])[0] || '';
  for (const c of t.cards) c.trainer = t;
  for (const c of t.targets) TRAINER_TARGET_IDS.add(c.id);
});
const isTargetCard = c => TARGET_IDS.has(c.id) || TRAINER_TARGET_IDS.has(c.id);

// Paket yapısı ve fiyatı
const priceDamp = c => 1 / Math.sqrt(1 + c.value);         // aynı nadirlikte pahalı kart daha zor çıkar
const anyW = c => ANY_SLOT_W[c.tier] * priceDamp(c);
const flatW = c => priceDamp(c);
const sellableValue = c => (c.tier >= 2 && c.value >= CFG.BANK_MIN_VALUE) ? c.value : 0;

const SHOP_SETS = SETS.filter(s => s.cards.length);
for (const s of SHOP_SETS) {
  s.plain = s.cards.filter(c => !c.illus);
  if (!s.plain.length) s.plain = s.cards;
  s.ir = s.cards.filter(c => c.illus && !c.sir);
  s.sir = s.cards.filter(c => c.sir);
  s.illusCount = s.ir.length + s.sir.length;
  s.commons = s.plain.filter(c => c.tier === 0);
  s.uncommons = s.plain.filter(c => c.tier === 1);
  const rares = s.plain.filter(c => c.tier >= 2);
  s.rareTiers = [];
  for (let t = 2; t <= 6; t++) { const g = rares.filter(c => c.tier === t); if (g.length) s.rareTiers.push({ t, cards: g }); }
  s.booster = s.commons.length >= 5 && s.uncommons.length >= 3 && s.rareTiers.length > 0;
  // Fiyat: Pokébank'a satılabilecek kartların beklenen değeri (illustration ve çer çöp hariç)
  const pIllus = (s.ir.length ? CFG.ILLUS_RATE : 0) + (s.sir.length ? CFG.SPECIAL_ILLUS_RATE : 0);
  const sv = c => sellableValue(c);
  const wavgS = (arr, wf) => { let t = 0, x = 0; for (const c of arr) { const w = wf(c); t += w; x += w * sv(c); } return t ? x / t : 0; };
  let ev;
  if (s.booster) {
    const tw = s.rareTiers.reduce((a, g) => a + RARE_TIER_W[g.t], 0);
    const rareEv = s.rareTiers.reduce((a, g) => a + RARE_TIER_W[g.t] / tw * wavgS(g.cards, flatW), 0);
    ev = (1 - pIllus) * wavgS(s.plain, anyW) + rareEv;
  } else {
    ev = 9 * wavgS(s.plain, anyW) + (1 - pIllus) * wavgS(s.plain, flatW);
  }
  s.price = Math.max(CFG.MIN_PACK_PRICE, Math.round(ev * CFG.SELL_PER_USD * CFG.PACK_MARKUP / 10) * 10);
  s.targetCards = s.cards.filter(c => TARGET_IDS.has(c.id));
  s.estimated = !s.cards.some(c => c.price > 0);
  let h = 0; for (const ch of s.id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  s.hue = h;
}

// ================= Kayıt =================
function newState() {
  return { coins: CFG.START_COINS, owned: {}, got: {},
    clicker: { helpers: {}, upgrades: {}, ts: Date.now() },
    stats: { packs: 0, cardsOpened: 0, illusPulled: 0, sirPulled: 0, earned: 0, salary: 0, clicks: 0, clickEarned: 0, idleEarned: 0, shinies: 0, bestPull: null, godPacks: 0 },
    settings: { noanim: false, volume: 60, muted: false } };
}
function loadState(d) {
  const st = Object.assign(newState(), d);
  st.clicker = Object.assign(newState().clicker, d.clicker || {});
  st.stats = Object.assign(newState().stats, d.stats || {});
  st.settings = Object.assign(newState().settings, d.settings || {});
  delete st.freePacks; delete st.freeTs; delete st.lastDaily;
  if (!d.stats || d.stats.cardsOpened == null) st.stats.cardsOpened = st.stats.packs * 10;
  // eski iş sistemleri (kasa / mesai) kaldırıldı: bekleyen maaş jetona eklenir
  const old = d.job;
  if (old) {
    let pay = Math.floor(old.kasa || 0);
    if (old.working && old.dur) {
      const p = Math.min(1, Math.max(0, (Date.now() - old.start + (old.boostMs || 0)) / (old.dur * 60000)));
      pay += Math.floor(((old.pay || 0) + (old.bonus || 0)) * p);
    } else if (old.working) {
      pay += Math.floor(Math.min(480, Math.max(0, (Date.now() - old.start) / 60000)) * 8);
    }
    if (pay > 0) { st.coins += pay; st.stats.salary += pay; }
  }
  delete st.job;
  return st;
}
let S;
let firstRun = false;
try { const raw = localStorage.getItem(SAVE_KEY); firstRun = !raw; S = raw ? JSON.parse(raw) : null; } catch (e) { S = null; }
S = (S && typeof S.owned === 'object') ? loadState(S) : newState();
let saveTimer = null;
function saveNow() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { toast('Kayıt yapılamadı: ' + esc(e.message), 'err'); } }
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 150); }
window.addEventListener('beforeunload', saveNow);

const own = id => S.owned[id] || 0;
const speciesOwned = sp => sp.cards.some(c => S.owned[c.id]);
const isComplete = sp => sp.targets.some(c => S.owned[c.id]);
const spState = sp => isComplete(sp) ? 2 : speciesOwned(sp) ? 1 : 0;
const trainerOwned = t => t.cards.some(c => S.owned[c.id]);
const isTrainerComplete = t => t.targets.some(c => S.owned[c.id]);
const trState = t => isTrainerComplete(t) ? 2 : trainerOwned(t) ? 1 : 0;
const cardCoins = c => Math.max(1, Math.round(c.value * CFG.SELL_PER_USD));
const glow = v => v >= 100 ? 4 : v >= 20 ? 3 : v >= 5 ? 2 : v >= 1 ? 1 : 0;
const isAbs = c => /^https?:/.test(c.img);
const imgSmall = c => isAbs(c) ? c.img : CFG.IMG_BASE + c.img + '.png';
const imgLarge = c => isAbs(c) ? c.img.replace(/\/small$/, '/large') : CFG.IMG_BASE + c.img + '_hires.png';
const today = () => new Date().toISOString().slice(0, 10);
let completedCount = 0;

function addCard(c) {
  const before = own(c.id);
  const r = { c, isNew: before === 0, newSpecies: [], newTarget: [], newTrainer: false, newTrainerTarget: false, bonus: 0 };
  if (before === 0) {
    for (const n of c.dex) {
      const sp = SPECIES[n];
      if (!sp || !sp.targets) continue;
      if (!speciesOwned(sp)) r.newSpecies.push(sp);
      if (sp.targets.includes(c) && !isComplete(sp)) r.newTarget.push(sp);
    }
    const t = c.trainer;
    if (t) {
      r.newTrainer = !trainerOwned(t);
      r.newTrainerTarget = t.targets.includes(c) && !isTrainerComplete(t);
    }
    S.got[c.id] = Date.now();
  }
  S.owned[c.id] = before + 1;
  S.stats.cardsOpened++;
  if (c.illus) { S.stats.illusPulled++; if (c.sir) S.stats.sirPulled++; }
  r.bonus = r.newSpecies.length * CFG.NEW_SPECIES_BONUS + r.newTarget.length * CFG.TARGET_BONUS
    + (r.newTrainer ? CFG.NEW_TRAINER_BONUS : 0) + (r.newTrainerTarget ? CFG.TRAINER_TARGET_BONUS : 0);
  S.coins += r.bonus;
  const bp = S.stats.bestPull && BY_ID.get(S.stats.bestPull);
  if (!bp || c.value > bp.value) S.stats.bestPull = c.id;
  return r;
}

// ================= Pokébank kuralları =================
function bankInfo(c) {
  const n = own(c.id);
  if (!c.illus && (c.tier < 2 || c.value < CFG.BANK_MIN_VALUE)) return { n: 0, why: 'Pokébank bu kartı almıyor (common/uncommon veya $' + CFG.BANK_MIN_VALUE.toFixed(2) + ' altı)' };
  if (c.illus) return { n: Math.max(0, n - 1), why: 'Illustration kart: 1 kopyası korunur' };
  if (TARGET_IDS.has(c.id)) return { n: Math.max(0, n - 1), why: 'Pokédex hedef kartı: 1 kopyası korunur' };
  if (TRAINER_TARGET_IDS.has(c.id)) return { n: Math.max(0, n - 1), why: 'Trainer destesi hedef kartı: 1 kopyası korunur' };
  return { n, why: '' };
}
function bankSell(c, k) {
  k = Math.min(k, bankInfo(c).n);
  if (k <= 0) return 0;
  S.owned[c.id] -= k;
  if (!S.owned[c.id]) { delete S.owned[c.id]; delete S.got[c.id]; }
  const g = k * cardCoins(c);
  S.coins += g;
  S.stats.earned += g;
  return g;
}

// ================= Paket oluşturma =================
function weighted(arr, wf) {
  let tot = 0;
  const ws = arr.map(x => { const w = wf(x); tot += w; return w; });
  if (tot <= 0) return arr[Math.floor(Math.random() * arr.length)];
  let r = Math.random() * tot;
  for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];
function sample(arr, n) {
  const a = arr.slice(), out = [];
  for (let i = 0; i < n; i++) {
    if (!a.length) { out.push(pickOne(arr)); continue; }
    out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  }
  return out;
}
function pickRare(set) {
  const g = weighted(set.rareTiers, x => RARE_TIER_W[x.t]);
  return weighted(g.cards, flatW);
}
// Illustration slotu: şansla IR / SIR, yoksa normal karışık kart
function pickSpecial(set, fallbackW) {
  const r = Math.random();
  if (set.ir.length && r < CFG.ILLUS_RATE) return pickOne(set.ir);
  if (set.sir.length && r < CFG.ILLUS_RATE + CFG.SPECIAL_ILLUS_RATE) return pickOne(set.sir);
  return weighted(set.plain, fallbackW);
}
function makePack(set) {
  let cards = [], god = false;
  if (set.booster && Math.random() < CFG.GOD_PACK_CHANCE) {
    god = true;
    const pool = set.illusCount ? [...set.ir, ...set.sir] : set.rareTiers.flatMap(g => g.cards);
    for (let i = 0; i < 10; i++) cards.push(pickOne(pool));
  } else if (set.booster) {
    cards.push(...sample(set.commons, 5), ...sample(set.uncommons, 3));
    cards.push(pickSpecial(set, anyW));
    cards.push(pickRare(set));
  } else {
    for (let i = 0; i < 9; i++) cards.push(weighted(set.plain, anyW));
    cards.push(pickSpecial(set, flatW));
  }
  cards.sort((a, b) => (a.illus - b.illus) || (a.value - b.value));   // illustration ve en değerli kart en sonda
  return { cards, god };
}

const packCost = set => set.price;
function pay(set) {
  if (S.coins < set.price) return false;
  S.coins -= set.price;
  return true;
}
function openPacks(set, n) {
  const results = [];
  let god = false;
  for (let i = 0; i < n; i++) {
    if (!pay(set)) break;
    const p = makePack(set);
    if (p.god) { god = true; S.stats.godPacks++; }
    S.stats.packs++;
    results.push(p.cards.map(addCard));
  }
  if (!results.length) { toast('Yeterli jetonun yok! İşe gidip para kazan veya Pokébank\'a kart sat.', 'err'); return; }
  save();
  updateHud();
  showPack(set, results, god);
}

// ================= Bildirim =================
function toast(msg, kind = '') {
  if (kind === 'err') SFX.play('error');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
  const all = $('#toasts').children;
  if (all.length > 6) all[0].remove();
}

// ================= HUD =================
function updateHud() {
  $('#hudCoins').textContent = fmt(S.coins);
  let owned = 0, done = 0;
  for (const sp of DEX) { const st = spState(sp); if (st) owned++; if (st === 2) done++; }
  const prevDone = completedCount;
  completedCount = done;
  $('#hudOwned').textContent = owned;
  $('#hudMaster').textContent = done;
  $('#hudTotal').textContent = DEX.length;
  $('#barOwned').style.width = (owned / DEX.length * 100) + '%';
  $('#barMaster').style.width = (done / DEX.length * 100) + '%';
  if (prevDone) for (const h of HELPERS) if (h.req > prevDone && h.req <= done) toast(`💼 Yeni yardımcı açıldı: <b>${esc(h.name)}</b> (${esc(h.role)})!`, "gold");
  updateJobHud();
  if (done === DEX.length && !S.stats.completed) {
    S.stats.completed = Date.now(); save();
    toast('🏆 TEBRİKLER! Pokédex tamamlandı!', 'gold');
  }
}

// ================= İş (clicker): tıkla, yardımcı al, pasif gelir kazan =================
// Her tıklama jeton verir; hızlı tıklamak kombo çarpanını x2'ye kadar çıkarır.
// Yardımcılar saniye başı jeton üretir (oyun kapalıyken de, en fazla IDLE_CAP_HOURS saatlik).
// Yükseltmeler tıklamayı / pasif geliri katlar. Ara ara çıkan shiny Pokémon'u yakalamak büyük bonus verir.
const helperCount = h => S.clicker.helpers[h.id] || 0;
const hasUpgrade = id => !!S.clicker.upgrades[id];
const helperCost = h => Math.ceil(h.cost * Math.pow(CFG.HELPER_COST_GROWTH, helperCount(h)));
const allMul = () => UPGRADES.reduce((m, u) => m * (u.allMul && hasUpgrade(u.id) ? u.allMul : 1), 1);
const helperMul = h => UPGRADES.some(u => u.helper === h.id && hasUpgrade(u.id)) ? 2 : 1;
const helperCps = h => h.cps * helperMul(h) * allMul();
const totalCps = () => HELPERS.reduce((s, h) => s + helperCount(h) * helperCps(h), 0);
function clickValue() {
  let base = CFG.CLICK_BASE, mul = 1, frac = 0;
  for (const u of UPGRADES) {
    if (!hasUpgrade(u.id)) continue;
    if (u.add) base += u.add;
    if (u.clickMul) mul *= u.clickMul;
    if (u.cpsFrac) frac += u.cpsFrac;
  }
  return base * mul * allMul() + totalCps() * frac;
}
const shinyRate = () => UPGRADES.reduce((m, u) => m * (u.shinyRate && hasUpgrade(u.id) ? u.shinyRate : 1), 1);
const upgradeAvailable = u => !hasUpgrade(u.id) && (!u.helper || helperCount(HELPERS.find(h => h.id === u.helper)) >= u.needCount);
const fmtRate = v => v >= 100 ? fmt(v) : v.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

function earn(amount, kind) {
  S.coins += amount;
  S.stats.salary += amount;
  if (kind === 'click') S.stats.clickEarned += amount;
  else if (kind === 'idle') S.stats.idleEarned += amount;
}
// Pasif gelir: son kontrolden bu yana geçen süre kadar (en fazla IDLE_CAP_HOURS)
function accrueIdle() {
  const now = Date.now();
  const dt = Math.min(Math.max(0, (now - (S.clicker.ts || now)) / 1000), CFG.IDLE_CAP_HOURS * 3600);
  S.clicker.ts = now;
  const gain = totalCps() * dt;
  if (gain > 0) earn(gain, 'idle');
  return gain;
}

// --- tıklama ve kombo ---
let combo = 0, lastClickAt = 0;
const comboMul = () => 1 + Math.min(1, combo / CFG.COMBO_MAX);
function clickWork(e) {
  const now = performance.now();
  combo = now - lastClickAt < CFG.COMBO_TIMEOUT ? combo + 1 : 1;
  lastClickAt = now;
  const v = clickValue() * comboMul();
  earn(v, 'click');
  S.stats.clicks++;
  SFX.play('tap');
  const mascot = $('#clickMascot');
  if (mascot && !S.settings.noanim) { mascot.classList.remove('hop'); void mascot.offsetWidth; mascot.classList.add('hop'); }
  popText($('#workScene'), e, '+' + fmtRate(v));
  if (S.stats.clicks % 25 === 0) save();
  updateJobHud();
}
function popText(scene, e, text, cls = '') {
  if (!scene || S.settings.noanim) return;
  const r = scene.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'click-pop ' + cls;
  el.textContent = text;
  el.style.left = ((e && e.clientX ? e.clientX - r.left : r.width / 2) + (Math.random() * 20 - 10)) + 'px';
  el.style.top = (e && e.clientY ? e.clientY - r.top : r.height / 2) + 'px';
  scene.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// --- satın alma ---
function buyHelper(id, n) {
  const h = HELPERS.find(x => x.id === id);
  if (!h || h.req > completedCount) return;
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const c = helperCost(h);
    if (S.coins < c) break;
    S.coins -= c;
    S.clicker.helpers[h.id] = helperCount(h) + 1;
    bought++;
  }
  if (!bought) return toast('Yeterli jetonun yok.', 'err');
  SFX.play('coin');
  if (helperCount(h) === 10) toast(`🎓 <b>${esc(h.name)} eğitimi</b> yükseltmesi açıldı!`, 'gold');
  save(); updateHud(); renderJob();
}
function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || !upgradeAvailable(u)) return;
  if (S.coins < u.cost) return toast('Yeterli jetonun yok.', 'err');
  S.coins -= u.cost;
  S.clicker.upgrades[u.id] = true;
  SFX.play('levelup');
  toast(`${u.icon} <b>${esc(u.name)}</b> alındı: ${esc(u.desc)}`, 'gold');
  save(); updateHud(); renderJob();
}

// --- shiny Pokémon ---
let shinyTimer = null, shinyAt = 0;
function scheduleShiny() {
  const sec = (CFG.SHINY_MIN_SEC + Math.random() * (CFG.SHINY_MAX_SEC - CFG.SHINY_MIN_SEC)) / shinyRate();
  shinyAt = Date.now() + sec * 1000;
}
function maybeSpawnShiny() {
  const scene = $('#workScene');
  if (!scene || currentTab !== 'job' || scene.querySelector('.shiny') || Date.now() < shinyAt) return;
  scheduleShiny();
  const pool = [25, 133, 6, 94, 448, 149, 130, 197, 196, 282, 445, 700, 778, 887];
  const n = pool[Math.floor(Math.random() * pool.length)];
  const el = document.createElement('img');
  el.className = 'shiny';
  el.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${n}.png`;
  el.alt = 'Shiny';
  el.title = 'Shiny Pokémon! Yakala!';
  el.style.left = (10 + Math.random() * 70) + '%';
  el.style.top = (18 + Math.random() * 40) + '%';
  el.addEventListener('click', ev => {
    ev.stopPropagation();
    const bonus = Math.max(25, totalCps() * 30 + clickValue() * 15);
    earn(bonus, 'click');
    S.stats.shinies = (S.stats.shinies || 0) + 1;
    SFX.play('illus');
    popText(scene, ev, `✨ +${fmt(bonus)}`, 'shiny-pop');
    toast(`✨ Shiny Pokémon yakaladın! <b>+${fmt(bonus)}</b> jeton`, 'gold');
    el.remove();
    save(); updateJobHud();
  });
  scene.appendChild(el);
  SFX.play('specialReady');
  setTimeout(() => el.remove(), CFG.SHINY_STAY_SEC * 1000);
}

// --- her saniye ---
function tickJob() {
  accrueIdle();
  if (performance.now() - lastClickAt > CFG.COMBO_TIMEOUT) combo = 0;
  maybeSpawnShiny();
  updateJobHud();
}
function updateJobHud() {
  const cps = totalCps();
  $('#hudCoins').textContent = fmt(S.coins);
  $('#hudKasa').textContent = cps > 0 ? `+${fmtRate(cps)}/sn` : 'Çalış';
  $('#hudJob').title = 'İş: tıkla ve yardımcı al';
  if ($('#cpsVal')) {
    $('#cpsVal').textContent = fmtRate(cps);
    $('#clickVal').textContent = fmtRate(clickValue());
    $('#comboVal').textContent = 'x' + comboMul().toFixed(2);
    $('#comboBar').style.width = Math.min(100, combo / CFG.COMBO_MAX * 100) + '%';
    document.querySelectorAll('[data-buy-helper]').forEach(b => {
      const h = HELPERS.find(x => x.id === b.dataset.buyHelper);
      b.disabled = S.coins < helperCost(h);
    });
    document.querySelectorAll('[data-buy-upgrade]').forEach(b => {
      b.disabled = S.coins < UPGRADES.find(x => x.id === b.dataset.buyUpgrade).cost;
    });
  }
}

// --- çalışma sahnesi: yardımcıların nesneleri uçuşur ---
let sceneTimers = [];
function stopScene() { sceneTimers.forEach(clearInterval); sceneTimers = []; }
function startScene() {
  stopScene();
  const scene = $('#workScene');
  if (!scene || S.settings.noanim) return;
  sceneTimers.push(setInterval(() => {
    if (!document.body.contains(scene)) return stopScene();
    const owned = HELPERS.filter(h => helperCount(h) > 0);
    if (!owned.length) return;
    const h = owned[Math.floor(Math.random() * owned.length)];
    const el = document.createElement('span');
    el.className = 'scene-item';
    el.textContent = h.icon;
    el.style.left = (6 + Math.random() * 88) + '%';
    el.style.fontSize = (16 + Math.random() * 12) + 'px';
    scene.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }, 1100));
}

function renderJob() {
  stopScene();
  const owned = HELPERS.filter(h => helperCount(h) > 0);
  const mascotH = owned.length ? owned[owned.length - 1] : null;
  const mascot = mascotH ? mascotH.sprite : 25;
  const ups = UPGRADES.filter(upgradeAvailable).sort((a, b) => a.cost - b.cost).slice(0, 6);
  const nextHelper = HELPERS.find(h => h.req > completedCount);
  $('#jobMain').innerHTML = `<div class="clicker">
    <div class="clicker-left">
      <div class="work-scene big" id="workScene">
        <div class="scene-ground"></div>
        <div class="helper-row">${owned.map(h => `<span class="helper-mini" title="${esc(h.name)} x${helperCount(h)}"><img src="${CFG.SPRITE(h.sprite)}" alt=""><b>${helperCount(h)}</b></span>`).join('')}</div>
        <img class="mascot" id="clickMascot" src="${CFG.ANIM_SPRITE(mascot)}" onerror="this.onerror=null;this.src='${CFG.SPRITE(mascot)}'" alt="" draggable="false">
        <div class="scene-hint">👆 Tıkla, jeton kazan!</div>
      </div>
      <div class="clicker-stats">
        <div class="stat"><b id="clickVal">0</b><span>tıklama başı</span></div>
        <div class="stat"><b id="cpsVal">0</b><span>saniye başı (pasif)</span></div>
        <div class="stat combo-stat"><b id="comboVal">x1.00</b><span>kombo</span><div class="mini-bar"><div id="comboBar"></div></div></div>
      </div>
      <p class="muted" style="font-size:12px">Hızlı tıkladıkça kombo artar (en fazla x2). Yardımcılar oyun kapalıyken de çalışır (en fazla ${CFG.IDLE_CAP_HOURS} saat). Arada bir sahnede ✨ shiny Pokémon belirir, kaçmadan tıkla!</p>
    </div>
    <div class="clicker-right">
      <h3>Yükseltmeler</h3>
      <div class="upgrade-list">${ups.map(u => `
        <button class="upgrade" data-buy-upgrade="${u.id}" title="${esc(u.desc)}">
          <span class="up-icon">${u.icon}</span>
          <span class="up-text"><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></span>
          <span class="up-cost"><span class="coin-ico"></span>${fmt(u.cost)}</span>
        </button>`).join('') || '<p class="muted">Şu an alınabilecek yükseltme yok. Bir yardımcıdan 10 tane alınca eğitimi açılır.</p>'}</div>
      <h3>Yardımcılar</h3>
      <div class="helper-list">${HELPERS.map(h => {
        const locked = h.req > completedCount, c = helperCost(h);
        return `<div class="helper ${locked ? 'locked' : ''}">
          <img src="${CFG.SPRITE(h.sprite)}" alt="" loading="lazy">
          <div class="h-info"><div><b>${esc(h.name)}</b> <span class="muted">· ${esc(h.role)}</span></div>
            <small>${locked ? `🔒 ${h.req} Pokémon tamamla (${completedCount}/${h.req})` : `tanesi +${fmtRate(helperCps(h))}/sn${helperMul(h) > 1 ? ' (eğitimli)' : ''} · sende ${helperCount(h)}`}</small></div>
          ${locked ? '' : `<div class="h-buy">
            <button class="btn primary" data-buy-helper="${h.id}" data-n="1"><span class="coin-ico"></span>${fmt(c)}</button>
            <button class="btn" data-buy-helper="${h.id}" data-n="10" title="10 tane al (parasının yettiği kadar)">x10</button>
          </div>`}
        </div>`;
      }).join('')}</div>
      ${nextHelper ? `<p class="muted" style="font-size:12px">Sıradaki yardımcı Pokédex'te ${nextHelper.req} Pokémon tamamlayınca açılır.</p>` : ''}
    </div>
  </div>`;
  if (!shinyAt) scheduleShiny();
  startScene();
  updateJobHud();
}


// ================= Sekmeler =================
let currentTab = 'shop';
function showTab(name) {
  if (name !== 'job') stopScene();
  currentTab = name;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  ({ shop: renderShop, dex: renderDex, trainers: renderTrainers, coll: renderColl, bank: renderBank, job: renderJob, stats: renderStats, settings: renderSettings })[name]();
  updateJobHud();
}
function refreshCurrent() { showTab(currentTab); }

// ================= Mağaza =================
function missingTargets(s) {
  return s.targetCards.filter(c => !own(c.id) && c.dex.some(n => SPECIES[n] && SPECIES[n].targets && !isComplete(SPECIES[n]))).length;
}
function initShop() {
  const series = [...new Set(SHOP_SETS.map(s => s.series))];
  $('#shopSeries').innerHTML += series.map(s => `<option>${esc(s)}</option>`).join('');
  ['shopSearch', 'shopSeries', 'shopSort', 'shopMissing'].forEach(id => $('#' + id).addEventListener('input', renderShop));
  $('#setGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    openPacks(SETS[+b.closest('.set-card').dataset.set], +b.dataset.open);
  });
}
function renderShop() {
  const q = $('#shopSearch').value.trim().toLowerCase();
  const series = $('#shopSeries').value, sort = $('#shopSort').value, onlyMissing = $('#shopMissing').checked;
  let list = SHOP_SETS.map(s => ({ s, missing: missingTargets(s), have: s.cards.filter(c => own(c.id)).length }));
  list = list.filter(x => (!series || x.s.series === series) && (!q || x.s.name.toLowerCase().includes(q) || x.s.id.includes(q)) && (!onlyMissing || x.missing > 0));
  const sorters = {
    new: (a, b) => b.s.date.localeCompare(a.s.date),
    old: (a, b) => a.s.date.localeCompare(b.s.date),
    missing: (a, b) => b.missing - a.missing,
    illus: (a, b) => b.s.illusCount - a.s.illusCount,
    cheap: (a, b) => a.s.price - b.s.price,
    price: (a, b) => b.s.price - a.s.price,
  };
  list.sort(sorters[sort]);
  $('#setGrid').innerHTML = list.map(({ s, missing, have }) => {
    const cost = packCost(s);
    return `<div class="set-card" data-set="${s.i}">
      <div class="set-logo"><img loading="lazy" src="${esc(s.logo)}" alt="" onerror="this.style.display='none'"></div>
      <div class="set-name">${esc(s.name)}</div>
      <div class="set-meta">${esc(s.series)} · ${s.date.slice(0, 4)} · ${s.cards.length} kart${s.booster ? '' : ' · özel set'}${s.estimated ? ' · <span title="Bu setin piyasa fiyatları henüz yok, değerler nadirliğe göre tahmini">tahmini fiyat</span>' : ''}</div>
      ${s.illusCount ? `<div class="set-meta"><span class="tag-ir">IR</span> ${s.illusCount} illustration kart</div>` : ''}
      <div class="prog"><div style="width:${have / s.cards.length * 100}%"></div></div>
      <div class="set-meta">${have}/${s.cards.length} sahip · <b>${missing}</b> eksik hedef kart</div>
      <div class="set-btns">
        <button class="btn primary" data-open="1" ${S.coins < cost ? 'disabled' : ''}>Aç · ${fmt(cost)}</button>
        <button class="btn" data-open="${CFG.BULK_COUNT}" title="${CFG.BULK_COUNT} paket birden aç (${fmt(s.price * CFG.BULK_COUNT)} jeton)">x${CFG.BULK_COUNT}</button>
      </div>
    </div>`;
  }).join('') || '<p class="muted">Set bulunamadı.</p>';
}

// ================= Paket açma ekranı =================
const ov = $('#opening');
let revealState = null;

function badgesHtml(r) {
  let b = '';
  if (r.newTarget.length) b += `<span class="badge best">★ POKÉDEX</span>`;
  if (r.newTrainerTarget) b += `<span class="badge best">★ TRAINER</span>`;
  if (r.c.illus) b += `<span class="badge ir">${r.c.sir ? 'SPECIAL ILLUS.' : 'ILLUSTRATION'}</span>`;
  if (r.newSpecies.length) b += `<span class="badge sp">YENİ POKÉMON</span>`;
  else if (r.newTrainer) b += `<span class="badge tr">YENİ TRAINER</span>`;
  else if (r.isNew && !r.c.illus) b += `<span class="badge new">YENİ</span>`;
  return b;
}
function cardHtml(r, i, flipped) {
  const c = r.c;
  return `<div class="card3d g${glow(c.value)} ${c.illus ? 'illus' : ''} ${flipped ? 'flipped' : ''}" data-i="${i}">
    <div class="inner"><div class="face back"></div><div class="face front"><img src="${imgSmall(c)}" alt="${esc(c.name)}"></div></div>
    <span class="price-tag">${usd(c.value)}</span>
    <div class="badges">${badgesHtml(r)}</div>
  </div>`;
}
function preload(results) { for (const r of results) { const im = new Image(); im.src = imgSmall(r.c); } }

// packs: her paketin kart sonuçları (tekli açmada 1 paket, toplu açmada 10)
function showPack(set, packs, god) {
  const results = packs.flat();
  const packOf = packs.flatMap((p, pi) => p.map(() => pi));
  preload(results.slice(0, 12));
  const multi = packs.length > 1;
  ov.classList.remove('hidden');
  ov.innerHTML = `
    <div class="open-title">${esc(set.name)}<small>${esc(set.series)} · ${multi ? `${packs.length} paket · ${results.length} kart · ` : ''}Paketi açmak için tıkla</small></div>
    <div class="pack-wrap ${multi ? 'multi' : ''}" id="packWrap">
      <div class="pack" style="--h:${set.hue}">
        <div class="pack-top"></div>
        <div class="pack-body">${set.logo ? `<img src="${esc(set.logo)}" alt="">` : ''}<span class="ball"></span><div class="pack-name">${esc(set.name)}${multi ? `<br>x${packs.length}` : ''}</div></div>
      </div>
    </div>
    <div class="open-hint">Tıkla veya Boşluk tuşuna bas</div>`;
  revealState = { set, results, packs, packOf, god, stage: 'pack' };
  $('#packWrap').addEventListener('click', tearPack);
}
function tearPack() {
  if (!revealState || revealState.stage !== 'pack') return;
  revealState.stage = 'tearing';
  SFX.play('tear');
  $('#packWrap .pack').classList.add('torn');
  setTimeout(showCards, S.settings.noanim ? 0 : 550);
}
// Deste: kartlar üst üste gelir, en üstten tek tek açılır (tekli ve toplu açmada aynı).
// Sıradan kartlar açık gelir; illustration / değerli / Pokédex hedefi kartlar kapalı gelir ve önce çevrilir.
const isSpecial = r => r.c.illus || r.c.value >= 20 || r.newTarget.length > 0 || r.newTrainerTarget;
const STACK_DEPTH = 8;          // destede görünen kart kalınlığı
const SEEN_MAX = 30;            // altta gösterilen geçilmiş kart sayısı
function showCards() {
  const { set, results, god } = revealState;
  Object.assign(revealState, { stage: 'cards', next: 0, announced: new Set(), busy: false });
  const n = results.length;
  ov.innerHTML = `
    ${god ? '<div class="god">✨ GOD PACK! ✨</div>' : ''}
    <div class="open-title">${esc(set.name)}<small id="stackHint"></small></div>
    <div class="stack-area" id="stack">${results.map((r, i) => cardHtml(r, i, false)).join('')}</div>
    <div class="seen-row ${n > 10 ? 'small' : ''}" id="seenRow"></div>
    <div class="reveal-bar">
      <button class="btn" id="skipSpecial">Özel karta atla ⏭</button>
      <button class="btn" id="skipAll">Hepsini göster</button>
    </div>`;
  ov.querySelectorAll('#stack .card3d').forEach((el, i) => { el.style.zIndex = n - i; });
  $('#stack').addEventListener('click', stackStep);
  $('#skipSpecial').addEventListener('click', skipToSpecial);
  $('#skipAll').addEventListener('click', finishReveal);
  activateTop();
}
function topEl() { return ov.querySelector(`#stack .card3d[data-i="${revealState.next}"]`); }
function hint(extra) {
  const st = revealState, multi = st.packs.length > 1;
  const pos = multi ? `Paket ${st.packOf[st.next] + 1}/${st.packs.length} · Kart ${st.next + 1}/${st.results.length}` : `Kart ${st.next + 1}/${st.results.length}`;
  $('#stackHint').textContent = `${pos} · ${extra}`;
}
function layoutStack() {
  const st = revealState;
  ov.querySelectorAll('#stack .card3d').forEach(c => {
    const d = +c.dataset.i - st.next;
    if (d < 0) return;
    c.style.visibility = d > STACK_DEPTH ? 'hidden' : '';
    const k = Math.min(d, STACK_DEPTH);
    c.style.transform = `translate(${k * 3}px, ${k * -3}px)`;
  });
  // önümüzdeki birkaç kartın görselini önceden yükle
  for (const r of st.results.slice(st.next + 1, st.next + 4)) { const im = new Image(); im.src = imgSmall(r.c); }
}
function activateTop() {
  const st = revealState, r = st.results[st.next], el = topEl();
  layoutStack();
  const hasSpecialAhead = st.results.some((x, i) => i > st.next && isSpecial(x));
  $('#skipSpecial').disabled = !hasSpecialAhead && !isSpecial(r);
  if (isSpecial(r)) {
    el.classList.add('special');
    SFX.play('specialReady');
    hint('✨ Özel bir kart! Çevirmek için tıkla');
  } else {
    flipTop();
    hint('Sonraki kart için tıkla veya Boşluk');
  }
}
function announce(i) {
  const st = revealState, r = st.results[i];
  if (st.announced.has(i)) return;
  st.announced.add(i);
  if (r.newTarget.length) SFX.play('target', 450);
  for (const sp of r.newTarget) toast(`★ <b>${esc(sp.name)}</b> Pokédex'e eklendi! +${CFG.TARGET_BONUS} jeton`, 'gold');
  for (const sp of r.newSpecies) toast(`Yeni Pokémon: <b>#${sp.n} ${esc(sp.name)}</b> +${CFG.NEW_SPECIES_BONUS}`);
  if (r.newTrainerTarget) { SFX.play('target', 450); toast(`★ <b>${esc(r.c.trainer.name)}</b> trainer destesine eklendi! +${CFG.TRAINER_TARGET_BONUS} jeton`, 'gold'); }
  else if (r.newTrainer) toast(`Yeni trainer: <b>${esc(r.c.trainer.name)}</b> +${CFG.NEW_TRAINER_BONUS}`);
}
function flipTop() {
  const st = revealState, el = topEl(), r = st.results[st.next];
  el.classList.remove('special');
  el.classList.add('flipped');
  SFX.play(r.c.sir ? 'sir' : r.c.illus ? 'illus' : isSpecial(r) ? 'special' : r.c.value >= 5 ? 'rare' : 'flip');
  if (isSpecial(r) && !S.settings.noanim) setTimeout(() => el.classList.add('burst'), 250);
  announce(st.next);
  if (isSpecial(r)) hint('Sonraki kart için tıkla veya Boşluk');
}
function addSeen(r) {
  const row = $('#seenRow');
  row.insertAdjacentHTML('beforeend', `<img src="${imgSmall(r.c)}" class="${r.c.illus ? 'illus' : ''}" alt="">`);
  while (row.children.length > SEEN_MAX) row.firstElementChild.remove();
}
function stackStep() {
  const st = revealState;
  if (!st || st.stage !== 'cards' || st.busy) return;
  const el = topEl();
  if (!el.classList.contains('flipped')) return flipTop();
  // üstteki kartı kenara at
  st.busy = true;
  SFX.play('whoosh');
  el.classList.add('thrown');
  addSeen(st.results[st.next]);
  setTimeout(() => {
    el.style.display = 'none';
    st.busy = false;
    st.next++;
    if (st.next >= st.results.length) finishReveal();
    else activateTop();
  }, S.settings.noanim ? 0 : 280);
}
// Sıradan kartları hızla geçip bir sonraki özel karta git
function skipToSpecial() {
  const st = revealState;
  if (!st || st.stage !== 'cards' || st.busy) return;
  const cur = st.results[st.next];
  if (isSpecial(cur) && !topEl().classList.contains('flipped')) return flipTop();
  let j = st.next + 1;
  while (j < st.results.length && !isSpecial(st.results[j])) j++;
  SFX.play('whoosh');
  for (let i = st.next; i < j && i < st.results.length; i++) {
    const el = ov.querySelector(`#stack .card3d[data-i="${i}"]`);
    el.style.display = 'none';
    announce(i);
    addSeen(st.results[i]);
  }
  st.next = j;
  if (st.next >= st.results.length) finishReveal();
  else activateTop();
}
function finishReveal() {
  const st = revealState;
  if (!st || st.stage === 'done') return;
  const { set, results, packs, god } = st;
  st.stage = 'done';
  results.forEach((_, i) => announce(i));
  const multi = packs.length > 1;
  const total = results.reduce((s, r) => s + r.c.value, 0);
  const nNew = results.filter(r => r.isNew).length;
  const bonus = results.reduce((s, r) => s + r.bonus, 0);
  let shown = results, title, sum;
  if (multi) {
    const nSp = results.reduce((s, r) => s + r.newSpecies.length, 0);
    const nTarget = results.reduce((s, r) => s + r.newTarget.length, 0);
    const nIllus = results.filter(r => r.c.illus).length;
    shown = results.filter(r => r.c.illus || r.newTarget.length || r.newSpecies.length || r.newTrainerTarget || r.c.value >= 3)
      .sort((a, b) => (b.newTarget.length - a.newTarget.length) || (b.c.illus - a.c.illus) || (b.c.value - a.c.value)).slice(0, 80);
    title = `${packs.length} paket açıldı: ${esc(set.name)}<small>Öne çıkan kartlar · büyütmek için karta tıkla</small>`;
    sum = `${results.length} kart · değer <b>${usd(total)}</b> · ${nIllus} illustration · ${nTarget} Pokédex hedefi · ${nSp} yeni Pokémon · ${nNew} yeni kart${bonus ? ` · bonus <b>+${bonus}</b>` : ''}`;
  } else {
    title = `${esc(set.name)}<small>Paketten çıkanlar · büyütmek için karta tıkla</small>`;
    sum = `Paket değeri: <b>${usd(total)}</b> · ${nNew} yeni kart${bonus ? ` · bonus <b>+${bonus}</b>` : ''}`;
  }
  const n = packs.length, cost = packCost(set);
  const againLabel = multi ? `Tekrar x${n}` : `Tekrar aç (${fmt(cost)})`;
  const bar = `<div class="reveal-bar" style="${multi ? 'margin:0 0 22px' : ''}">
      <span class="reveal-sum">${sum}</span>
      <button class="btn primary" id="againBtn" ${S.coins < cost ? 'disabled' : ''}>${againLabel}</button>
      <button class="btn" id="closeBtn">Kapat</button>
    </div>`;
  const grid = `<div class="reveal-grid">${shown.map((r, i) => cardHtml(r, i, true)).join('') || '<p class="muted">Dikkat çeken kart yok.</p>'}</div>`;
  ov.innerHTML = `<div class="${multi ? 'bulk-box' : ''}">
    ${god ? '<div class="god" style="text-align:center">✨ GOD PACK! ✨</div>' : ''}
    <div class="open-title">${title}</div>
    ${multi ? bar + grid : grid + bar}</div>`;
  ov.querySelector('.reveal-grid').addEventListener('click', e => {
    const el = e.target.closest('.card3d');
    if (el) openZoom(shown[+el.dataset.i].c);
  });
  $('#againBtn').addEventListener('click', () => openPacks(set, n));
  $('#closeBtn').addEventListener('click', closeOpening);
}
function closeOpening() {
  ov.classList.add('hidden');
  ov.innerHTML = '';
  revealState = null;
  refreshCurrent();
}

// ================= Büyük kart =================
const zoom = $('#zoom');
function openZoom(c) {
  const targetFor = DEX.filter(sp => sp.targets.includes(c)).map(sp => sp.name);
  const bi = bankInfo(c);
  zoom.innerHTML = `<div class="zoom-card"><img src="${imgLarge(c)}" onerror="this.onerror=null;this.src='${imgSmall(c)}'" alt=""><div class="shine"></div></div>
    <div class="zoom-info"><b>${esc(c.name)}</b> · ${esc(c.set.name)} #${esc(c.num)} · ${esc(c.rarity)}<br>
    Değer: <b>${usd(c.value)}</b>${c.price > 0 ? '' : ' (tahmini)'} · Sende: ${own(c.id)} ·
    ${bi.n ? `Pokébank: ${bi.n} adet × ${fmt(cardCoins(c))} jeton` : `<span class="muted">${esc(bi.why || 'Satılacak kopya yok')}</span>`}
    ${targetFor.length ? `<br><span style="color:var(--gold)">★ Pokédex hedefi: ${esc(targetFor.join(', '))}</span>` : ''}</div>`;
  zoom.classList.remove('hidden');
}
zoom.addEventListener('click', () => zoom.classList.add('hidden'));
zoom.addEventListener('mousemove', e => {
  const card = zoom.querySelector('.zoom-card');
  if (!card || S.settings.noanim) return;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  if (x < -0.3 || x > 1.3 || y < -0.3 || y > 1.3) { card.style.transform = ''; return; }
  card.style.transform = `rotateY(${(x - 0.5) * 18}deg) rotateX(${(0.5 - y) * 18}deg)`;
  card.style.setProperty('--mx', x * 100 + '%');
  card.style.setProperty('--my', y * 100 + '%');
});

// ================= Pokédex =================
let dexBuilt = false;
function initDex() {
  $('#dexGen').innerHTML += GENS.map((g, i) => `<option value="${i + 1}">${i + 1}. nesil (#${g[0]}-${g[1]})</option>`).join('');
  ['dexSearch', 'dexFilter', 'dexGen'].forEach(id => $('#' + id).addEventListener('input', renderDex));
  $('#dexGrid').addEventListener('click', e => {
    const cell = e.target.closest('.dex-cell');
    if (cell) openSpecies(+cell.dataset.n);
  });
}
function showcaseCard(sp) {
  return sp.cards.find(c => c.illus && own(c.id)) || sp.cards.find(c => own(c.id)) || null;   // kartlar değere göre sıralı
}
function renderDex() {
  const grid = $('#dexGrid');
  if (!dexBuilt) {
    grid.innerHTML = DEX.map(sp => `<div class="dex-cell" data-n="${sp.n}">
      <span class="dex-no">#${String(sp.n).padStart(4, '0')}</span>
      <span class="dex-tag">${sp.mode === 'illus' ? '<b class="tag-ir">IR</b>' : '<b class="tag-best">$</b>'}</span>
      <div class="dex-art"><img loading="lazy" src="${CFG.SPRITE(sp.n)}" alt=""></div>
      <span class="dex-name">${esc(sp.name)}</span>
      <span class="dex-val"></span></div>`).join('');
    dexBuilt = true;
  }
  const q = $('#dexSearch').value.trim().toLowerCase();
  const f = $('#dexFilter').value, gen = +$('#dexGen').value;
  const cells = grid.children;
  let shown = 0;
  for (let i = 0; i < DEX.length; i++) {
    const sp = DEX[i], st = spState(sp), cell = cells[i];
    cell.className = 'dex-cell s' + st;
    // Bulunan Pokémon'da sprite yerine kartı sergile: sahip olunan illustration kartı, yoksa en değerli kart
    const dc = showcaseCard(sp), key = dc ? dc.id : '';
    if (cell.dataset.shown !== key) {
      cell.dataset.shown = key;
      const img = cell.querySelector('.dex-art img');
      img.src = dc ? imgSmall(dc) : CFG.SPRITE(sp.n);
      cell.classList.toggle('has-card', !!dc);
      cell.querySelector('.dex-val').textContent = dc
        ? `${dc.illus ? (dc.sir ? 'Special Illus.' : 'Illustration') : dc.rarity} · ${usd(dc.value)}`
        : (sp.mode === 'illus' ? `${sp.targets.length} illustration` : `en değerli: ${usd(sp.best.value)}`);
    } else cell.classList.toggle('has-card', !!dc);
    let vis = true;
    if (q && !(sp.name.toLowerCase().includes(q) || String(sp.n) === q)) vis = false;
    if (gen && (sp.n < GENS[gen - 1][0] || sp.n > GENS[gen - 1][1])) vis = false;
    if (f === 'missing' && st !== 0) vis = false;
    if (f === 'owned' && st !== 1) vis = false;
    if (f === 'master' && st !== 2) vis = false;
    if (f === 'illus' && sp.mode !== 'illus') vis = false;
    if (f === 'best' && sp.mode !== 'best') vis = false;
    cell.style.display = vis ? '' : 'none';
    if (vis) shown++;
  }
  $('#dexCount').textContent = `${shown} Pokémon gösteriliyor`;
}

const modal = $('#modal');
function closeModal() { modal.classList.add('hidden'); $('#modalBox').innerHTML = ''; }
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

function miniCard(c, opts = {}) {
  const n = own(c.id), isT = isTargetCard(c);
  return `<div class="ccard ${n ? '' : 'unowned'} ${c.illus ? 'is-illus' : ''} ${isT ? 'is-target' : ''}" data-id="${esc(c.id)}">
    <div class="cimg" data-name="${esc(c.name)}"><img loading="lazy" src="${imgSmall(c)}" alt="" onerror="this.classList.add('broken');this.parentNode.classList.add('noimg')"></div>
    ${n > 1 || (n && opts.showOne) ? `<span class="count">x${n}</span>` : ''}
    ${c.illus ? '<b class="tag-ir ir-tag">IR</b>' : ''}
    ${isT ? '<span class="best-tag">★</span>' : ''}
    <div class="cname" title="${esc(c.name)}">${esc(c.name)}</div>
    <div class="cmeta" title="${esc(c.set.name)} · ${esc(c.rarity)}">${esc(c.set.name)} · ${esc(c.rarity)}</div>
    <div class="crow"><b>${usd(c.value)}</b>${opts.action ? opts.action(c, n) : ''}</div>
  </div>`;
}

function openSpecies(n) {
  const sp = SPECIES[n];
  const st = spState(sp);
  const chips = ['Kartı yok', 'Kartı var · hedef eksik', '★ Pokédex tamamlandı'];
  const ownedCount = sp.cards.filter(c => own(c.id)).length;
  const packBtn = c2 => `<button class="btn" data-openset="${c2.set.i}" title="${esc(c2.set.name)} paketi aç">Paket</button>`;
  const others = sp.cards.filter(c => !sp.targets.includes(c));
  const head = sp.mode === 'illus'
    ? `<h3 style="color:var(--gold)">★ Hedef: illustration kartlarından herhangi biri (${sp.targets.filter(c => own(c.id)).length}/${sp.targets.length} sende)</h3>
       <p class="muted">Bu kartlar paketlerdeki özel illustration slotundan çıkar (Illustration Rare ~1/${Math.round(1 / CFG.ILLUS_RATE)}, Special ~1/${Math.round(1 / CFG.SPECIAL_ILLUS_RATE)} paket).</p>`
    : `<h3 style="color:var(--gold)">★ Hedef: en değerli kart</h3>
       <p class="muted">Bu Pokémon'un henüz illustration kartı yok, bu yüzden Pokédex hedefi en değerli kartı.</p>`;
  $('#modalBox').innerHTML = `<button class="close-x" data-close>×</button>
    <div class="sp-head"><img src="${CFG.SPRITE(sp.n)}" alt="">
      <div><div class="muted">#${String(sp.n).padStart(4, '0')}</div><h2>${esc(sp.name)}</h2>
      <span class="chip c${st}">${chips[st]}</span> <span class="muted">${ownedCount}/${sp.cards.length} kartı sende</span></div></div>
    <div class="sp-best" style="display:block">${head}
      <div class="card-grid">${sp.targets.map(c => miniCard(c, { showOne: true, action: packBtn })).join('')}</div>
    </div>
    ${others.length ? `<h3>Diğer kartları (${others.length}) <span class="muted" style="font-weight:400;font-size:13px">değere göre</span></h3>
    <div class="card-grid">${others.map(c => miniCard(c, { showOne: true, action: packBtn })).join('')}</div>` : ''}`;
  modal.classList.remove('hidden');
  modal.scrollTop = 0;
}
$('#modalBox').addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return closeModal();
  const os = e.target.closest('[data-openset]');
  if (os) { closeModal(); return openPacks(SETS[+os.dataset.openset], 1); }
  const z = e.target.closest('.cimg');
  if (z) openZoom(BY_ID.get(z.closest('.ccard').dataset.id));
});

// ================= Trainer destesi =================
let trainerBuilt = false;
const trainerShowcase = t => t.cards.find(c => c.illus && own(c.id)) || t.cards.find(c => own(c.id)) || null;
function initTrainers() {
  ['trSearch', 'trFilter', 'trType'].forEach(id => $('#' + id).addEventListener('input', renderTrainers));
  $('#trGrid').addEventListener('click', e => {
    const cell = e.target.closest('.dex-cell');
    if (cell) openTrainer(+cell.dataset.t);
  });
}
function renderTrainers() {
  const grid = $('#trGrid');
  if (!trainerBuilt) {
    grid.innerHTML = TRAINERS.map(t => `<div class="dex-cell tr-cell" data-t="${t.i}">
      <span class="dex-no">${esc(TRAINER_TYPES[t.sub] || 'Trainer')}</span>
      <span class="dex-tag">${t.mode === 'illus' ? '<b class="tag-ir">IR</b>' : '<b class="tag-best">$</b>'}</span>
      <div class="dex-art"><img loading="lazy" src="${imgSmall(t.best)}" alt=""></div>
      <span class="dex-name" title="${esc(t.name)}">${esc(t.name)}</span>
      <span class="dex-val"></span></div>`).join('');
    trainerBuilt = true;
  }
  const q = $('#trSearch').value.trim().toLowerCase(), f = $('#trFilter').value, type = $('#trType').value;
  const cells = grid.children;
  let shown = 0, done = 0, owned = 0;
  for (let i = 0; i < TRAINERS.length; i++) {
    const t = TRAINERS[i], st = trState(t), cell = cells[i];
    if (st) owned++;
    if (st === 2) done++;
    cell.className = 'dex-cell tr-cell s' + st;
    const dc = trainerShowcase(t), key = dc ? dc.id : '';
    if (cell.dataset.shown !== key) {
      cell.dataset.shown = key;
      cell.querySelector('.dex-art img').src = imgSmall(dc || t.best);
      cell.querySelector('.dex-val').textContent = dc
        ? `${dc.illus ? (dc.sir ? 'Special Illus.' : 'Illustration') : dc.rarity} · ${usd(dc.value)}`
        : (t.mode === 'illus' ? `${t.targets.length} illustration` : `en değerli: ${usd(t.best.value)}`);
    }
    cell.classList.toggle('has-card', !!dc);
    let vis = true;
    if (q && !t.name.toLowerCase().includes(q)) vis = false;
    if (type && t.sub !== type) vis = false;
    if (f === 'missing' && st !== 0) vis = false;
    if (f === 'owned' && st !== 1) vis = false;
    if (f === 'master' && st !== 2) vis = false;
    if (f === 'illus' && t.mode !== 'illus') vis = false;
    cell.style.display = vis ? '' : 'none';
    if (vis) shown++;
  }
  $('#trCount').textContent = `${shown} trainer gösteriliyor`;
  $('#trProgress').innerHTML = `
    <div class="stat"><b>${done}/${TRAINERS.length}</b><span>tamamlanan trainer</span></div>
    <div class="stat"><b>${owned}/${TRAINERS.length}</b><span>en az bir kartı olan</span></div>
    <div class="stat"><b>${TRAINERS.filter(t => t.mode === 'illus' && isTrainerComplete(t)).length}/${TRAINERS.filter(t => t.mode === 'illus').length}</b><span>illustration ile tamamlanan</span></div>`;
}
function openTrainer(i) {
  const t = TRAINERS[i], st = trState(t);
  const chips = ['Kartı yok', 'Kartı var · hedef eksik', '★ Destede tamamlandı'];
  const packBtn = c2 => `<button class="btn" data-openset="${c2.set.i}" title="${esc(c2.set.name)} paketi aç">Paket</button>`;
  const others = t.cards.filter(c => !t.targets.includes(c));
  const head = t.mode === 'illus'
    ? `<h3 style="color:var(--gold)">★ Hedef: illustration kartlarından herhangi biri (${t.targets.filter(c => own(c.id)).length}/${t.targets.length} sende)</h3>
       <p class="muted">Bu kartlar paketlerdeki özel illustration slotundan çıkar.</p>`
    : `<h3 style="color:var(--gold)">★ Hedef: en değerli kart</h3>
       <p class="muted">Bu trainer'ın illustration kartı yok, bu yüzden hedef en değerli kartı.</p>`;
  $('#modalBox').innerHTML = `<button class="close-x" data-close>×</button>
    <div class="sp-head"><div><div class="muted">${esc(TRAINER_TYPES[t.sub] || 'Trainer')}</div><h2>${esc(t.name)}</h2>
      <span class="chip c${st}">${chips[st]}</span> <span class="muted">${t.cards.filter(c => own(c.id)).length}/${t.cards.length} kartı sende</span></div></div>
    <div class="sp-best" style="display:block">${head}
      <div class="card-grid">${t.targets.map(c => miniCard(c, { showOne: true, action: packBtn })).join('')}</div>
    </div>
    ${others.length ? `<h3>Diğer baskıları (${others.length}) <span class="muted" style="font-weight:400;font-size:13px">değere göre</span></h3>
    <div class="card-grid">${others.map(c => miniCard(c, { showOne: true, action: packBtn })).join('')}</div>` : ''}`;
  modal.classList.remove('hidden');
  modal.scrollTop = 0;
}

// ================= Ortak: sayfalama =================
function pagerHtml(page, pages) {
  if (pages <= 1) return '';
  const btn = (p, label) => `<button class="btn" data-page="${p}" ${p === page ? 'disabled' : ''}>${label}</button>`;
  return btn(Math.max(0, page - 1), '‹') + ` <span class="muted">Sayfa ${page + 1} / ${pages}</span> ` + btn(Math.min(pages - 1, page + 1), '›');
}
const recentSort = (a, b) => (S.got[b.id] || 0) - (S.got[a.id] || 0);

// ================= Koleksiyon =================
let collPage = 0;
function initColl() {
  ['collSearch', 'collFilter', 'collSort'].forEach(id => $('#' + id).addEventListener('input', () => { collPage = 0; renderColl(); }));
  $('#collGrid').addEventListener('click', e => {
    const card = e.target.closest('.ccard');
    if (card && e.target.closest('.cimg')) openZoom(BY_ID.get(card.dataset.id));
  });
  $('#collPager').addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (b) { collPage = +b.dataset.page; renderColl(); window.scrollTo(0, 0); }
  });
}
function renderColl() {
  let cards = Object.keys(S.owned).map(id => BY_ID.get(id)).filter(Boolean);
  let totalVal = 0, totalCount = 0, illus = 0;
  for (const c of cards) { totalVal += c.value * own(c.id); totalCount += own(c.id); if (c.illus) illus++; }
  const allIllus = CARDS.filter(c => c.illus).length;
  $('#collStats').innerHTML = `
    <div class="stat"><b>${fmt(cards.length)}</b><span>farklı kart / ${fmt(CARDS.length)}</span></div>
    <div class="stat"><b>${fmt(illus)}</b><span>illustration kart / ${fmt(allIllus)}</span></div>
    <div class="stat"><b>${fmt(totalCount)}</b><span>toplam kart</span></div>
    <div class="stat"><b>${usd(totalVal)}</b><span>koleksiyon değeri</span></div>`;
  const q = $('#collSearch').value.trim().toLowerCase(), f = $('#collFilter').value, sort = $('#collSort').value;
  cards = cards.filter(c => {
    if (q && !(c.name.toLowerCase().includes(q) || c.set.name.toLowerCase().includes(q))) return false;
    if (f === 'dup' && own(c.id) < 2) return false;
    if (f === 'illus' && !c.illus) return false;
    if (f === 'best' && !TARGET_IDS.has(c.id)) return false;
    if (f === 'poke' && c.st !== 0) return false;
    if (f === 'trainer' && c.st === 0) return false;
    return true;
  });
  const sorters = {
    value: (a, b) => b.value - a.value,
    recent: recentSort,
    dex: (a, b) => (a.dex[0] || 9999) - (b.dex[0] || 9999) || b.value - a.value,
    set: (a, b) => b.set.date.localeCompare(a.set.date) || a.num.localeCompare(b.num, undefined, { numeric: true }),
    count: (a, b) => own(b.id) - own(a.id),
  };
  cards.sort(sorters[sort]);
  const pages = Math.max(1, Math.ceil(cards.length / CFG.PAGE_SIZE));
  collPage = Math.min(collPage, pages - 1);
  $('#collGrid').innerHTML = cards.slice(collPage * CFG.PAGE_SIZE, (collPage + 1) * CFG.PAGE_SIZE).map(c => miniCard(c)).join('')
    || '<p class="muted">Henüz kart yok. "Paket Aç" sekmesinden başla!</p>';
  $('#collPager').innerHTML = pagerHtml(collPage, pages);
}

// ================= Pokébank =================
let bankPage = 0;
function bankList() {
  const out = [];
  for (const id in S.owned) {
    const c = BY_ID.get(id);
    if (!c) continue;
    const n = bankInfo(c).n;
    if (n > 0) out.push({ c, n });
  }
  return out;
}
function initBank() {
  $('#bankRate').textContent = CFG.SELL_PER_USD;
  $('#bankMin').textContent = CFG.BANK_MIN_VALUE.toFixed(2);
  ['bankSearch', 'bankFilter', 'bankSort'].forEach(id => $('#' + id).addEventListener('input', () => { bankPage = 0; renderBank(); }));
  $('#bankGrid').addEventListener('click', e => {
    const card = e.target.closest('.ccard');
    if (!card) return;
    const c = BY_ID.get(card.dataset.id);
    const b = e.target.closest('[data-sell]');
    if (b) {
      const k = b.dataset.sell === 'all' ? bankInfo(c).n : 1;
      const g = bankSell(c, k);
      if (g) { SFX.play(k > 1 ? 'coins' : 'coin'); toast(`🏦 ${k} × ${esc(c.name)} satıldı: +${fmt(g)} jeton`); }
      save(); updateHud(); renderBank();
    } else if (e.target.closest('.cimg')) openZoom(c);
  });
  $('#bankPager').addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (b) { bankPage = +b.dataset.page; renderBank(); window.scrollTo(0, 0); }
  });
  $('#bankSellAll').addEventListener('click', () => {
    const list = filteredBank();
    const total = list.reduce((s, x) => s + x.n * cardCoins(x.c), 0), n = list.reduce((s, x) => s + x.n, 0);
    if (!n) return toast('Satılabilir kart yok.');
    if (!confirm(`Listedeki ${n} kart Pokébank'a satılacak. Kazanç: ${fmt(total)} jeton. Onaylıyor musun?`)) return;
    for (const x of list) bankSell(x.c, x.n);
    SFX.play('coins');
    toast(`🏦 ${n} kart satıldı: +${fmt(total)} jeton`, 'gold');
    save(); updateHud(); renderBank();
  });
}
function filteredBank() {
  const q = $('#bankSearch').value.trim().toLowerCase(), f = $('#bankFilter').value;
  return bankList().filter(({ c }) => {
    if (q && !(c.name.toLowerCase().includes(q) || c.set.name.toLowerCase().includes(q))) return false;
    if (f === 'illus' && !c.illus) return false;
    if (f === 'normal' && c.illus) return false;
    return true;
  });
}
function renderBank() {
  const all = bankList();
  $('#bankSum').textContent = fmt(all.reduce((s, x) => s + x.n * cardCoins(x.c), 0));
  const list = filteredBank();
  const sort = $('#bankSort').value;
  const sorters = {
    value: (a, b) => b.c.value - a.c.value,
    total: (a, b) => b.n * b.c.value - a.n * a.c.value,
    recent: (a, b) => recentSort(a.c, b.c),
  };
  list.sort(sorters[sort]);
  $('#bankSellAll').textContent = list.length === all.length ? 'Hepsini sat' : `Listedekileri sat (${list.length})`;
  const pages = Math.max(1, Math.ceil(list.length / CFG.PAGE_SIZE));
  bankPage = Math.min(bankPage, pages - 1);
  $('#bankGrid').innerHTML = list.slice(bankPage * CFG.PAGE_SIZE, (bankPage + 1) * CFG.PAGE_SIZE).map(({ c, n }) => miniCard(c, {
    showOne: true,
    action: () => `<span class="sell-btns"><button class="btn" data-sell="1">Sat +${fmt(cardCoins(c))}</button>${n > 1 ? `<button class="btn" data-sell="all" title="Satılabilir ${n} kopyanın hepsi">x${n}</button>` : ''}</span>`,
  })).join('') || '<p class="muted">Pokébank\'ın alabileceği kart yok. Rare ve üstü, $' + CFG.BANK_MIN_VALUE.toFixed(2) + ' üzeri kartlar ve illustration kopyaları burada görünür.</p>';
  $('#bankPager').innerHTML = pagerHtml(bankPage, pages);
}

// ================= Ayarlar =================
function initSettings() {
  $('#optNoAnim').addEventListener('change', e => { S.settings.noanim = e.target.checked; applySettings(); save(); });
  $('#optSound').addEventListener('change', e => { S.settings.muted = !e.target.checked; applySettings(); save(); });
  $('#optVolume').addEventListener('input', e => {
    S.settings.volume = +e.target.value;
    $('#optVolumeVal').textContent = S.settings.volume;
    applySettings(); save();
  });
  $('#optVolume').addEventListener('change', () => SFX.play('test'));
  $('#soundTest').addEventListener('click', () => SFX.play('illus'));
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pokekart-kayit-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(t => {
      const d = JSON.parse(t);
      if (!d || typeof d.owned !== 'object') throw new Error('Geçersiz dosya');
      S = loadState(d);
      save(); applySettings(); updateHud(); renderSettings();
      toast('Kayıt yüklendi!', 'gold');
    }).catch(err => toast('Yüklenemedi: ' + esc(err.message), 'err'));
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', resetGame);
}
function resetGame() {
  if (!confirm('Tüm koleksiyon, jetonlar, iş seviyeleri ve istatistikler silinecek. Emin misin?')) return;
  if (!confirm('Gerçekten emin misin? Bu geri alınamaz!')) return;
  S = newState(); saveNow(); applySettings(); updateHud(); refreshCurrent();
  toast(`Oyun sıfırlandı. ${fmt(CFG.START_COINS)} jetonla yeniden başlıyorsun.`, 'gold');
}
function renderSettings() {
  $('#optNoAnim').checked = !!S.settings.noanim;
  $('#optSound').checked = !S.settings.muted;
  $('#optVolume').value = S.settings.volume;
  $('#optVolumeVal').textContent = S.settings.volume;
  const withPrice = CARDS.filter(c => c.price > 0).length;
  const illusSp = DEX.filter(sp => sp.mode === 'illus').length;
  $('#dataInfo').innerHTML = `Veri tarihi: <b>${esc(D.generated)}</b> · ${fmt(CARDS.length)} kart · ${SHOP_SETS.length} set · ${DEX.length} Pokémon (${illusSp} tanesinin illustration kartı var) · fiyatı bilinen kart: ${fmt(withPrice)}`;
}
function applySettings() {
  document.body.classList.toggle('noanim', !!S.settings.noanim);
  SFX.setVolume(S.settings.volume / 100);
  SFX.setMuted(S.settings.muted);
  const b = $('#hudMute');
  b.textContent = S.settings.muted || !S.settings.volume ? '🔇' : '🔊';
  b.title = S.settings.muted ? 'Sesi aç' : 'Sesi kapat';
}

// ================= İstatistikler =================
function statBox(value, label, sub) {
  return `<div class="stat"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
}
function progRow(label, have, total, extra) {
  const p = total ? have / total * 100 : 0;
  return `<div class="prow"><span class="pl">${label}</span><div class="prog"><div style="width:${p}%"></div></div><span class="pv">${have}/${total} <small>%${p.toFixed(1)}</small>${extra || ''}</span></div>`;
}
function renderStats() {
  const st = S.stats;
  const ownedCards = Object.keys(S.owned).map(id => BY_ID.get(id)).filter(Boolean);
  const totalCards = ownedCards.reduce((s, c) => s + own(c.id), 0);
  const value = ownedCards.reduce((s, c) => s + c.value * own(c.id), 0);
  const allIr = CARDS.filter(c => c.illus && !c.sir).length, allSir = CARDS.filter(c => c.sir).length;
  const ownIr = ownedCards.filter(c => c.illus && !c.sir).length, ownSir = ownedCards.filter(c => c.sir).length;
  let done = 0, owned = 0, doneIllus = 0, doneBest = 0;
  const illusSp = DEX.filter(sp => sp.mode === 'illus'), bestSp = DEX.filter(sp => sp.mode === 'best');
  for (const sp of DEX) { const s = spState(sp); if (s) owned++; if (s === 2) { done++; if (sp.mode === 'illus') doneIllus++; else doneBest++; } }
  const bestOwned = DEX.filter(sp => own(sp.best.id)).length;
  const bp = st.bestPull && BY_ID.get(st.bestPull);
  const top = ownedCards.slice().sort((a, b) => b.value - a.value).slice(0, 12);
  const genRows = GENS.map((g, i) => {
    const list = DEX.filter(sp => sp.n >= g[0] && sp.n <= g[1]);
    return progRow(`${i + 1}. nesil`, list.filter(sp => spState(sp) === 2).length, list.length);
  }).join('');
  const setRows = SHOP_SETS.filter(s => s.illusCount).sort((a, b) => b.date.localeCompare(a.date)).map(s => {
    const illus = s.cards.filter(c => c.illus);
    return progRow(esc(s.name), illus.filter(c => own(c.id)).length, illus.length);
  }).join('');
  $('#statsMain').innerHTML = `
    <h3>Genel</h3>
    <div class="coll-stats">
      ${statBox(fmt(st.packs), 'açılan paket')}
      ${statBox(fmt(st.cardsOpened), 'açılan kart')}
      ${statBox(fmt(st.illusPulled), 'çıkan illustration', `${fmt(st.sirPulled)} tanesi Special`)}
      ${statBox(fmt(st.godPacks || 0), 'god pack')}
      ${statBox(fmt(S.coins), 'jeton')}
    </div>
    <h3>Pokédex</h3>
    <div class="coll-stats">
      ${statBox(`${done}/${DEX.length}`, 'tamamlanan Pokémon', `%${(done / DEX.length * 100).toFixed(1)}`)}
      ${statBox(`${doneIllus}/${illusSp.length}`, 'illustration ile tamamlanan')}
      ${statBox(`${doneBest}/${bestSp.length}`, 'en değerli kartla tamamlanan')}
      ${statBox(`${owned}/${DEX.length}`, 'en az bir kartı olan')}
      ${statBox(`${bestOwned}/${DEX.length}`, 'en değerli kartı sende olan')}
    </div>
    <h3>Trainer destesi</h3>
    <div class="coll-stats">
      ${statBox(`${TRAINERS.filter(isTrainerComplete).length}/${TRAINERS.length}`, 'tamamlanan trainer')}
      ${statBox(`${TRAINERS.filter(t => t.mode === 'illus' && isTrainerComplete(t)).length}/${TRAINERS.filter(t => t.mode === 'illus').length}`, 'illustration ile tamamlanan')}
      ${statBox(`${TRAINERS.filter(trainerOwned).length}/${TRAINERS.length}`, 'en az bir kartı olan')}
      ${statBox(`${fmt(ownedCards.filter(c => c.st === 1).length)}/${fmt(CARDS.filter(c => c.st === 1).length)}`, 'farklı trainer kartı')}
    </div>
    <h3>Koleksiyon</h3>
    <div class="coll-stats">
      ${statBox(`${fmt(ownIr + ownSir)}/${fmt(allIr + allSir)}`, 'farklı illustration kart')}
      ${statBox(`${fmt(ownIr)}/${fmt(allIr)}`, 'Illustration Rare')}
      ${statBox(`${fmt(ownSir)}/${fmt(allSir)}`, 'Special Illustration Rare')}
      ${statBox(`${fmt(ownedCards.length)}/${fmt(CARDS.length)}`, 'farklı kart')}
      ${statBox(fmt(totalCards), 'toplam kart')}
      ${statBox(usd(value), 'koleksiyon değeri')}
    </div>
    <h3>Ekonomi ve iş</h3>
    <div class="coll-stats">
      ${statBox(fmt(st.salary), 'işten kazanılan', `tıklama ${fmt(st.clickEarned)} · pasif ${fmt(st.idleEarned)}`)}
      ${statBox(fmt(st.clicks), 'toplam tıklama')}
      ${statBox(`+${fmtRate(totalCps())}/sn`, 'pasif gelir', `tıklama başı ${fmtRate(clickValue())}`)}
      ${statBox(fmt(HELPERS.reduce((s, h) => s + helperCount(h), 0)), 'yardımcı', `${UPGRADES.filter(u => hasUpgrade(u.id)).length} yükseltme`)}
      ${statBox(fmt(st.shinies || 0), 'yakalanan shiny')}
      ${statBox(fmt(st.earned), 'Pokébank satışı')}
    </div>
    <div class="stats-cols">
      <div class="panel"><h2>Nesillere göre Pokédex</h2>${genRows}</div>
      <div class="panel"><h2>Setlere göre illustration</h2><div class="set-rows">${setRows}</div></div>
    </div>
    <h3>En değerli kartların</h3>
    ${bp ? `<p class="muted">Bugüne kadarki en değerli çekiliş: <b style="color:var(--yellow)">${esc(bp.name)}</b> (${esc(bp.set.name)}) · ${usd(bp.value)}</p>` : ''}
    <div class="card-grid" id="statsTop">${top.map(c => miniCard(c)).join('') || '<p class="muted">Henüz kart yok.</p>'}</div>
    <div class="danger-zone">
      <div><b>Kaydı sıfırla</b><br><span class="muted">Tüm kartlar, jetonlar, iş seviyeleri ve istatistikler silinir; oyun ${fmt(CFG.START_COINS)} jetonla baştan başlar.</span></div>
      <button class="btn danger" data-reset>Kaydı sıfırla</button>
    </div>`;
}

// ================= Klavye =================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!zoom.classList.contains('hidden')) return zoom.classList.add('hidden');
    if (!modal.classList.contains('hidden')) return closeModal();
    if (revealState && revealState.stage === 'done') return closeOpening();
  }
  if ((e.key === ' ' || e.key === 'Enter') && revealState && zoom.classList.contains('hidden')) {
    e.preventDefault();
    if (revealState.stage === 'pack') tearPack();
    else if (revealState.stage === 'cards') stackStep();
    else if (revealState.stage === 'done' && e.key === ' ') { const b = $('#againBtn'); if (b && !b.disabled) b.click(); }
  }
});

// ================= Başlat =================
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
$('#hudJob').addEventListener('click', () => showTab('job'));
$('#hudMute').addEventListener('click', () => {
  S.settings.muted = !S.settings.muted;
  if (!S.settings.muted && !S.settings.volume) S.settings.volume = 60;
  applySettings(); save();
  if (currentTab === 'settings') renderSettings();
  SFX.play('coin');
});
$('#jobMain').addEventListener('click', e => {
  const h = e.target.closest('[data-buy-helper]');
  if (h) return buyHelper(h.dataset.buyHelper, +h.dataset.n || 1);
  const u = e.target.closest('[data-buy-upgrade]');
  if (u) return buyUpgrade(u.dataset.buyUpgrade);
  if (e.target.closest('#workScene')) clickWork(e);
});
$('#statsMain').addEventListener('click', e => {
  if (e.target.closest('[data-reset]')) return resetGame();
  const c = e.target.closest('.ccard');
  if (c) openZoom(BY_ID.get(c.dataset.id));
});
initShop(); initDex(); initTrainers(); initColl(); initBank(); initSettings();
applySettings();
updateHud();
showTab('shop');
const offlineGain = accrueIdle();
updateHud();
setInterval(tickJob, 1000);
setInterval(save, 30000);
if (firstRun) toast(`Hoş geldin! ${fmt(CFG.START_COINS)} jetonla (10 paket) başlıyorsun. Para bitince İş sekmesinde tıklayarak kazan. Hedef: her Pokémon'un illustration kartını toplamak!`, 'gold');
else if (offlineGain >= 1) toast(`💼 Sen yokken yardımcıların <b>${fmt(offlineGain)}</b> jeton kazandı.`, 'gold');
save();
})();
