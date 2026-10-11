import type { CSSProperties } from 'react';
import { assetUrl } from './assetUrl';

type Mode = 'tavern' | 'adventures';

export function ModeSigns({ value, tavernCount, adventureCount, onChange }: {
  value: Mode;
  tavernCount: number;
  adventureCount: number;
  onChange: (mode: Mode) => void;
}) {
  return <nav className="mode-signs" aria-label="Таверна и приключения">
    {([
      ['tavern', 'Таверна', tavernCount],
      ['adventures', 'Приключения', adventureCount],
    ] as const).map(([mode, label, count]) => <button
      key={mode}
      type="button"
      className="mode-sign"
      aria-pressed={value === mode}
      onClick={() => onChange(mode)}
    >
      <span className="mode-sign-art" aria-hidden="true" style={{
        '--mode-sign-image': `url("${assetUrl(`mode-signs/${mode}.svg`)}")`,
      } as CSSProperties} />
      <span className="mode-sign-label">{label}</span>
      <span className="mode-sign-count">{count} героев</span>
    </button>)}
  </nav>;
}
