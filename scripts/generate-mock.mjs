/**
 * AdBrief — deterministic seeded mock data generator.
 *
 * Produces mock JSON files that mirror the production claim API schema
 * (Lampiran 1). All aggregates land within +/-3% of the targets documented
 * in design.md section 3.3. Regenerate with: node scripts/generate-mock.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data", "mock");
mkdirSync(OUT, { recursive: true });

/* ---------------- seeded RNG (mulberry32) ---------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260717);
const ri = (min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weightedPick(items, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/* ---------------- helpers ---------------- */
const pad = (n, w = 2) => String(n).padStart(w, "0");
function ddmmyyyy(d) {
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}`;
}
function addDays(d, n) {
  const c = new Date(d.getTime());
  c.setDate(c.getDate() + n);
  return c;
}

/* ============================================================
 * 1. ICD-10 dictionary
 * ============================================================ */
const ICD10 = [
  { code: "J06", description: "Acute upper respiratory infections of multiple and unspecified sites", group: "Acute upper respiratory infections" },
  { code: "J02", description: "Acute pharyngitis", group: "Acute upper respiratory infections" },
  { code: "J03", description: "Acute tonsillitis", group: "Acute upper respiratory infections" },
  { code: "J00", description: "Acute nasopharyngitis (common cold)", group: "Acute upper respiratory infections" },
  { code: "J20", description: "Acute bronchitis", group: "Other acute lower respiratory infections" },
  { code: "J18", description: "Pneumonia, organism unspecified", group: "Influenza and pneumonia" },
  { code: "J11", description: "Influenza with other respiratory manifestations", group: "Influenza and pneumonia" },
  { code: "J45", description: "Asthma", group: "Chronic lower respiratory diseases" },
  { code: "J30", description: "Vasomotor and allergic rhinitis", group: "Other diseases of upper respiratory tract" },
  { code: "A09", description: "Infectious gastroenteritis and colitis, unspecified", group: "Intestinal infectious diseases" },
  { code: "A01", description: "Typhoid and paratyphoid fevers", group: "Intestinal infectious diseases" },
  { code: "K29", description: "Gastritis and duodenitis", group: "Diseases of oesophagus, stomach and duodenum" },
  { code: "K21", description: "Gastro-oesophageal reflux disease", group: "Diseases of oesophagus, stomach and duodenum" },
  { code: "K35", description: "Acute appendicitis", group: "Diseases of appendix" },
  { code: "K02", description: "Dental caries", group: "Diseases of hard tissues of teeth" },
  { code: "K04", description: "Diseases of pulp and periapical tissues", group: "Diseases of hard tissues of teeth" },
  { code: "K05", description: "Gingivitis and periodontal diseases", group: "Diseases of gingiva and edentulous alveolar ridge" },
  { code: "K08", description: "Other disorders of teeth and supporting structures", group: "Other disorders of teeth" },
  { code: "R51", description: "Headache", group: "Symptoms involving general sensation" },
  { code: "R50", description: "Fever of other and unknown origin", group: "General symptoms and signs" },
  { code: "R10", description: "Abdominal and pelvic pain", group: "Symptoms involving digestive system" },
  { code: "R05", description: "Cough", group: "Symptoms involving respiratory system" },
  { code: "R11", description: "Nausea and vomiting", group: "Symptoms involving digestive system" },
  { code: "M54", description: "Dorsalgia (back pain)", group: "Dorsopathies" },
  { code: "M79", description: "Other and unspecified soft tissue disorders", group: "Soft tissue disorders" },
  { code: "M17", description: "Gonarthrosis (arthrosis of knee)", group: "Arthropathies" },
  { code: "I10", description: "Essential (primary) hypertension", group: "Hypertensive diseases" },
  { code: "E11", description: "Type 2 diabetes mellitus", group: "Diabetes mellitus" },
  { code: "E78", description: "Disorders of lipoprotein metabolism", group: "Metabolic disorders" },
  { code: "E04", description: "Other nontoxic goitre", group: "Disorders of thyroid gland" },
  { code: "L03", description: "Cellulitis and acute lymphangitis", group: "Infections of skin and subcutaneous tissue" },
  { code: "L23", description: "Allergic contact dermatitis", group: "Dermatitis and eczema" },
  { code: "L50", description: "Urticaria", group: "Urticaria and erythema" },
  { code: "H10", description: "Conjunctivitis", group: "Disorders of conjunctiva" },
  { code: "H52", description: "Disorders of refraction and accommodation", group: "Disorders of ocular muscles/refraction" },
  { code: "H66", description: "Suppurative and unspecified otitis media", group: "Diseases of middle ear and mastoid" },
  { code: "N39", description: "Urinary tract infection, site not specified", group: "Other diseases of the urinary system" },
  { code: "O80", description: "Encounter for full-term uncomplicated delivery", group: "Encounter for delivery" },
  { code: "O82", description: "Encounter for caesarean delivery without indication", group: "Encounter for delivery" },
  { code: "Z34", description: "Encounter for supervision of normal pregnancy", group: "Antenatal screening/supervision" },
  { code: "Z00", description: "Encounter for general examination without complaint", group: "General examination" },
  { code: "Z01", description: "Encounter for other special examination", group: "General examination" },
  { code: "Z10", description: "Routine general health check-up", group: "General examination" },
  { code: "B34", description: "Viral infection of unspecified site", group: "Other viral diseases" },
  { code: "A90", description: "Dengue fever (classical dengue)", group: "Arthropod-borne viral fevers" },
  { code: "T14", description: "Injury of unspecified body region", group: "Injuries of unspecified body region" },
  { code: "S61", description: "Open wound of wrist, hand and fingers", group: "Injuries to wrist/hand" },
  { code: "G40", description: "Epilepsy and recurrent seizures", group: "Episodic and paroxysmal disorders" },
  { code: "D50", description: "Iron deficiency anaemia", group: "Nutritional anaemias" },
  { code: "F41", description: "Other anxiety disorders", group: "Neurotic, stress-related disorders" },
];
const COVERAGE_DIAGNOSIS = {
  GP: ["J06", "J02", "J03", "J00", "J20", "A09", "K29", "R51", "R50", "R10", "R05", "M54", "I10", "E11", "L50", "H10", "A90", "B34", "D50", "M79", "K21", "N39", "F41", "R11", "J45", "J30", "L03", "L23", "H66"],
  DENTAL: ["K02", "K04", "K05", "K08"],
  LAB: ["Z00", "Z01", "Z10", "E78", "E11", "I10", "D50", "B34"],
  OP: ["K35", "J18", "T14", "S61", "A01", "M17", "E04", "O80"],
  "H&S": ["I10", "E11", "M54", "J45", "G40", "M79", "Z00", "K29"],
  MAT: ["Z34", "O80", "O82"],
};

/* ============================================================
 * 2. Members (715, all active)
 * ============================================================ */
const FIRST_M = ["Budi","Agus","Andi","Bambang","Dedi","Eko","Fajar","Hendra","Irfan","Joko","Kurniawan","Lukman","Muhammad","Rizki","Surya","Taufik","Wahyu","Yusuf","Arif","Dian","Rian","Galih","Fikri","Ilham","Reza","Aditya","Bayu","Dimas","Faisal","Hadi"];
const FIRST_F = ["Siti","Dewi","Sri","Rina","Maya","Nur","Ayu","Fitri","Indah","Lestari","Ratna","Wulan","Yanti","Ani","Rani","Diah","Putri","Intan","Sari","Melati","Kartika","Novia","Laila","Rahma","Tania","Vina","Winda","Yuni","Zahra","Amelia"];
const LAST = ["Santoso","Wijaya","Saputra","Pratama","Kusuma","Hidayat","Nugroho","Setiawan","Rahmadi","Siregar","Nasution","Hutapea","Simanjuntak","Wibowo","Susanto","Gunawan","Salim","Hartono","Purnama","Firmansyah","Ramadhan","Maulana","Akbar","Prasetyo","Utama","Handoko","Limanto","Tanuwijaya","Halim","Suherman"];

const REL_TARGETS = { PRINCIPLE: 268, CHILD: 272, SPOUSE: 175 }; // sums to 715
const members = [];
let memSeq = 100001;
for (const [rel, count] of Object.entries(REL_TARGETS)) {
  for (let i = 0; i < count; i++) {
    const gender = rel === "CHILD" ? (rng() < 0.5 ? "F" : "M") : rel === "SPOUSE" ? (rng() < 0.72 ? "F" : "M") : (rng() < 0.3 ? "F" : "M");
    let age;
    if (rel === "CHILD") age = Math.floor(Math.pow(rng(), 1.15) * 18); // 0-17
    else if (rel === "SPOUSE") age = 24 + Math.floor(rng() * 38); // 24-61
    else age = 24 + Math.floor(Math.pow(rng(), 0.9) * 44); // 24-67 (some >64)
    // birthDate so that age at mid-period (Jan 2026) is `age`
    const birthYear = 2026 - age;
    const birth = new Date(Date.UTC(birthYear - (rng() < 0.5 ? 1 : 0), ri(0, 11), ri(1, 28)));
    const memberno = `MEM${memSeq++}`;
    const first = gender === "F" ? pick(FIRST_F) : pick(FIRST_M);
    members.push({
      MEMBERNO: memberno,
      name: `${first} ${pick(LAST)}`,
      gender,
      birthDate: ddmmyyyy(birth),
      relationship: rel,
      joinDate: ddmmyyyy(new Date(Date.UTC(ri(2018, 2024), ri(0, 11), ri(1, 28)))),
      active: true,
    });
  }
}

/* Claimants: exactly 243 PRINCIPLE / 247 CHILD / 152 SPOUSE = 642 */
const CLAIMANT_TARGETS = { PRINCIPLE: 243, CHILD: 247, SPOUSE: 152 };
const claimants = [];
for (const [rel, count] of Object.entries(CLAIMANT_TARGETS)) {
  const pool = shuffled(members.filter((m) => m.relationship === rel));
  claimants.push(...pool.slice(0, count));
}
const claimantSet = new Set(claimants.map((c) => c.MEMBERNO));

/* ============================================================
 * 3. Providers (410, all used at least once)
 * ============================================================ */
const CITIES = [
  // [city, province, lat, lng, weight]
  ["Jakarta Selatan","DKI Jakarta",-6.26,106.81,26],["Jakarta Pusat","DKI Jakarta",-6.18,106.83,22],["Jakarta Timur","DKI Jakarta",-6.22,106.90,16],["Jakarta Barat","DKI Jakarta",-6.17,106.76,16],["Jakarta Utara","DKI Jakarta",-6.13,106.87,12],
  ["Bandung","Jawa Barat",-6.91,107.61,22],["Bekasi","Jawa Barat",-6.24,106.99,14],["Bogor","Jawa Barat",-6.60,106.80,10],["Depok","Jawa Barat",-6.40,106.82,10],["Cirebon","Jawa Barat",-6.73,108.55,6],["Karawang","Jawa Barat",-6.31,107.30,5],
  ["Tangerang","Banten",-6.17,106.63,14],["Tangerang Selatan","Banten",-6.29,106.72,10],["Serang","Banten",-6.12,106.15,5],
  ["Semarang","Jawa Tengah",-6.99,110.42,14],["Solo","Jawa Tengah",-7.57,110.82,8],["Magelang","Jawa Tengah",-7.47,110.22,4],["Tegal","Jawa Tengah",-6.87,109.13,4],
  ["Yogyakarta","DI Yogyakarta",-7.80,110.36,10],["Sleman","DI Yogyakarta",-7.72,110.35,6],
  ["Surabaya","Jawa Timur",-7.25,112.75,22],["Malang","Jawa Timur",-7.98,112.63,8],["Kediri","Jawa Timur",-7.82,112.01,4],["Sidoarjo","Jawa Timur",-7.45,112.72,5],
  ["Denpasar","Bali",-8.65,115.22,10],["Badung","Bali",-8.58,115.18,5],
  ["Medan","Sumatera Utara",3.59,98.67,14],["Binjai","Sumatera Utara",3.60,98.49,3],
  ["Padang","Sumatera Barat",-0.95,100.35,8],["Bukittinggi","Sumatera Barat",-0.30,100.37,3],
  ["Palembang","Sumatera Selatan",-2.99,104.76,9],
  ["Pekanbaru","Riau",0.53,101.45,7],["Batam","Kepulauan Riau",1.13,104.03,7],
  ["Bandar Lampung","Lampung",-5.45,105.27,6],["Jambi","Jambi",-1.61,103.61,4],["Bengkulu","Bengkulu",-3.79,102.26,3],
  ["Pontianak","Kalimantan Barat",-0.03,109.33,5],["Palangkaraya","Kalimantan Tengah",-2.21,113.92,3],
  ["Banjarmasin","Kalimantan Selatan",-3.32,114.59,5],["Balikpapan","Kalimantan Timur",-1.27,116.83,6],["Samarinda","Kalimantan Timur",-0.50,117.15,5],
  ["Makassar","Sulawesi Selatan",-5.14,119.42,9],["Manado","Sulawesi Utara",1.49,124.84,5],["Palu","Sulawesi Tengah",-0.90,119.87,3],
  ["Kendari","Sulawesi Tenggara",-3.99,122.51,3],["Gorontalo","Gorontalo",0.54,123.06,2],
  ["Mataram","Nusa Tenggara Barat",-8.58,116.10,4],["Kupang","Nusa Tenggara Timur",-10.17,123.58,4],
  ["Ambon","Maluku",-3.70,128.18,2],["Ternate","Maluku Utara",0.79,127.38,2],
  ["Jayapura","Papua",-2.53,140.72,3],["Sorong","Papua Barat Daya",-0.88,131.25,2],["Manokwari","Papua Barat",-0.86,134.08,2],
  ["Merauke","Papua Selatan",-8.49,140.40,1],["Timika","Papua Tengah",-4.55,136.89,1],["Wamena","Papua Pegunungan",-4.10,138.95,1],
];
const PROVINCE_FALLBACK = { "Aceh": ["Banda Aceh",5.55,95.32], "Kalimantan Utara": ["Tanjung Selor",2.84,117.37], "Sulawesi Barat": ["Mamuju",-2.68,118.89] };

const RS_NAMES = ["Harapan Sehat","Medika Utama","Siloam Kasih","Mitra Keluarga","Hermina Bangsa","Eka Pratama","Sari Asih","Bhakti Mulia","Cipta Mandiri","Graha Medika","Pelita Husada","Amanah Sejahtera","Bunda Amanah","Sentosa Medika","Primaya Nusa","Omni Cakra","Royal Taruma","Pantai Indah","Anugrah Medika","Karya Husada","Tirta Medika","Wisma Sehat","Annisa Care","Karunia Medika","Dharma Nugraha","Melati Husada","Sekar Arum","Purnawarman","Cendana Medika","Rajawali Sehat","Bintang Medika","Anggrek Kasih","Puspa Medika","Tunas Husada"];
const KLINIK_NAMES = ["Klinik Sehat Ceria","Klinik Keluarga Medika","Klinik Pratama Nusa","Klinik Citra Medika","Klinik Harmoni","Klinik Bina Sehat","Klinik Amanah","Klinik Mitra Sehat","Klinik Puri Medika","Klinik Sumber Waras","Klinik Kartika","Klinik Anandha","Klinik Pelita","Klinik Sentosa","Klinik Graha Sehat","Klinik Medika Plaza","Klinik Cakra","Klinik Teratai","Klinik Wijaya Kusuma","Klinik Delta Medika"];
const LAB_NAMES = ["Laboratorium Prodia","Laboratorium Klinik Pramita","Laboratorium Parahita","Laboratorium Bio Medika","Laboratorium Kimia Farma","Laboratorium Cito","Laboratorium Sigma Diagnostik","Laboratorium Ultra Medika"];
const DENTAL_NAMES = ["Klinik Gigi Senyum Ceria","Klinik Gigi Dentia","Klinik Gigi Audy Dental","Klinik Gigi Happy Smile","Klinik Gigi Orange","Klinik Gigi FDC","Klinik Gigi Sanafa","Klinik Gigi Griya Dent"];
const APOTEK_NAMES = ["Apotek K-24","Apotek Kimia Farma","Apotek Century","Apotek Roxy","Apotek Guardian Farma","Apotek Sehat Farma","Apotek Melawai","Apotek Viva Generik"];

const providers = [];
let provSeq = 1;
const cityWeightTotal = CITIES.reduce((s, c) => s + c[4], 0);
function pickCity() {
  let r = rng() * cityWeightTotal;
  for (const c of CITIES) { r -= c[4]; if (r <= 0) return c; }
  return CITIES[0];
}
const usedProvinces = new Set();
const allProvinceNames = [...new Set([...CITIES.map((c) => c[1]), ...Object.keys(PROVINCE_FALLBACK)])];
// Guarantee coverage of every province with a city first
for (const prov of allProvinceNames) {
  const cityEntry = CITIES.find((c) => c[1] === prov);
  const [city, , lat, lng] = cityEntry
    ? cityEntry
    : [PROVINCE_FALLBACK[prov][0], prov, PROVINCE_FALLBACK[prov][1], PROVINCE_FALLBACK[prov][2]];
  const type = "RS";
  providers.push({
    PROVIDERID: `PRV${pad(provSeq++, 4)}`,
    providerName: `RS ${RS_NAMES[providers.length % RS_NAMES.length]} ${city}`,
    type, city, province: prov,
    lat: +(lat + (rng() - 0.5) * 0.15).toFixed(5),
    lng: +(lng + (rng() - 0.5) * 0.15).toFixed(5),
    inNetwork: true,
  });
  usedProvinces.add(prov);
}
const TYPE_POOL = ["RS","RS","RS","Klinik","Klinik","Klinik","Klinik","Lab","Klinik Gigi","Apotek"];
while (providers.length < 410) {
  const [city, province, lat, lng] = pickCity();
  const type = pick(TYPE_POOL);
  let base;
  if (type === "RS") base = `RS ${pick(RS_NAMES)}`;
  else if (type === "Lab") base = pick(LAB_NAMES);
  else if (type === "Klinik Gigi") base = pick(DENTAL_NAMES);
  else if (type === "Apotek") base = pick(APOTEK_NAMES);
  else base = pick(KLINIK_NAMES);
  providers.push({
    PROVIDERID: `PRV${pad(provSeq++, 4)}`,
    providerName: `${base} ${city}`,
    type, city, province,
    lat: +(lat + (rng() - 0.5) * 0.18).toFixed(5),
    lng: +(lng + (rng() - 0.5) * 0.18).toFixed(5),
    inNetwork: true,
  });
}
// Flag 30 providers as out-of-network (reimbursement facilities)
for (const p of shuffled(providers).slice(0, 30)) p.inNetwork = false;
const inNetworkProviders = providers.filter((p) => p.inNetwork);
const outNetworkProviders = providers.filter((p) => !p.inNetwork);
// Provider popularity weights (bigger cities => busier)
const provWeight = new Map(providers.map((p) => [p.PROVIDERID, 1 + 3 * rng() * (CITIES.find((c) => c[0] === p.city)?.[4] ?? 2)]));

/* ============================================================
 * 4. Coverage assignment per claimant (exact distinct counts)
 * ============================================================ */
const COVERAGES = ["GP", "DENTAL", "LAB", "OP", "H&S", "MAT"];
const COV_CLAIMANT_TARGET = { GP: 585, DENTAL: 377, LAB: 243, OP: 149, "H&S": 116, MAT: 25 };
const coverageMembers = {}; // COVERAGEID -> Set(MEMBERNO)
for (const cov of COVERAGES) {
  coverageMembers[cov] = new Set(shuffled(claimants).slice(0, COV_CLAIMANT_TARGET[cov]).map((c) => c.MEMBERNO));
}
// Every claimant must have at least one coverage; fix up within DENTAL (largest non-GP)
for (const c of claimants) {
  const hasAny = COVERAGES.some((cov) => coverageMembers[cov].has(c.MEMBERNO));
  if (!hasAny) {
    // swap: remove a random DENTAL member that also has GP, add this claimant
    const donor = [...coverageMembers.DENTAL].find((m) => coverageMembers.GP.has(m));
    if (donor) coverageMembers.DENTAL.delete(donor);
    coverageMembers.DENTAL.add(c.MEMBERNO);
  }
}

/* ============================================================
 * 5. Claims (6,386) — exact per-coverage transaction & value targets
 * ============================================================ */
const COV_TXN_TARGET = { GP: 3412, DENTAL: 1128, LAB: 812, OP: 524, "H&S": 402, MAT: 108 };
const COV_BILLING_TARGET = { GP: 11245331200, DENTAL: 1904221500, LAB: 1202118400, OP: 1631908100, "H&S": 1755442900, MAT: 346943606 };
const COV_APPROVED_TARGET = { GP: 11008473000, DENTAL: 1869744700, LAB: 1171664300, OP: 1590121800, "H&S": 1718229400, MAT: 343011718 };

// Claim month weights: Jul 2025 .. Jul 2026 with a gentle upward trend + seasonality
const MONTHS = [];
{
  const d = new Date(Date.UTC(2025, 6, 1));
  for (let i = 0; i < 13; i++) { MONTHS.push(new Date(d.getTime())); d.setUTCMonth(d.getUTCMonth() + 1); }
}
const monthWeights = MONTHS.map((_, i) => 1 + 0.035 * i + 0.12 * Math.sin((i / 12) * Math.PI * 2 + 1.2));

const PAYORS = [["PAY001","AdMedika",0.78],["PAY002","Nusantara Sejahtera Insurance",0.12],["PAY003","Global Medika Partner",0.10]];
const BRANCHES = ["JAKARTA","BANDUNG","SURABAYA","MEDAN","SEMARANG","MAKASSAR","DENPASAR","PALEMBANG"];
const VERIFIERS = ["R. Kusuma","A. Wibowo","S. Halim","D. Prasetyo","M. Nasution"];

const claims = [];
let claimSeq = 1;
let idSeq = 1;

function apportion(total, weights) {
  // apportion `total` into integer parts proportional to weights, exact sum
  const wsum = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map((w) => (total * w) / wsum);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - floors[i], i]).sort((a, b) => b[0] - a[0]);
  const out = floors.slice();
  for (let k = 0; k < remainder; k++) out[order[k % order.length][1]]++;
  return out;
}

for (const cov of COVERAGES) {
  const pool = claimants.filter((c) => coverageMembers[cov].has(c.MEMBERNO));
  const nTxn = COV_TXN_TARGET[cov];
  // transaction weights per claimant in this coverage pool
  const poolW = pool.map(() => 0.25 + Math.pow(rng(), 2) * 4);
  const txnCounts = apportion(nTxn, poolW);
  // guarantee every claimant in this coverage pool gets >= 1 transaction
  // (keeps distinct-claimant-per-coverage exactly on target)
  const orderByCount = txnCounts.map((n, i) => [n, i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < txnCounts.length; i++) {
    if (txnCounts[i] === 0) {
      const donor = orderByCount.find(([n]) => n > 1);
      if (!donor) break;
      txnCounts[donor[1]] -= 1;
      donor[0] -= 1;
      txnCounts[i] = 1;
    }
  }
  // per-claim billing weights (lognormal-ish)
  const billW = Array.from({ length: nTxn }, () => 0.3 + Math.pow(rng(), 2.2) * 9);
  const incurredList = apportion(COV_BILLING_TARGET[cov], billW);
  // approved: ratio around coverage rate, then exact fix
  const covRatio = COV_APPROVED_TARGET[cov] / COV_BILLING_TARGET[cov];
  let approvedList = incurredList.map((inc) => Math.min(inc, Math.round(inc * Math.min(1, Math.max(0.82, covRatio + (rng() - 0.5) * 0.09)))));
  let diff = COV_APPROVED_TARGET[cov] - approvedList.reduce((s, v) => s + v, 0);
  let idx = 0;
  const order2 = shuffled(approvedList.map((_, i) => i));
  while (diff !== 0) {
    const i = order2[idx % order2.length];
    if (diff > 0 && approvedList[i] < incurredList[i]) { approvedList[i]++; diff--; }
    else if (diff < 0 && approvedList[i] > 0) { approvedList[i]--; diff++; }
    idx++;
    if (idx > order2.length * Math.abs(COV_APPROVED_TARGET[cov] + 10)) break; // safety
  }

  let claimIdx = 0;
  pool.forEach((member, pi) => {
    for (let t = 0; t < txnCounts[pi]; t++) {
      const month = weightedPick(MONTHS, monthWeights);
      const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
      const admission = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), ri(1, daysInMonth)));
      const duration = cov === "OP" || cov === "MAT" ? ri(1, 7) : cov === "H&S" ? ri(0, 4) : 0;
      const discharge = addDays(admission, duration);
      const created = addDays(discharge, ri(1, 21));
      const incurred = incurredList[claimIdx];
      const approved = approvedList[claimIdx];
      const excess = rng() < 0.08 ? Math.min(incurred - approved, ri(5, 120) * 1000) : 0;
      const unapproved = incurred - approved - excess;
      const payor = weightedPick(PAYORS.map((p) => p[0]), PAYORS.map((p) => p[2]));
      const diagPool = COVERAGE_DIAGNOSIS[cov];
      const year = admission.getUTCFullYear();
      claims.push({
        id: idSeq++,
        PAYORID: payor,
        CLIENTID: `CLT${pad(ri(1, 42), 3)}`,
        PROVIDERID: null, // assigned later (network logic)
        CARDNO: `CARD${member.MEMBERNO.slice(3)}`,
        CLAIMNO: `CLM-${year}-${pad(claimSeq++, 6)}`,
        CLAIMTYPE: "M", // adjusted later for reimbursement subset
        STATUS: rng() < 0.96 ? "APPROVED" : pick(["VERIFIED", "PAID"]),
        POLICYNO: `POL/${payor.slice(3)}/${ri(100000, 999999)}`,
        EMPID: member.relationship === "PRINCIPLE" ? `EMP${pad(ri(1, 268), 4)}` : "",
        BRANCH: pick(BRANCHES),
        MEMBERNO: member.MEMBERNO,
        NAME: member.name,
        ADMISSIONDATE: ddmmyyyy(admission),
        DISCHARGEDATE: ddmmyyyy(discharge),
        DURATION: duration,
        COVERAGEID: cov,
        PPLAN: pick(["PLAN A", "PLAN B", "PLAN C", "PLAN D"]),
        DISABILITY: "",
        FDIAGNOSIS: pick(diagPool),
        LDIAGNOSIS: rng() < 0.35 ? pick(diagPool) : "",
        INCURRED: incurred,
        APPROVED: approved,
        UNAPPROVED: unapproved,
        ASOAPPROVED: approved,
        HIGHPLAN: "N",
        REMARKS: "",
        EXCESS: excess,
        INVOICENO: `INV/${year}/${pad(ri(1, 99999), 5)}`,
        HOSPITALINVOICEDATE: ddmmyyyy(discharge),
        HOSPITALINVOICENO: `HINV/${year}/${pad(ri(1, 99999), 5)}`,
        RECEIVEDDATE: ddmmyyyy(addDays(discharge, ri(1, 10))),
        SUBMISSIONDATE: ddmmyyyy(addDays(discharge, ri(2, 14))),
        VERIFIEDBY: pick(VERIFIERS),
        PHYSICIANID: `DR${pad(ri(1, 320), 4)}`,
        created_at: created.toISOString(),
        _member: member,
        _month: month,
      });
      claimIdx++;
    }
  });
}

/* --- payment channel: 237 reimbursement claims from 41 low-activity claimants --- */
const REIMBURSE_TARGET = 237;
const NONPROV_CLAIMANTS = 41;
const byClaimantCount = claimants.map((c) => ({ c, n: claims.filter((cl) => cl.MEMBERNO === c.MEMBERNO).length }));
byClaimantCount.sort((a, b) => a.n - b.n);
const nonProvMembers = [];
let reimbCount = 0;
for (const { c, n } of byClaimantCount) {
  if (nonProvMembers.length >= NONPROV_CLAIMANTS) break;
  nonProvMembers.push(c.MEMBERNO);
  reimbCount += n;
}
// Fine-tune: adjust the membership of the non-provider pool so total = 237 exactly
const nonProvSet = new Set(nonProvMembers);
function poolTxnTotal() {
  let s = 0;
  for (const cl of claims) if (nonProvSet.has(cl.MEMBERNO)) s++;
  return s;
}
reimbCount = poolTxnTotal();
{
  // add or drop smallest-count claimants to approach target
  const counts = new Map(byClaimantCount.map((x) => [x.c.MEMBERNO, x.n]));
  let guard = 0;
  while (reimbCount !== REIMBURSE_TARGET && guard++ < 400) {
    if (reimbCount < REIMBURSE_TARGET) {
      const cand = byClaimantCount.find((x) => !nonProvSet.has(x.c.MEMBERNO) && reimbCount + x.n <= REIMBURSE_TARGET);
      if (!cand) break;
      nonProvSet.add(cand.c.MEMBERNO); reimbCount += cand.n;
    } else {
      // drop the pool member whose removal overshoots the least
      const inPool = [...nonProvSet].map((m) => ({ m, n: counts.get(m) })).sort((a, b) => a.n - b.n);
      const removable = inPool.find((x) => reimbCount - x.n >= REIMBURSE_TARGET);
      if (!removable) break;
      nonProvSet.delete(removable.m); reimbCount -= removable.n;
    }
  }
}
// Residual mismatch: flip individual claims' CLAIMTYPE to land exactly on 237
{
  let current = poolTxnTotal();
  const inPoolClaims = shuffled(claims.filter((cl) => nonProvSet.has(cl.MEMBERNO)));
  while (current > REIMBURSE_TARGET && inPoolClaims.length) {
    // move some claims of the pool to cashless by reassigning them to another claimant is
    // complex; instead mark them as cashless at an in-network provider (they stay with the member,
    // who then is a provider-claimant too — acceptable small drift on the 41-count, never on 237).
    const cl = inPoolClaims.pop();
    cl._forceCashless = true;
    current--;
  }
  if (current < REIMBURSE_TARGET) {
    // pull extra claims from non-pool claimants with few claims into the reimbursement set
    const counts = new Map(byClaimantCount.map((x) => [x.c.MEMBERNO, x.n]));
    const candClaims = shuffled(claims.filter((cl) => !nonProvSet.has(cl.MEMBERNO) && counts.get(cl.MEMBERNO) <= 3));
    while (current < REIMBURSE_TARGET && candClaims.length) {
      const cl = candClaims.pop();
      nonProvSet.add(cl.MEMBERNO);
      current++;
    }
  }
}

// Assign CLAIMTYPE + PROVIDERID (network logic); guarantee every provider is used >= once
const unusedProviders = shuffled(providers.slice());
const providerById = new Map(providers.map((p) => [p.PROVIDERID, p]));
function pickProvider(networked) {
  const pool = networked ? inNetworkProviders : outNetworkProviders;
  const ws = pool.map((p) => provWeight.get(p.PROVIDERID));
  return weightedPick(pool, ws);
}
for (const cl of claims) {
  const isReimb = nonProvSet.has(cl.MEMBERNO) && !cl._forceCashless;
  cl.CLAIMTYPE = isReimb ? "R" : "M";
  let prov;
  if (unusedProviders.length && ((unusedProviders[unusedProviders.length - 1].inNetwork && !isReimb) || (!unusedProviders[unusedProviders.length - 1].inNetwork && isReimb))) {
    prov = unusedProviders.pop();
  } else {
    prov = pickProvider(!isReimb);
  }
  cl.PROVIDERID = prov.PROVIDERID;
}
// Any still-unused providers (shouldn't happen, but guarantee Healthcare = 410): swap into random cashless claims
{
  const usedIds = new Set(claims.map((c) => c.PROVIDERID));
  const unused = providers.filter((p) => !usedIds.has(p.PROVIDERID));
  const cashlessClaims = shuffled(claims.filter((c) => c.CLAIMTYPE === "M"));
  let i = 0;
  for (const p of unused) {
    if (p.inNetwork) cashlessClaims[i++ % cashlessClaims.length].PROVIDERID = p.PROVIDERID;
    else {
      const rc = shuffled(claims.filter((c) => c.CLAIMTYPE === "R"));
      if (rc.length) rc[0].PROVIDERID = p.PROVIDERID;
    }
  }
}

/* ============================================================
 * 6. Claim line items
 * ============================================================ */
const BENEFITS = {
  GP: [["4.09.02.010","B.ADMIN",0.08],["4.01.01.001","B.DR.UMUM",0.22],["4.02.03.005","B.OBAT",0.28],["4.03.01.002","B.TINDAKAN",0.24],["4.05.01.001","B.INJEKSI",0.18]],
  DENTAL: [["4.09.02.010","B.ADMIN",0.10],["4.06.01.001","B.DR.GIGI",0.35],["4.06.02.004","B.TAMBAL",0.25],["4.06.03.002","B.CABUT",0.15],["4.02.03.005","B.OBAT",0.15]],
  LAB: [["4.09.02.010","B.ADMIN",0.06],["4.07.01.001","B.LAB.DARAH",0.34],["4.07.02.003","B.LAB.URINE",0.20],["4.07.03.002","B.RONTGEN",0.25],["4.07.04.001","B.USG",0.15]],
  OP: [["4.09.02.010","B.ADMIN",0.07],["4.01.02.001","B.DR.SPESIALIS",0.18],["4.08.01.001","B.KAMAR",0.22],["4.08.02.001","B.OPERASI",0.30],["4.02.03.005","B.OBAT",0.13],["4.07.01.001","B.LAB",0.10]],
  "H&S": [["4.09.02.010","B.ADMIN",0.08],["4.01.02.001","B.DR.SPESIALIS",0.24],["4.02.03.005","B.OBAT",0.26],["4.07.01.001","B.LAB",0.20],["4.08.01.001","B.KAMAR",0.22]],
  MAT: [["4.09.02.010","B.ADMIN",0.06],["4.10.01.001","B.MELAHIRKAN",0.40],["4.08.01.001","B.KAMAR",0.24],["4.10.02.002","B.KONTROL.HAMIL",0.16],["4.02.03.005","B.OBAT",0.14]],
};
const claimDetails = [];
for (const cl of claims) {
  const catalog = BENEFITS[cl.COVERAGEID];
  const nLines = ri(1, Math.min(4, catalog.length));
  const lines = shuffled(catalog).slice(0, nLines);
  const ws = lines.map((l) => l[2] * (0.6 + rng() * 0.8));
  const incParts = apportion(cl.INCURRED, ws);
  const appParts = apportion(cl.APPROVED, ws);
  lines.forEach((l, i) => {
    claimDetails.push({
      CLAIMNO: cl.CLAIMNO,
      BENEFITID: l[0],
      BENEFITDESC: l[1],
      INCURRED: incParts[i],
      APPROVED: appParts[i],
      UNAPPROVED: Math.max(0, incParts[i] - appParts[i] - Math.round((cl.EXCESS * incParts[i]) / Math.max(1, cl.INCURRED))),
      EXCESS: Math.round((cl.EXCESS * incParts[i]) / Math.max(1, cl.INCURRED)),
    });
  });
}

/* ============================================================
 * 7. Clean + write
 * ============================================================ */
for (const cl of claims) { delete cl._member; delete cl._month; delete cl._forceCashless; }
const membersOut = members.map(({ name, ...m }) => ({ MEMBERNO: m.MEMBERNO, name, gender: m.gender, birthDate: m.birthDate, relationship: m.relationship, joinDate: m.joinDate, active: m.active }));

writeFileSync(join(OUT, "claims.json"), JSON.stringify(claims));
writeFileSync(join(OUT, "claimDetails.json"), JSON.stringify(claimDetails));
writeFileSync(join(OUT, "providers.json"), JSON.stringify(providers));
writeFileSync(join(OUT, "members.json"), JSON.stringify(membersOut));
writeFileSync(join(OUT, "icd10.json"), JSON.stringify(ICD10));

/* ============================================================
 * 8. Verify aggregates vs design.md 3.3 targets
 * ============================================================ */
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const billing = sum(claims, (c) => c.INCURRED);
const approved = sum(claims, (c) => c.APPROVED);
const claimantCount = new Set(claims.map((c) => c.MEMBERNO)).size;
const providerCount = new Set(claims.map((c) => c.PROVIDERID)).size;
const cashless = claims.filter((c) => c.CLAIMTYPE === "M").length;
const relSplit = {};
for (const c of claimants) relSplit[c.relationship] = (relSplit[c.relationship] || 0) + 1;
const covSplit = {};
for (const cov of COVERAGES) covSplit[cov] = new Set(claims.filter((c) => c.COVERAGEID === cov).map((c) => c.MEMBERNO)).size;

const report = {
  memberActive: members.filter((m) => m.active).length,
  claimants: claimantCount,
  transactions: claims.length,
  healthcare: providerCount,
  billing,
  approved,
  approvedPct: ((approved / billing) * 100).toFixed(2),
  morbidity: ((claimantCount / 715) * 100).toFixed(2),
  avgTxnPerClaimant: (claims.length / claimantCount).toFixed(1),
  avgApprovedPerClaimant: Math.round(approved / claimantCount),
  cashlessPct: ((cashless / claims.length) * 100).toFixed(2),
  reimbPct: (((claims.length - cashless) / claims.length) * 100).toFixed(2),
  relSplit, covSplit,
  claimDetailsLines: claimDetails.length,
};
console.log(JSON.stringify(report, null, 2));
