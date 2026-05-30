/**
 * Concert-weekend bundle: the two stadium/club shows + offline summaries.
 *
 * This module is intentionally tiny and dependency-free so it can be bundled
 * into the service-worker cache and served at the venue with no network.
 *
 * IMPORTANT: transit line names / walk times below contain `TODO(verify)`
 * markers. Replace them with confirmed lines (M3/M7/T1/etc.) and current
 * minutes from IETT / Metro Istanbul before the show — DO NOT silently
 * remove the markers or invent values.
 */

export type ConcertVenue = {
  id: string;
  slug: "ataturk-olympic-stadium" | "grand-factory-tersane";
  title: string;
  shortTitle: string;
  venue: string;
  city: string;
  /** Local Istanbul date, formatted for display. */
  dateLabel: string;
  /** ISO start used for JSON-LD / sorting. */
  startsAt: string;
  /** Used by GettingThere — Yandex needs these in correct order (LAT,LON). */
  coords: { lat: number; lng: number };
  /** 1–2 sentence description, safe to show offline. */
  description: { en: string; ru: string };
  /** Pre-written offline-safe directions summary, shown when navigator.onLine === false. */
  offline: { en: string; ru: string };
};

// Free shuttle / bus note. IETT runs free buses after large events; the exact
// route numbers depend on the event and are announced shortly beforehand.
// TODO(verify): replace the placeholder line numbers when IETT publishes them.
export const FREE_BUS_NOTE = {
  en:
    "After the concert: the city runs ~100 free buses from the venue back to central districts (Taksim, Kadıköy, Beşiktaş, Bakırköy). " +
    "Look for marshals with green vests near the main exit. TODO(verify): confirm IETT route numbers closer to the date.",
  ru:
    "После концерта: город запускает ~100 бесплатных автобусов от площадки до центральных районов (Таксим, Кадыкёй, Бешикташ, Бакыркёй). " +
    "Ищите распорядителей в зелёных жилетах у главного выхода. TODO(verify): уточнить номера маршрутов IETT ближе к дате.",
};

export const CONCERT_VENUES: ConcertVenue[] = [
  {
    id: "0d3101bb-cccc-4001-8000-000000000530",
    slug: "ataturk-olympic-stadium",
    title: "Kanye West with Travis Scott — Atatürk Olympic Stadium",
    shortTitle: "Atatürk Olympic Stadium",
    venue: "Atatürk Olympic Stadium",
    city: "Istanbul",
    dateLabel: "Sat 30 May 2026 · 18:00 (doors)",
    startsAt: "2026-05-30T18:00:00+03:00",
    coords: { lat: 41.0814, lng: 28.7264 },
    description: {
      en:
        "Kanye West and Travis Scott headline a stadium night in Başakşehir. Gates open in the early evening; arrive by metro to skip the worst traffic.",
      ru:
        "Канье Уэст и Трэвис Скотт выступают на стадионе в Башакшехире. Ворота открываются ранним вечером; добирайтесь на метро, чтобы избежать пробок.",
    },
    offline: {
      en:
        "Closest metro: Başakşehir / Olimpiyatköy (TODO(verify): confirm exact M3 vs M9 stop and walk minutes). " +
        "Walk from station: ~10–15 min through the stadium grounds. " +
        "Coming from Taksim: M2 → Yenikapı, transfer to Marmaray or M3, then metro to the stadium stop. Allow 60–90 min door-to-door. " +
        "Getting home: see the free-bus note — marshals near the main exit point you to your district.",
      ru:
        "Ближайшее метро: Başakşehir / Olimpiyatköy (TODO(verify): уточнить точную станцию M3 / M9 и время пешком). " +
        "От станции пешком: ~10–15 мин по территории стадиона. " +
        "От Таксима: M2 → Yenikapı, пересадка на Marmaray или M3, затем метро до стадиона. Закладывайте 60–90 минут. " +
        "Обратно: смотрите заметку о бесплатных автобусах — у главного выхода распорядители подскажут ваш район.",
    },
  },
  {
    id: "0d3101bb-cccc-4001-8000-000000000531",
    slug: "grand-factory-tersane",
    title: "Travis Scott — Grand Factory, Tersane Istanbul",
    shortTitle: "Grand Factory, Tersane Istanbul",
    venue: "Grand Factory, Tersane Istanbul",
    city: "Istanbul",
    dateLabel: "Sun 31 May 2026 · 20:00 (doors)",
    startsAt: "2026-05-31T20:00:00+03:00",
    coords: { lat: 41.0344, lng: 28.9504 },
    description: {
      en:
        "Travis Scott plays Grand Factory at Tersane Istanbul, the restored Haliç shipyards on the Golden Horn. Smaller capacity — arrive early.",
      ru:
        "Трэвис Скотт играет в Grand Factory на территории Tersane Istanbul — отреставрированной верфи на Золотом Роге. Зал небольшой, приходите заранее.",
    },
    offline: {
      en:
        "Closest metro: Halıcıoğlu (M7) (TODO(verify): confirm walk minutes from station to the venue gate). " +
        "Taxi from Karaköy / Galata is short (~15–20 min) but traffic-dependent on a Saturday night. " +
        "On foot from Karaköy along the Golden Horn: ~30–40 min (TODO(verify): confirm waterfront path is open at night). " +
        "Getting home: see the free-bus note.",
      ru:
        "Ближайшее метро: Halıcıoğlu (M7) (TODO(verify): уточнить время пешком до входа). " +
        "Такси от Каракёя / Галаты: ~15–20 мин, но зависит от пробок в субботу вечером. " +
        "Пешком от Каракёя вдоль Золотого Рога: ~30–40 мин (TODO(verify): подтвердить, что набережная открыта ночью). " +
        "Обратно: смотрите заметку о бесплатных автобусах.",
    },
  },
];

/** Look up an offline summary by event/venue id. */
export function getOfflineSummary(eventId: string, lang: string): string | null {
  const v = CONCERT_VENUES.find((x) => x.id === eventId);
  if (!v) return null;
  const isRu = lang?.toLowerCase().startsWith("ru");
  const summary = isRu ? v.offline.ru : v.offline.en;
  const bus = isRu ? FREE_BUS_NOTE.ru : FREE_BUS_NOTE.en;
  return `${summary}\n\n${bus}`;
}
