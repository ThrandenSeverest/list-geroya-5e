import { assetUrl } from "./assetUrl";
import manifest from "../public/paperdoll/manifest.json";

export function PaperdollIcon({ raceId, classId, className = "sigil", title = "" }: {
  raceId: string; classId?: string; className?: string; title?: string;
}) {
  const race = manifest.races[raceId as keyof typeof manifest.races];
  if (!race) return null;
  const outfit = classId && manifest.classes.includes(classId) ? classId : undefined;
  return <span className={`${className} catalog-icon paperdoll-icon`} title={title} aria-hidden="true" data-race={raceId} data-body={race.body} data-class={outfit || ""}>
    <img className="paperdoll-layer" src={assetUrl(`paperdoll/bases/${raceId}.png`)} alt="" loading="lazy" decoding="async" />
    {outfit && <>
      <img className="paperdoll-layer" src={assetUrl(`paperdoll/overlays/${race.body}/${outfit}.png`)} alt="" loading="lazy" decoding="async" />
      <img className="paperdoll-layer" src={assetUrl(`paperdoll/heads/${raceId}.png`)} alt="" loading="lazy" decoding="async" />
    </>}
  </span>;
}

export function hasPaperdollRace(id: string) { return Object.hasOwn(manifest.races, id); }
