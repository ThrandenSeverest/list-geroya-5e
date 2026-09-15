import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Anvil,
  Axe,
  Bird,
  Bone,
  BookOpen,
  Building2,
  Brain,
  Bug,
  Cat,
  CircleDot,
  Clover,
  Cog,
  Compass,
  Crown,
  Drama,
  Droplets,
  Dumbbell,
  Eye,
  Feather,
  FishSymbol,
  Flame,
  FlaskConical,
  Footprints,
  Gem,
  Ghost,
  Hand,
  Handshake,
  Hammer,
  HeartPulse,
  Leaf,
  KeyRound,
  Moon,
  Mountain,
  MapPinned,
  Music,
  Orbit,
  PawPrint,
  Rabbit,
  Rat,
  ScrollText,
  ShipWheel,
  Shell,
  Shield,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Sword,
  Swords,
  TentTree,
  TreePine,
  Trees,
  UserRound,
  VenetianMask,
  WandSparkles,
  Waves,
  Wind,
} from "lucide-react";

const raceIcons: Record<string, LucideIcon> = {
  human: Shield,
  dwarf: Anvil,
  elf: Leaf,
  halfling: Clover,
  dragonborn: Flame,
  gnome: Cog,
  halfelf: Sprout,
  halforc: Axe,
  tiefling: Flame,
  aarakocra: Bird,
  aasimar: Sun,
  bugbear: PawPrint,
  centaur: TentTree,
  changeling: VenetianMask,
  deepgnome: Gem,
  duergar: Hammer,
  eladrin: Sparkles,
  fairy: WandSparkles,
  firbolg: Trees,
  genasi: Wind,
  githyanki: Sword,
  githzerai: Brain,
  goblin: Rat,
  goliath: Mountain,
  harengon: Rabbit,
  hobgoblin: ShieldCheck,
  kenku: Feather,
  kobold: Flame,
  lizardfolk: Bone,
  locathah: FishSymbol,
  minotaur: Axe,
  orc: Axe,
  satyr: Music,
  seafelf: FishSymbol,
  shadarkai: Moon,
  shifter: PawPrint,
  tabaxi: Cat,
  tortle: Shell,
  triton: Waves,
  yuanpure: CircleDot,
  vedalken: Brain,
  simichybrid: FlaskConical,
  loxodon: Mountain,
  warforged: Cog,
  kalashtar: Eye,
  verdan: Sparkles,
  leonin: Crown,
  owlin: Bird,
  kender: Clover,
  grung: Droplets,
  hexblood: Moon,
  reborn: Ghost,
  dhampir: HeartPulse,
  customlineage: UserRound,
  hadozee: Trees,
  autognome: Cog,
  astralelf: Orbit,
  giff: Dumbbell,
  plasmoid: Droplets,
  thrikreen: Bug,
};

const classIcons: Record<string, LucideIcon> = {
  barbarian: Axe,
  bard: Music,
  cleric: Sun,
  druid: TreePine,
  fighter: Swords,
  monk: Hand,
  paladin: ShieldCheck,
  ranger: Feather,
  rogue: VenetianMask,
  sorcerer: Sparkles,
  warlock: Eye,
  wizard: BookOpen,
  artificer: FlaskConical,
};

const classSecondaryIcons: Record<string, LucideIcon> = {
  barbarian: Flame, bard: Sparkles, cleric: Shield, druid: Moon, fighter: Shield, monk: Wind,
  paladin: Sun, ranger: Leaf, rogue: KeyRound, sorcerer: Flame, warlock: Moon, wizard: Sparkles, artificer: Cog,
};

const raceSecondaryIcons: Record<string, LucideIcon> = {
  human: Crown, dwarf: Mountain, elf: Moon, halfling: Clover, dragonborn: Shield, gnome: Sparkles,
  halfelf: Sparkles, halforc: Shield, tiefling: Moon, aasimar: Sparkles, warforged: ShieldCheck,
};

const backgroundIcons: Record<string, LucideIcon> = {
  acolyte: Sun,
  charlatan: VenetianMask,
  criminal: KeyRound,
  entertainer: Drama,
  folkhero: Hammer,
  guild: Gem,
  hermit: TentTree,
  noble: Crown,
  outlander: MapPinned,
  sage: BookOpen,
  sailor: ShipWheel,
  soldier: Shield,
  urchin: Footprints,
  citywatch: Building2,
  clan: Anvil,
  courtier: Handshake,
  faction: ShieldCheck,
  fartraveler: Compass,
  inheritor: ScrollText,
  investigator: Eye,
  mercenary: Swords,
  urbanbounty: Feather,
  uthgardt: Mountain,
  waterdhavian: Building2,
  haunted: Ghost,
  feylost: Sparkles,
  witchlight: Moon,
  astraldrifter: Orbit,
  wildspacer: WandSparkles,
  strixstudent: BookOpen,
};

type CatalogIconProps = {
  id?: string;
  kind: "race" | "class" | "background";
  fallback?: string;
  className?: string;
  experimental?: boolean;
};

type ExperimentalIcon = { sheet: string; cell: number };
const experimentalClasses: Record<string, ExperimentalIcon> = {
  barbarian: { sheet: "classes-core", cell: 0 }, bard: { sheet: "classes-core", cell: 1 }, cleric: { sheet: "classes-core", cell: 2 }, druid: { sheet: "classes-core", cell: 3 }, fighter: { sheet: "classes-core", cell: 4 }, monk: { sheet: "classes-core", cell: 5 }, paladin: { sheet: "classes-core", cell: 6 }, ranger: { sheet: "classes-core", cell: 7 }, rogue: { sheet: "classes-core", cell: 8 }, sorcerer: { sheet: "classes-arcane", cell: 0 }, warlock: { sheet: "classes-arcane", cell: 1 }, wizard: { sheet: "classes-arcane", cell: 2 }, artificer: { sheet: "classes-arcane", cell: 3 },
};
const experimentalRaces: Record<string, ExperimentalIcon> = {};
function addRaceSheet(sheet: string, ids: string[]) { ids.forEach((id, cell) => { experimentalRaces[id] = { sheet, cell }; }); }
addRaceSheet("races-base", ["human", "dwarf", "elf", "halfling", "dragonborn", "gnome", "halfelf", "halforc", "tiefling"]);
addRaceSheet("races-fey", ["aarakocra", "aasimar", "bugbear", "centaur", "changeling", "deepgnome", "duergar", "eladrin", "fairy"]);
addRaceSheet("races-firbolg", ["firbolg", "genasi", "githyanki", "githzerai", "goblin", "goliath", "harengon", "hobgoblin", "kenku"]);
addRaceSheet("races-kobold", ["kobold", "lizardfolk", "minotaur", "orc", "satyr", "seafelf", "shadarkai", "shifter", "tabaxi"]);
addRaceSheet("races-leonin", ["leonin", "owlin", "kender", "grung", "hexblood", "reborn", "dhampir", "hadozee", "kalashtar"]);
addRaceSheet("races-tortle", ["tortle", "triton", "yuanpure", "vedalken", "simichybrid", "loxodon", "warforged", "kalashtar", "verdan"]);
addRaceSheet("races-spelljammer", ["autognome", "astralelf", "giff", "plasmoid", "thrikreen"]);

export function CatalogIcon({ id = "", kind, fallback = "?", className = "sigil", experimental = false }: CatalogIconProps) {
  if (kind === "race" && id === "locathah") {
    return <span className={`${className} catalog-icon experimental-catalog-icon locathah-catalog-icon`} aria-hidden="true" title={fallback} />;
  }
  const experimentalIcon = experimental ? (kind === "class" ? experimentalClasses[id] : kind === "race" ? experimentalRaces[id] : undefined) : undefined;
  if (experimentalIcon) {
    return <span className={`${className} catalog-icon experimental-catalog-icon`} aria-hidden="true" title={fallback} data-sheet={experimentalIcon.sheet} style={{ "--experimental-sheet": `url('/experimental/cells/${experimentalIcon.sheet}-${experimentalIcon.cell}.png')` } as CSSProperties} />;
  }
  const Icon = (kind === "race" ? raceIcons : kind === "class" ? classIcons : backgroundIcons)[id] || ScrollText;
  const Secondary = kind === "race" ? raceSecondaryIcons[id] : kind === "class" ? classSecondaryIcons[id] : undefined;
  return (
    <span className={`${className} catalog-icon`} aria-hidden="true" title={fallback}>
      <i className="sigil-ray sigil-ray-a" />
      <i className="sigil-ray sigil-ray-b" />
      <Icon className="sigil-primary" />
      {Secondary && <Secondary className="sigil-secondary" />}
      <b className="sigil-jewel">◆</b>
    </span>
  );
}
