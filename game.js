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
  // mesai seçenekleri: süre (dk) ve maaş çarpanı (uzun mesai daha kârlı)
  SHIFTS: [{ min: 5, mult: 1 }, { min: 15, mult: 1.2 }, { min: 30, mult: 1.4 }, { min: 60, mult: 1.7 }],
  // mesai sırasında sahneye tıklamak: her tıklama süreyi biraz kısaltır, maaşı biraz artırır (mesai başına sınırlı)
  CLICK_TIME_PCT: 0.003,      // tıklama başı mesai süresinin %0,3'ü kadar kısalma
  CLICK_PAY_PCT: 0.0025,      // tıklama başı temel maaşın %0,25'i kadar artış
  CLICK_MAX_TIME_PCT: 0.25,   // mesai başına en fazla %25 kısalma
  CLICK_MAX_PAY_PCT: 0.2,     // mesai başına en fazla %20 ek maaş
  CLICK_MIN_INTERVAL: 160,    // ms; bundan hızlı tıklamalar sayılmaz
  JOB_LEVEL_MINUTES: 60,      // her 60 dakika çalışma = 1 seviye
  JOB_MAX_LEVEL: 10,
  JOB_LEVEL_BONUS: 0.1,       // her seviye +%10 maaş
  BULK_COUNT: 10,
  PAGE_SIZE: 60,
  IMG_BASE: 'https://images.pokemontcg.io/',
  SPRITE: n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${n}.png`,
  ANIM_SPRITE: n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${n}.gif`,
};
const SAVE_KEY = 'pokekart_save_v1';

// İşler: req = gereken tamamlanmış Pokédex sayısı, rate = dakika başı temel değer (mesai maaşı bundan hesaplanır)
// scene = çalışma sahnesinin arka planı, icons = sahnede uçuşan nesneler, status = sırayla değişen durum yazıları
const JOBS = [
  { id: 'center', name: 'Pokémon Center Stajyeri', desc: "Nurse Joy'a yardım et, yorgun Pokémon'ları iyileştir.", sprite: 113, rate: 12, req: 0,
    scene: 'linear-gradient(#f7c6d9, #fde8f0)', icons: ['💊', '❤️', '🩹', '✨', '💉'],
    status: ["Yorgun Pokémon'lar iyileştiriliyor...", 'Potion şişeleri dolduruluyor...', 'Hasta kayıtları tutuluyor...', "Nurse Joy'a yardım ediliyor..."] },
  { id: 'berry', name: 'Berry Çiftçisi', desc: 'Berry tarlasını sula, olgunlaşanları topla.', sprite: 357, rate: 20, req: 15,
    scene: 'linear-gradient(#9fd8ff, #d9f2ff 60%)', icons: ['🍓', '🍇', '🍒', '💧', '🌱', '🍑'],
    status: ['Tarla sulanıyor...', 'Olgun berry\'ler toplanıyor...', 'Yeni tohumlar ekiliyor...', 'Sepetler dolduruluyor...'] },
  { id: 'mart', name: 'PokéMart Kasiyeri', desc: 'Poké Ball ve Potion sat, rafları düzenle.', sprite: 52, rate: 32, req: 40,
    scene: 'linear-gradient(#bcd7f5, #eaf3ff)', icons: ['🛒', '🧪', '💰', '🏷️', '📦'],
    status: ['Müşterilere Poké Ball satılıyor...', 'Raflar düzenleniyor...', 'Kasa sayılıyor...', 'Yeni ürünler diziliyor...'] },
  { id: 'lab', name: 'Profesör Asistanı', desc: 'Laboratuvarda Pokédex verilerini derle.', sprite: 137, rate: 50, req: 90,
    scene: 'linear-gradient(#cfe9e4, #f2fbf9)', icons: ['🔬', '📘', '🧬', '💡', '🧪'],
    status: ['Pokédex verileri derleniyor...', 'Numuneler inceleniyor...', 'Rapor yazılıyor...', 'Deney sonuçları kaydediliyor...'] },
  { id: 'gym', name: 'Gym Lideri', desc: 'Meydan okuyan antrenörlerle savaş, rozet dağıt.', sprite: 68, rate: 80, req: 180,
    scene: 'linear-gradient(#f5d6a8, #fff1dc)', icons: ['🏅', '⚡', '🔥', '💥', '💪'],
    status: ['Meydan okuyan antrenörle savaşılıyor...', 'Rozet hazırlanıyor...', 'Takım antrenmanı yapılıyor...', 'Gym temizleniyor...'] },
  { id: 'elite', name: 'Elite Four Üyesi', desc: 'Ligin en güçlü antrenörlerinden biri ol.', sprite: 448, rate: 120, req: 300,
    scene: 'linear-gradient(#c9b8f0, #ece6ff)', icons: ['⚔️', '🔥', '💎', '⭐', '🌀'],
    status: ['Lig maçı oynanıyor...', 'Rakip takımlar analiz ediliyor...', 'Özel antrenman yapılıyor...', 'Taraftarlar selamlanıyor...'] },
  { id: 'champ', name: 'Şampiyon', desc: 'Bölgenin şampiyonu olarak unvanını koru.', sprite: 149, rate: 190, req: 450,
    scene: 'linear-gradient(#ffe08a, #fff6d6)', icons: ['👑', '🏆', '⭐', '🎉', '✨'],
    status: ['Şampiyonluk unvanı korunuyor...', 'Basın toplantısı yapılıyor...', 'Genç antrenörlere ders veriliyor...', 'Kupa parlatılıyor...'] },
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
    job: { id: 'center', working: false, start: 0, dur: 0, pay: 0, xp: {} },
    stats: { packs: 0, cardsOpened: 0, illusPulled: 0, sirPulled: 0, earned: 0, salary: 0, workMinutes: 0, shifts: 0, bestPull: null, godPacks: 0 },
    settings: { noanim: false, volume: 60, muted: false } };
}
function loadState(d) {
  const st = Object.assign(newState(), d);
  st.job = Object.assign(newState().job, d.job || {});
  st.stats = Object.assign(newState().stats, d.stats || {});
  st.settings = Object.assign(newState().settings, d.settings || {});
  // eski kayıtlar: ücretsiz paket / kasa sistemi kaldırıldı, kasada kalan maaş jetona eklenir
  if (st.job.kasa > 0) { st.coins += Math.floor(st.job.kasa); st.stats.salary += Math.floor(st.job.kasa); }
  delete st.job.kasa; delete st.job.ts; delete st.freePacks; delete st.freeTs; delete st.lastDaily;
  if (!d.stats || d.stats.cardsOpened == null) st.stats.cardsOpened = st.stats.packs * 10;
  // eski süresiz mesai: çalışılan süreyi (en fazla 8 saat) ödeyip kapat
  if (st.job.working && !st.job.dur) {
    const min = Math.min(480, Math.max(0, (Date.now() - st.job.start) / 60000)), pay = Math.floor(min * 8);
    st.coins += pay; st.stats.salary += pay;
    Object.assign(st.job, { working: false, start: 0, dur: 0, pay: 0 });
  }
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
  if (S.job.working) { toast(`💼 Şu an işteyken paket açamazsın. Önce <b>İş</b> sekmesinden işten çık.`, 'err'); return; }
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
  if (prevDone) for (const j of JOBS) if (j.req > prevDone && j.req <= done) toast(`💼 Yeni iş açıldı: <b>${esc(j.name)}</b>!`, 'gold');
  updateJobHud();
  if (done === DEX.length && !S.stats.completed) {
    S.stats.completed = Date.now(); save();
    toast('🏆 TEBRİKLER! Pokédex tamamlandı!', 'gold');
  }
}

// ================= İş: mesai seç, bar dolana kadar bekle, maaşı al =================
// Her mesainin süresi ve toplam maaşı baştan bellidir. Bar dolunca maaş otomatik ödenir.
// İşteyken oyunda dolaşabilirsin ama paket açamazsın. Erken çıkarsan maaş alamazsın.
// Oyun kapalıyken de mesai devam eder; oyunu açtığında bitmişse maaş ödenir.
const jobById = id => JOBS.find(j => j.id === id) || JOBS[0];
const curJob = () => jobById(S.job.id);
const levelFromXp = xp => Math.min(CFG.JOB_MAX_LEVEL, 1 + Math.floor(xp / CFG.JOB_LEVEL_MINUTES));
const jobLevel = j => levelFromXp(S.job.xp[j.id] || 0);
const jobRate = j => j.rate * (1 + CFG.JOB_LEVEL_BONUS * (jobLevel(j) - 1));
const shiftPay = (j, sh) => Math.round(jobRate(j) * sh.min * sh.mult / 5) * 5;
const shiftElapsed = () => Date.now() - S.job.start + (S.job.boostMs || 0);   // tıklamalar süreyi öne çeker
const shiftProgress = () => S.job.working ? Math.min(1, Math.max(0, shiftElapsed() / (S.job.dur * 60000))) : 0;
const shiftTotalPay = () => (S.job.pay || 0) + Math.floor(S.job.bonus || 0);
const shiftLeftMin = () => S.job.working ? Math.max(0, S.job.dur - shiftElapsed() / 60000) : 0;
const clock = min => { const s = Math.ceil(min * 60); const h = Math.floor(s / 3600); return `${h ? h + ':' : ''}${String(Math.floor(s / 60) % 60).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`; };
const durLabel = min => min >= 60 ? `${min / 60} saat` : `${min} dk`;

function startShift(k) {
  if (S.job.working) return;
  if (revealState) return toast('Önce paket ekranını kapat.', 'err');
  const j = curJob(), sh = CFG.SHIFTS[k];
  Object.assign(S.job, { working: true, start: Date.now(), dur: sh.min, pay: shiftPay(j, sh), boostMs: 0, bonus: 0, clicks: 0 });
  save(); updateHud(); refreshCurrent();
  SFX.play('work');
  toast(`💼 İşe gittin: <b>${esc(j.name)}</b> · ${durLabel(sh.min)} sonra <b>${fmt(S.job.pay)}</b> jeton. İşteyken paket açamazsın.`, 'gold');
}
function completeShift(silent) {
  const j = curJob(), pay = shiftTotalPay(), lvlBefore = jobLevel(j);
  const bonusXp = (S.job.boostMs || 0) / 60000;   // tıklamayla kazanılan süre kadar ek deneyim
  S.job.xp[j.id] = (S.job.xp[j.id] || 0) + S.job.dur + bonusXp;
  S.coins += pay;
  S.stats.salary += pay;
  S.stats.workMinutes += S.job.dur;
  S.stats.shifts++;
  Object.assign(S.job, { working: false, start: 0, dur: 0, pay: 0, boostMs: 0, bonus: 0, clicks: 0 });
  save(); updateHud();
  if (currentTab === 'job' || currentTab === 'shop') refreshCurrent();
  SFX.play('coins');
  toast(`💼 Mesai tamamlandı! <b>+${fmt(pay)}</b> jeton maaş aldın${bonusXp >= 1 / 60 ? `, tıklama bonusuyla +${clock(bonusXp)} ek deneyim kazandın` : ""}.${silent ? ' (sen yokken bitti)' : ''}`, 'gold');
  if (jobLevel(j) > lvlBefore) { SFX.play('levelup', 600); toast(`⬆️ ${esc(j.name)} seviye ${jobLevel(j)}! Maaşın arttı.`, 'gold'); }
}
function quitShift() {
  if (!S.job.working) return;
  if (!confirm(`Mesai bitmeden çıkarsan maaş (${fmt(shiftTotalPay())} jeton) ödenmez. Yine de çıkılsın mı?`)) return;
  Object.assign(S.job, { working: false, start: 0, dur: 0, pay: 0, boostMs: 0, bonus: 0, clicks: 0 });
  save(); updateHud(); refreshCurrent();
  toast('İşten erken çıktın, maaş alamadın.');
}
// Sahneye tıklamak: süreyi biraz kısaltır, maaşı biraz artırır. Mesai başına sınırlı, çok hızlı tıklamalar sayılmaz.
let lastWorkClick = 0;
const boostLimits = () => ({ maxMs: S.job.dur * 60000 * CFG.CLICK_MAX_TIME_PCT, maxBonus: S.job.pay * CFG.CLICK_MAX_PAY_PCT });
function workClick(e) {
  if (!S.job.working || shiftProgress() >= 1) return;
  const now = performance.now();
  if (now - lastWorkClick < CFG.CLICK_MIN_INTERVAL) return;
  lastWorkClick = now;
  const { maxMs, maxBonus } = boostLimits();
  const dMs = Math.min(S.job.dur * 60000 * CFG.CLICK_TIME_PCT, maxMs - (S.job.boostMs || 0));
  const dPay = Math.min(S.job.pay * CFG.CLICK_PAY_PCT, maxBonus - (S.job.bonus || 0));
  const scene = $('#workScene');
  if (dMs <= 0 && dPay <= 0) {
    popText(scene, e, 'Bu mesai için bonus doldu!', 'maxed');
    return;
  }
  S.job.boostMs = (S.job.boostMs || 0) + Math.max(0, dMs);
  S.job.bonus = (S.job.bonus || 0) + Math.max(0, dPay);
  S.job.clicks = (S.job.clicks || 0) + 1;
  SFX.play('tap');
  const walker = scene && scene.querySelector('.walker');
  if (walker && !S.settings.noanim) { walker.classList.remove('hop'); void walker.offsetWidth; walker.classList.add('hop'); }
  popText(scene, e, `${dPay >= 1 ? '+' + Math.round(dPay) + ' 🪙 · ' : ''}-${Math.max(1, Math.round(dMs / 1000))} sn`);
  if (S.job.clicks % 10 === 0) save();
  tickJob();
}
function popText(scene, e, text, cls = '') {
  if (!scene || S.settings.noanim) return;
  const r = scene.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'click-pop ' + cls;
  el.textContent = text;
  el.style.left = ((e ? e.clientX - r.left : r.width / 2)) + 'px';
  el.style.top = ((e ? e.clientY - r.top : r.height / 2)) + 'px';
  scene.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
function switchJob(id) {
  const j = jobById(id);
  if (S.job.working) return toast('İş değiştirmek için önce mesaini bitir.', 'err');
  if (j.req > completedCount) return;
  S.job.id = j.id;
  save(); renderJob();
  toast(`Yeni işin: <b>${esc(j.name)}</b>`, 'gold');
}
function tickJob() {
  if (S.job.working && shiftProgress() >= 1) completeShift(false);
  updateJobHud();
}
function updateJobHud() {
  const w = S.job.working, p = shiftProgress(), left = shiftLeftMin();
  $('#hudKasa').textContent = w ? `%${Math.floor(p * 100)} · ${clock(left)}` : 'Boşta';
  $('#hudJob').classList.toggle('working', w);
  $('#hudJob').classList.remove('full');
  $('#hudJob').title = w ? `${curJob().name} · ${fmt(shiftTotalPay())} jeton · tıkla ve iş sekmesine git` : 'İşe gitmek için tıkla';
  if (w && $('#shiftBar')) {
    $('#shiftBar').style.width = (p * 100) + '%';
    $('#shiftPct').textContent = `%${Math.floor(p * 100)}`;
    $('#shiftLeft').textContent = clock(left);
    $('#shiftPay').textContent = fmt(shiftTotalPay());
    const { maxMs } = boostLimits();
    $('#boostPay').textContent = '+' + fmt(S.job.bonus || 0);
    $('#boostTime').textContent = `-${clock((S.job.boostMs || 0) / 60000)}`;
    $('#boostXp').textContent = `+${clock((S.job.boostMs || 0) / 60000)}`;
    $('#boostBar').style.width = (maxMs ? (S.job.boostMs || 0) / maxMs * 100 : 0) + '%';
  }
  const banner = $('#workBanner');
  if (banner) {
    banner.innerHTML = w ? `<span>💼 Şu an işteysin (<b>${esc(curJob().name)}</b>) · %${Math.floor(p * 100)} · ${clock(left)} kaldı · bitince <b>${fmt(shiftTotalPay())}</b> jeton. İşteyken paket açamazsın.</span>
      <div class="mini-bar"><div style="width:${p * 100}%"></div></div>
      <button class="btn" data-tab-go="job">İşe bak</button>` : '';
    banner.classList.toggle('hidden', !w || currentTab === 'job');
  }
}

// Çalışma sahnesi animasyonu: yürüyen Pokémon, uçuşan iş nesneleri, değişen durum yazısı
let sceneTimers = [];
function stopScene() { sceneTimers.forEach(clearInterval); sceneTimers = []; }
function startScene(j) {
  stopScene();
  const scene = $('#workScene');
  if (!scene) return;
  let si = 0;
  const status = $('#sceneStatus');
  status.textContent = j.status[0];
  sceneTimers.push(setInterval(() => {
    if (!document.body.contains(scene)) return stopScene();
    si = (si + 1) % j.status.length;
    status.textContent = j.status[si];
  }, 3500));
  if (S.settings.noanim) return;
  sceneTimers.push(setInterval(() => {
    if (!document.body.contains(scene)) return stopScene();
    const el = document.createElement('span');
    el.className = 'scene-item';
    el.textContent = j.icons[Math.floor(Math.random() * j.icons.length)];
    el.style.left = (8 + Math.random() * 84) + '%';
    el.style.fontSize = (18 + Math.random() * 14) + 'px';
    scene.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }, 900));
}

function renderJob() {
  stopScene();
  const j = curJob(), w = S.job.working;
  const xp = (S.job.xp[j.id] || 0), lvl = jobLevel(j);
  const xpPct = lvl >= CFG.JOB_MAX_LEVEL ? 100 : (xp % CFG.JOB_LEVEL_MINUTES) / CFG.JOB_LEVEL_MINUTES * 100;
  const levelHtml = `<div class="job-row">
      <div>Seviye <b>${lvl}</b>/${CFG.JOB_MAX_LEVEL}<div class="xp-bar"><div style="width:${xpPct}%"></div></div>
        <span class="muted" style="font-size:12px">Her ${CFG.JOB_LEVEL_MINUTES} dk çalışma = +1 seviye (+%${CFG.JOB_LEVEL_BONUS * 100} maaş)</span></div>
    </div>`;
  if (w) {
    $('#jobMain').innerHTML = `<div class="job-main is-working">
      <div class="work-scene" id="workScene" style="--scene:${j.scene}">
        <div class="scene-ground"></div>
        <img class="walker" src="${CFG.ANIM_SPRITE(j.sprite)}" onerror="this.onerror=null;this.src='${CFG.SPRITE(j.sprite)}'" alt="">
        <div class="scene-status" id="sceneStatus"></div>
        <div class="scene-hint">👆 Tıkla, daha hızlı çalış!</div>
      </div>
      <div class="job-info">
        <div class="muted">Mesaidesin</div>
        <h2>${esc(j.name)}</h2>
        <div class="shift-bar"><div id="shiftBar"></div><span id="shiftPct">%0</span></div>
        <div class="job-row">
          <div>Kalan süre<br><b id="shiftLeft">-</b></div>
          <div>Mesai<br><b>${durLabel(S.job.dur)}</b></div>
          <div>Bitince alacağın<br><b id="shiftPay">${fmt(shiftTotalPay())}</b> jeton</div>
        </div>
        <div class="boost-row">
          <span>👆 Tıklama bonusu: <b id="boostPay">+0</b> jeton · <b id="boostTime">-0 sn</b> süre · <b id="boostXp">+0 sn</b> deneyim</span>
          <div class="mini-bar boost-bar" title="Bu mesaide alınabilecek tıklama bonusu"><div id="boostBar"></div></div>
          <span class="muted" style="font-size:12px">en fazla +%${CFG.CLICK_MAX_PAY_PCT * 100} maaş, -%${CFG.CLICK_MAX_TIME_PCT * 100} süre, +%${CFG.CLICK_MAX_TIME_PCT * 100} deneyim</span>
        </div>
        ${levelHtml}
        <p class="muted" style="font-size:12px">Bar dolunca maaşın otomatik ödenir. Bu sırada oyunda dolaşabilirsin ama paket açamazsın. Oyunu kapatsan da mesai devam eder.</p>
        <button class="btn danger" id="quitBtn">Erken çık (maaş ödenmez)</button>
      </div></div>`;
    $('#quitBtn').addEventListener('click', quitShift);
    startScene(j);
  } else {
    $('#jobMain').innerHTML = `<div class="job-main">
      <div class="job-stage" style="--scene:${j.scene}">
        <img class="job-sprite idle" src="${CFG.SPRITE(j.sprite)}" alt=""></div>
      <div class="job-info">
        <div class="muted">İşin</div>
        <h2>${esc(j.name)}</h2>
        <p class="muted">${esc(j.desc)}</p>
        ${levelHtml}
        <div class="muted" style="margin:6px 0 8px">Mesai seç ve işe git:</div>
        <div class="shift-options">${CFG.SHIFTS.map((sh, k) => `
          <button class="shift-opt" data-shift="${k}">
            <span class="so-time">⏱ ${durLabel(sh.min)}</span>
            <span class="so-pay"><span class="coin-ico"></span> ${fmt(shiftPay(j, sh))}</span>
            ${sh.mult > 1 ? `<span class="so-bonus">+%${Math.round((sh.mult - 1) * 100)} bonus</span>` : '<span class="so-bonus muted">kısa iş</span>'}
          </button>`).join('')}</div>
        <p class="muted" style="font-size:12px;margin-top:10px">Uzun mesailer daha kârlı. İşteyken paket açamazsın; bar dolunca maaşın tek seferde ödenir.</p>
      </div></div>`;
  }
  $('#jobList').innerHTML = JOBS.map(x => {
    const locked = x.req > completedCount, cur = x.id === j.id;
    return `<div class="job-card ${cur ? 'current' : ''} ${locked ? 'locked' : ''}">
      <img src="${CFG.SPRITE(x.sprite)}" alt="" loading="lazy">
      <div><div class="jn">${esc(x.name)}</div>
        <div class="jm">1 saatlik mesai: ${fmt(shiftPay(x, CFG.SHIFTS[CFG.SHIFTS.length - 1]))} jeton · seviye ${jobLevel(x)}</div>
        ${cur ? `<div class="jm" style="color:var(--gold)">${w ? 'Şu an burada çalışıyorsun' : 'Şu anki işin'}</div>`
          : locked ? `<div class="jm">🔒 ${x.req} Pokémon tamamla (${completedCount}/${x.req})</div>`
          : `<button class="btn primary" data-job="${x.id}" ${w ? 'disabled title="Önce mesaini bitir"' : ''}>Bu işe geç</button>`}
      </div></div>`;
  }).join('');
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
    const cost = packCost(s), lock = S.job.working;
    return `<div class="set-card" data-set="${s.i}">
      <div class="set-logo"><img loading="lazy" src="${esc(s.logo)}" alt="" onerror="this.style.display='none'"></div>
      <div class="set-name">${esc(s.name)}</div>
      <div class="set-meta">${esc(s.series)} · ${s.date.slice(0, 4)} · ${s.cards.length} kart${s.booster ? '' : ' · özel set'}${s.estimated ? ' · <span title="Bu setin piyasa fiyatları henüz yok, değerler nadirliğe göre tahmini">tahmini fiyat</span>' : ''}</div>
      ${s.illusCount ? `<div class="set-meta"><span class="tag-ir">IR</span> ${s.illusCount} illustration kart</div>` : ''}
      <div class="prog"><div style="width:${have / s.cards.length * 100}%"></div></div>
      <div class="set-meta">${have}/${s.cards.length} sahip · <b>${missing}</b> eksik hedef kart</div>
      <div class="set-btns">
        <button class="btn primary" data-open="1" ${S.coins < cost || lock ? 'disabled' : ''}>${lock ? '💼 İştesin' : `Aç · ${fmt(cost)}`}</button>
        <button class="btn" data-open="${CFG.BULK_COUNT}" ${lock ? 'disabled' : ''} title="${CFG.BULK_COUNT} paket birden aç (${fmt(s.price * CFG.BULK_COUNT)} jeton)">x${CFG.BULK_COUNT}</button>
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
      ${statBox(fmt(st.salary), 'maaştan kazanılan')}
      ${statBox(fmt(st.earned), 'Pokébank satışı')}
      ${statBox(clock(st.workMinutes), 'toplam çalışma', `${fmt(st.shifts)} mesai`)}
      ${statBox(esc(curJob().name), 'iş', `seviye ${jobLevel(curJob())}`)}
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
$('#jobList').addEventListener('click', e => { const b = e.target.closest('[data-job]'); if (b) switchJob(b.dataset.job); });
$('#workBanner').addEventListener('click', e => { if (e.target.closest('[data-tab-go]')) showTab('job'); });
$('#jobMain').addEventListener('click', e => {
  const b = e.target.closest('[data-shift]');
  if (b) return startShift(+b.dataset.shift);
  if (e.target.closest('#workScene')) workClick(e);
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
if (S.job.working && shiftProgress() >= 1) completeShift(true);
setInterval(tickJob, 1000);
setInterval(save, 30000);
if (firstRun) toast(`Hoş geldin! ${fmt(CFG.START_COINS)} jetonla (10 paket) başlıyorsun. Para bitince işe git. Hedef: her Pokémon'un illustration kartını toplamak!`, 'gold');
else if (S.job.working) toast(`💼 Hâlâ iştesin: mesainin bitmesine ${clock(shiftLeftMin())} var.`, 'gold');
save();
})();
