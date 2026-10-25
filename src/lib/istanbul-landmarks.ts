// Curated Istanbul landmarks used as the default "sign in and go" result set.
// Shape matches the EventRow consumed by app/map so they render as pins
// without any other plumbing.
export type Landmark = {
  id: string;
  title: string;
  starts_at: string; // ISO; required by EventRow — always "now" so it sorts first
  city: string;
  category: string;
  latitude: number;
  longitude: number;
  venue: string;
  organizations: { name: string };
  tags: string[];
  blurb: string;
  // Extended details used by the landmark drawer.
  description: string;
  hours: string;
  photos: string[];
  // Neighbourhood used as Qloo's `filter.location.query` ("<district>, Istanbul")
  // for taste-ranked restaurants near the landmark. Never the user's GPS.
  district: string;
  // Qloo entity mapping (filled by scripts/qloo-map-landmarks.mjs). `entityId`
  // null means no confident match: the UI must not label it as a Qloo result.
  qloo: { entityId: string | null; name?: string; confidence: "exact" | "likely" | "none" };
};

const nowIso = () => new Date().toISOString();

// Wikipedia Special:FilePath resolves to the latest version of a Commons
// image and is hotlink-friendly, so we get free, stable photos without
// embedding any third-party key.
const wiki = (file: string, width = 800) =>
  `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

export const ISTANBUL_LANDMARKS: Landmark[] = [
  {
    id: "lm-hagia-sophia",
    district: "Sultanahmet",
    qloo: { entityId: null, confidence: "none" },
    title: "Hagia Sophia",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0086,
    longitude: 28.9802,
    venue: "Sultanahmet",
    organizations: { name: "Historic Peninsula" },
    tags: ["history", "architecture", "byzantine", "ottoman"],
    blurb: "1,500 years of empire under one dome.",
    description:
      "Built in 537 as the cathedral of Constantinople, converted to a mosque in 1453, briefly a museum, and a working mosque again today. The dome — 31 metres across and a feat that defied 6th-century physics — still steals the room.",
    hours: "Open daily, prayer hours excepted · best visited early morning",
    photos: [
      wiki("Hagia Sophia Mars 2013.jpg"),
      wiki("Hagia Sophia Interior Dome.jpg"),
    ],
  },
  {
    id: "lm-blue-mosque",
    district: "Sultanahmet",
    qloo: { entityId: null, confidence: "none" },
    title: "Sultan Ahmed (Blue) Mosque",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0054,
    longitude: 28.9768,
    venue: "Sultanahmet",
    organizations: { name: "Historic Peninsula" },
    tags: ["architecture", "spiritual", "ottoman"],
    blurb: "Six minarets and 20,000 Iznik tiles.",
    description:
      "Ahmed I's 1616 imperial mosque — still an active place of worship. The interior is washed in the cool blue of more than 20,000 hand-painted Iznik tiles.",
    hours: "Open daily · closed to visitors during the five daily prayers",
    photos: [
      wiki("Sultan Ahmed Mosque Istanbul Turkey.jpg"),
      wiki("Blue Mosque Courtyard Dusk Wikimedia Commons.jpg"),
    ],
  },
  {
    id: "lm-topkapi",
    district: "Sultanahmet",
    qloo: { entityId: null, confidence: "none" },
    title: "Topkapı Palace",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0115,
    longitude: 28.9833,
    venue: "Sultanahmet",
    organizations: { name: "Historic Peninsula" },
    tags: ["history", "palace", "ottoman"],
    blurb: "The sultans' home for four centuries.",
    description:
      "From Mehmed II in the 1460s to the mid-19th century, this was the seat of the Ottoman Empire. Four courtyards, the Imperial Harem, and the Treasury with the Topkapı Dagger and the 86-carat Spoonmaker's Diamond.",
    hours: "Wed–Mon 09:00–18:00 · closed Tuesdays",
    photos: [
      wiki("Topkapi - 01.jpg"),
      wiki("Istanbul-Topkapi-Palace-IIIrd-court.jpg"),
    ],
  },
  {
    id: "lm-basilica-cistern",
    district: "Sultanahmet",
    qloo: { entityId: null, confidence: "none" },
    title: "Basilica Cistern",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0084,
    longitude: 28.9779,
    venue: "Sultanahmet",
    organizations: { name: "Historic Peninsula" },
    tags: ["history", "underground", "byzantine"],
    blurb: "336 columns standing in a quiet underground lake.",
    description:
      "A 6th-century subterranean reservoir that once held 80,000 m³ of water for the Great Palace. Two upturned Medusa heads hold up columns at the back — nobody quite agrees why.",
    hours: "Daily 09:00–22:00 · later hours are quieter and atmospheric",
    photos: [
      wiki("Cisterna Basílica, Estambul, Turquía, 2023-06-30, DD 86-88 HDR.jpg"),
      wiki("Medusa Basilica Cistern.jpg"),
    ],
  },
  {
    id: "lm-grand-bazaar",
    district: "Beyazıt",
    qloo: { entityId: null, confidence: "none" },
    title: "Grand Bazaar",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "market",
    latitude: 41.0106,
    longitude: 28.968,
    venue: "Beyazıt",
    organizations: { name: "Historic Peninsula" },
    tags: ["market", "shopping", "ottoman"],
    blurb: "4,000 shops, one labyrinth, since 1461.",
    description:
      "One of the world's oldest and largest covered markets. 61 streets, 4,000 shops — carpets, gold, lanterns, leather. Haggling is expected; çay is offered.",
    hours: "Mon–Sat 09:00–19:00 · closed Sundays and religious holidays",
    photos: [
      wiki("Grand Bazaar Shop.jpg"),
      wiki("Kapalıçarşı'da gezinti - panoramio.jpg"),
    ],
  },
  {
    id: "lm-spice-bazaar",
    district: "Eminönü",
    qloo: { entityId: null, confidence: "none" },
    title: "Spice Bazaar",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "market",
    latitude: 41.0165,
    longitude: 28.9706,
    venue: "Eminönü",
    organizations: { name: "Historic Peninsula" },
    tags: ["market", "food", "spices"],
    blurb: "Saffron, lokum, and dried rose petals.",
    description:
      "The 1660 Egyptian Bazaar, smaller and far more fragrant than the Grand Bazaar. Pyramids of spice, Turkish delight, dried fruit, and cheese the colour of butter.",
    hours: "Mon–Sat 08:00–19:30 · Sun 09:30–19:00",
    photos: [
      wiki("Spice Bazaar Istanbul.jpg"),
      wiki("Spice Bazaar at Istanbul.jpg"),
    ],
  },
  {
    id: "lm-galata-tower",
    district: "Karaköy",
    qloo: { entityId: null, confidence: "none" },
    title: "Galata Tower",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0256,
    longitude: 28.9744,
    venue: "Galata",
    organizations: { name: "Beyoğlu" },
    tags: ["views", "history", "genoese"],
    blurb: "The best 360° of the Bosphorus skyline.",
    description:
      "A 67-metre Genoese tower from 1348. The viewing gallery at the top frames the Golden Horn, Sultanahmet across the water, and — on a clear day — both bridges over the Bosphorus.",
    hours: "Daily 08:30–23:00 · sunset slot is busiest",
    photos: [
      wiki("Galata Tower in 2013.JPG"),
      wiki("Istanbul - Galata Kulesi gece.jpg"),
    ],
  },
  {
    id: "lm-istiklal",
    district: "Beyoğlu",
    qloo: { entityId: null, confidence: "none" },
    title: "İstiklal Avenue",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "neighborhood",
    latitude: 41.0345,
    longitude: 28.9776,
    venue: "Beyoğlu",
    organizations: { name: "Beyoğlu" },
    tags: ["walking", "shopping", "nightlife", "cafés"],
    blurb: "1.4 km of cafés, bookshops, and the red tram.",
    description:
      "A pedestrianised 19th-century boulevard linking Taksim to Tünel. The historic red tram still rattles down the middle past patisseries, consulates, bookshops and music venues.",
    hours: "Always open · liveliest after 18:00",
    photos: [
      wiki("Istiklal Avenue Istanbul.jpg"),
      wiki("Istanbul - Istiklal Caddesi (5077266881).jpg"),
    ],
  },
  {
    id: "lm-taksim",
    district: "Beyoğlu",
    qloo: { entityId: null, confidence: "none" },
    title: "Taksim Square",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "neighborhood",
    latitude: 41.0369,
    longitude: 28.985,
    venue: "Taksim",
    organizations: { name: "Beyoğlu" },
    tags: ["center", "transit", "nightlife"],
    blurb: "The modern heart of the European side.",
    description:
      "The civic centre of modern Istanbul — funicular, metro, buses, the Republic Monument, and the new Taksim Mosque all share one wide plaza. A natural starting point for an evening walk down İstiklal.",
    hours: "Always open",
    photos: [
      wiki("Taksim Square Istanbul Türkiye.jpg"),
      wiki("Taksim Square at night, Istanbul.jpg"),
    ],
  },
  {
    id: "lm-dolmabahce",
    district: "Beşiktaş",
    qloo: { entityId: null, confidence: "none" },
    title: "Dolmabahçe Palace",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0391,
    longitude: 29.0001,
    venue: "Beşiktaş",
    organizations: { name: "Bosphorus" },
    tags: ["palace", "ottoman", "bosphorus"],
    blurb: "Where the empire went baroque on the waterfront.",
    description:
      "The 19th-century Bosphorus-side replacement for Topkapı. 285 rooms, a 4.5-tonne chandelier in the Ceremonial Hall, and the apartment where Atatürk died in 1938 — its clocks are all stopped at 09:05.",
    hours: "Tue–Sun 09:00–16:00 · closed Mondays",
    photos: [
      wiki("Dolmabahçe Palace from Bosphorus 02.jpg"),
      wiki("Dolmabahçe Palace - Ceremonial Hall (chandelier).jpg"),
    ],
  },
  {
    id: "lm-bosphorus-cruise",
    district: "Eminönü",
    qloo: { entityId: null, confidence: "none" },
    title: "Bosphorus Ferry",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "experience",
    latitude: 41.0173,
    longitude: 28.9756,
    venue: "Eminönü Pier",
    organizations: { name: "Şehir Hatları" },
    tags: ["bosphorus", "water", "views"],
    blurb: "Two continents, one hour, a glass of çay.",
    description:
      "The public Şehir Hatları ferry from Eminönü to Kadıköy or up the Bosphorus is the cheapest sightseeing in town. Palaces, wooden yalı mansions, Rumeli Fortress — and tea served by the deckhand for a few lira.",
    hours: "First boat ~07:00 · last evening crossings ~22:00",
    photos: [
      wiki("Şehir Hatları ferry on the Bosphorus.jpg"),
      wiki("Bosphorus Istanbul.jpg"),
    ],
  },
  {
    id: "lm-maiden-tower",
    district: "Üsküdar",
    qloo: { entityId: null, confidence: "none" },
    title: "Maiden's Tower (Kız Kulesi)",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0211,
    longitude: 29.0041,
    venue: "Üsküdar",
    organizations: { name: "Asian Side" },
    tags: ["bosphorus", "island", "history"],
    blurb: "The little islet with the very big legend.",
    description:
      "A tiny tower on its own islet off the Asian shore, dating in some form to 408 BC. The current Ottoman building was restored in 2023 and is reached by a short shuttle boat from Üsküdar or Salacak.",
    hours: "Daily 09:00–19:00 · last shuttle ~18:30",
    photos: [
      wiki("Maiden Tower Istanbul.jpg"),
      wiki("Kiz Kulesi Istanbul 2008.JPG"),
    ],
  },
  {
    id: "lm-suleymaniye",
    district: "Fatih",
    qloo: { entityId: null, confidence: "none" },
    title: "Süleymaniye Mosque",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0161,
    longitude: 28.964,
    venue: "Fatih",
    organizations: { name: "Historic Peninsula" },
    tags: ["architecture", "spiritual", "ottoman", "sinan"],
    blurb: "Mimar Sinan's masterpiece, perched over the Horn.",
    description:
      "Built in 1557 for Süleyman the Magnificent, this is the high point of architect Mimar Sinan's career. The terrace behind the mosque has the best free view over the Golden Horn.",
    hours: "Open daily, prayer hours excepted",
    photos: [
      wiki("Süleymaniye Mosque - Istanbul.jpg"),
      wiki("Suleymaniye Mosque dome interior 2007.jpg"),
    ],
  },
  {
    id: "lm-chora",
    district: "Edirnekapı",
    qloo: { entityId: null, confidence: "none" },
    title: "Chora Church (Kariye)",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0314,
    longitude: 28.9394,
    venue: "Edirnekapı",
    organizations: { name: "Historic Peninsula" },
    tags: ["byzantine", "mosaics", "art"],
    blurb: "The mosaics that quietly rival Ravenna.",
    description:
      "A small 11th-century church reshelled in the 14th with one of the finest cycles of late-Byzantine mosaics and frescoes anywhere. Tucked behind the land walls — most visitors skip it.",
    hours: "Daily 09:00–18:30 · check status for prayer-hour closures",
    photos: [
      wiki("Istanbul - Chiesa di S.Salvatore in Chora - Foto G. Dall'Orto 26-5-2006.jpg"),
      wiki("Chora Church Constantinople 2007 panorama 002.jpg"),
    ],
  },
  {
    id: "lm-kadikoy",
    district: "Kadıköy",
    qloo: { entityId: null, confidence: "none" },
    title: "Kadıköy & Moda",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "neighborhood",
    latitude: 40.9881,
    longitude: 29.0303,
    venue: "Kadıköy",
    organizations: { name: "Asian Side" },
    tags: ["food", "cafés", "local", "seaside"],
    blurb: "The Asian-side day: fish market, cats, slow coffee.",
    description:
      "The Asian-side neighbourhood locals send you to: the fish market on Güneşlibahçe Sokak, third-wave coffee in Moda, vinyl shops, and a long seaside park for a sunset walk back toward the ferry.",
    hours: "Always open · market stalls best 10:00–19:00",
    photos: [
      wiki("Kadıköy fish market.jpg"),
      wiki("Moda, Kadıköy, İstanbul.jpg"),
    ],
  },
  {
    id: "lm-ortakoy",
    district: "Ortaköy",
    qloo: { entityId: null, confidence: "none" },
    title: "Ortaköy Mosque",
    starts_at: nowIso(),
    city: "Istanbul",
    category: "landmark",
    latitude: 41.0473,
    longitude: 29.0271,
    venue: "Ortaköy",
    organizations: { name: "Bosphorus" },
    tags: ["bosphorus", "photogenic", "neo-baroque"],
    blurb: "The bridge, the mosque, the postcard.",
    description:
      "A neo-baroque mosque from 1856 sitting on the water, framed by the 15 July Martyrs (Bosphorus) Bridge behind it. The square in front is the city's favourite kumpir (stuffed potato) and waffle stop.",
    hours: "Open daily, prayer hours excepted",
    photos: [
      wiki("Ortaköy Mosque and the Bosphorus Bridge.jpg"),
      wiki("Ortaköy Mosque at night.jpg"),
    ],
  },
];
