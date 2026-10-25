// Narrated stories for the landmark drawer. History and legend are separate,
// labelled sections — the UI never blends them. Hero landmarks get a full story
// (and, once produced, a pre-made AI film in `media`); every other landmark falls
// back to its curated description as a short intro.
//
// Facts were checked against commonly cited sources (museum/municipality pages,
// Wikipedia) when written on 25 Oct 2026; dates are given as "around" where the
// sources disagree. Keep narration ≤ ~400 words so it reads in under three minutes.
import { ISTANBUL_LANDMARKS, type Landmark } from "./istanbul-landmarks";

export type StorySectionKind = "history" | "legend";

export type StorySection = {
  kind: StorySectionKind;
  title: string;
  text: string;
};

export type StoryMedia = {
  /** Public mp4 (Supabase Storage bucket `stories`). */
  videoUrl: string;
  /** WebVTT captions; cue text starts with [History] or [Legend]. */
  captionsUrl?: string;
  posterUrl?: string;
  durationSec?: number;
  /** Shown under the player, e.g. "AI-generated visualisation (Veo 3.1); narration by …". */
  credits: string;
};

export type LandmarkStory = {
  landmarkId: string;
  /** True for hand-written stories; false for the description fallback. */
  authored: boolean;
  sections: StorySection[];
  sources?: string[];
  media?: StoryMedia;
};

const AUTHORED: LandmarkStory[] = [
  {
    landmarkId: "lm-basilica-cistern",
    authored: true,
    sources: ["https://yerebatan.com/en/", "https://en.wikipedia.org/wiki/Basilica_Cistern"],
    sections: [
      {
        kind: "history",
        title: "A forest of columns under the city",
        text:
          "You are standing in the largest of the several hundred cisterns that once lay beneath Constantinople. Emperor Justinian I had it built around 532, right after the Nika riots had burned much of the city, to store water for the Great Palace and the buildings around it. The water travelled almost twenty kilometres from the forests north of the city through aqueducts, and this hall could hold roughly eighty thousand cubic metres of it. " +
          "The space is about 138 metres long and 65 metres wide. Three hundred and thirty-six marble columns, each around nine metres tall, stand in twelve rows of twenty-eight and carry the brick vaults above you. Many of them were not carved for this place: the builders reused columns and capitals from older Roman and Greek buildings, which is why no two look quite alike. The cistern took its name from the Stoa Basilica, a public square that once stood above it.",
      },
      {
        kind: "history",
        title: "Lost and found",
        text:
          "After the Ottoman conquest in 1453 the cistern fell out of use and, within a few generations, out of memory. In 1545 the French scholar Petrus Gyllius, searching the city for Byzantine remains, heard that people in this neighbourhood lowered buckets through holes in their cellar floors and pulled up water — and sometimes fish. He followed the story down a stairway and found this hall. " +
          "For centuries afterwards it was a damp curiosity. The city cleared tonnes of mud and built the walkways in the 1980s and opened it to visitors in 1987; a long structural restoration finished in 2022, which is when the lighting you see today was installed.",
      },
      {
        kind: "legend",
        title: "The Medusa heads",
        text:
          "In the far north-west corner two columns rest on carved heads of Medusa, the Gorgon whose gaze turned onlookers to stone. One lies on its side, the other upside down. Nobody knows where the blocks came from; they were almost certainly taken from an older Roman building and used simply because they were the right size to level the columns. " +
          "The legend says otherwise: that the heads were turned deliberately, so Medusa could not look anyone in the eye, and that this is why the cistern never ran dry and never fell. Treat it as a story the city tells about itself — and notice how the water doubles each head when you look down.",
      },
      {
        kind: "legend",
        title: "The weeping column",
        text: "Near the Medusa heads one column is carved with teardrop shapes, sometimes called peacock eyes. Tradition says it weeps for the hundreds of enslaved workers who died building the cistern. There is no record of that, but the carving is real, and it is the one place here where visitors still fall silent.",
      },
    ],
  },
  {
    landmarkId: "lm-hagia-sophia",
    authored: true,
    sources: ["https://en.wikipedia.org/wiki/Hagia_Sophia"],
    sections: [
      {
        kind: "history",
        title: "Fifteen hundred years under one dome",
        text:
          "The building in front of you was finished in 537, after less than six years of work, for Emperor Justinian I. Its architects, Anthemius of Tralles and Isidore of Miletus, were a mathematician and a physicist rather than master builders, and they attempted something no one had done: a dome about thirty-one metres across floating over a square hall. The first dome fell in an earthquake in 558; the rebuilt, slightly taller dome has stood since 562. " +
          "For nine centuries this was the cathedral of Constantinople. After the city fell in 1453 Mehmed II converted it into a mosque, adding the minarets over the following decades. In 1934 it became a museum, and in 2020 a working mosque again. Look for the marble floor worn into waves by footsteps, and for the Viking runes scratched into a parapet in the upper gallery by a guard named Halfdan.",
      },
      {
        kind: "legend",
        title: "The sweating column and the vanished priest",
        text:
          "In the north-west of the nave stands a column with a worn bronze collar and a hole in it. Legend says it has stayed damp since the day Justinian leaned against it to cure a headache, and that if you put your thumb in the hole and turn your hand a full circle, a wish comes true. " +
          "A second legend belongs to the morning of 29 May 1453: as the city fell, a priest celebrating the liturgy is said to have walked into the eastern wall with the chalice and disappeared — to return and finish the service one day. Both are stories, not history, but they are the stories this room has carried for centuries.",
      },
    ],
  },
  {
    landmarkId: "lm-galata-tower",
    authored: true,
    sources: ["https://en.wikipedia.org/wiki/Galata_Tower"],
    sections: [
      {
        kind: "history",
        title: "The Genoese watchtower",
        text:
          "The Genoese merchants who ran the walled colony of Galata built this tower in 1348 and called it the Tower of Christ. At almost sixty-seven metres it was the tallest structure in the city for centuries, the highest point of the fortifications that climbed from the Golden Horn. " +
          "Under the Ottomans it served as a dungeon, a dormitory for the navy and, from the eighteenth century, as a fire lookout — ironically it burned several times itself and lost its conical roof to a storm in 1875. The roof you see was restored in the 1960s, and the tower reopened as a museum in 2020. Walk the gallery for the full circle: the Historic Peninsula, the Bosphorus and the Asian shore in one turn.",
      },
      {
        kind: "legend",
        title: "The man who flew",
        text: "The seventeenth-century traveller Evliya Çelebi wrote that around 1632 Hezârfen Ahmed Çelebi strapped on wings of his own design, leapt from this tower and glided across the Bosphorus to Üsküdar — several kilometres away. No other source confirms it, and the sultan, impressed and alarmed, is said to have rewarded him with gold and then exiled him to Algiers. Whether or not a man ever flew from here, the view explains why someone wanted to.",
      },
    ],
  },
];

const byId = new Map(AUTHORED.map((s) => [s.landmarkId, s]));

/** Story for a landmark; falls back to the curated description as a short intro. */
export function getLandmarkStory(landmark: Pick<Landmark, "id" | "description">): LandmarkStory {
  const authored = byId.get(landmark.id);
  if (authored) return authored;
  return {
    landmarkId: landmark.id,
    authored: false,
    sections: [{ kind: "history", title: "Short intro", text: landmark.description }],
  };
}

export function getLandmarkStoryById(landmarkId: string): LandmarkStory | null {
  const landmark = ISTANBUL_LANDMARKS.find((l) => l.id === landmarkId);
  return landmark ? getLandmarkStory(landmark) : null;
}

/** Ids with a hand-written story (hero landmarks for the demo). */
export const AUTHORED_STORY_IDS = AUTHORED.map((s) => s.landmarkId);
