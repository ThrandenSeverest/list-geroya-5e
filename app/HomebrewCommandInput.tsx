'use client';
import { useEffect, useId, useRef, useState, type RefObject, type KeyboardEvent } from 'react';
import { commandQuery, descriptionCommands, filterCommands, formulaCommands, insertCommand, type HBCommand } from './homebrewCommands';

export function HomebrewCommandInput({ value, onChange, label, multiline = false, rows = 5, inputRef, onKeyDown }: {
  value: string; onChange: (value: string) => void; label: string; multiline?: boolean; rows?: number;
  inputRef?: RefObject<HTMLTextAreaElement | null>; onKeyDown?: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  const ownRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const ref = inputRef || ownRef;
  const id = useId();
  const [range, setRange] = useState<ReturnType<typeof commandQuery>>(null);
  const [selected, setSelected] = useState(0);
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const commands = multiline ? [...descriptionCommands, ...formulaCommands] : formulaCommands;
  const options = range ? filterCommands(commands, range.query) : [];
  useEffect(() => {
    if (range) document.getElementById(`${id}-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, selected, range]);
  const insert = (command: HBCommand) => {
    const node = ref.current;
    const start = range?.start ?? node?.selectionStart ?? value.length;
    const end = range?.end ?? node?.selectionEnd ?? start;
    const result = insertCommand(value, start, end, command);
    onChange(result.value); setRange(null);
    requestAnimationFrame(() => { node?.focus(); node?.setSelectionRange(result.caret, result.caret); });
  };
  const props = {
    'aria-label': label, value,
    'aria-controls': range ? id : undefined,
    'aria-expanded': !!range,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': range && options[selected] ? `${id}-${selected}` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value); setRange(commandQuery(event.target.value, event.target.selectionStart ?? event.target.value.length)); setSelected(0);
    },
    onClick: () => { const node = ref.current; setRange(commandQuery(value, node?.selectionStart ?? value.length)); setSelected(0); },
    onBlur: () => setRange(null),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (range && event.key === 'Escape') { event.preventDefault(); setRange(null); return; }
      if (range && options.length && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Enter') insert(options[selected] || options[0]);
        else setSelected(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) setRange(null);
      onKeyDown?.(event);
    },
  };
  return <div className="hb-command-input">
    {multiline ? <textarea {...props} rows={rows} ref={ref as RefObject<HTMLTextAreaElement | null>} /> : <input {...props} ref={ownRef as RefObject<HTMLInputElement | null>} />}
    {range && <div id={id} role="listbox" aria-label={`Команды: ${label}`} className="hb-command-menu">
      {options.map((command, index) => <button type="button" role="option" id={`${id}-${index}`} aria-selected={index === selected} key={command.command}
        onMouseDown={event => event.preventDefault()} onClick={() => insert(command)}><code>{command.command}</code><span>{command.description}</span></button>)}
      {!options.length && <p>Команда не найдена. Попробуйте «уровень», «урон» или «ресурс».</p>}
      <small>↑ ↓ выбрать · Enter вставить · Esc закрыть</small>
    </div>}
    <button type="button" className="hb-command-toggle" aria-expanded={browse} onClick={() => setBrowse(!browse)}>@ Команды и примеры</button>
    {browse && <div className="hb-command-browser"><input aria-label={`Поиск команд: ${label}`} placeholder="Название или назначение команды" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label={`Группа команд: ${label}`} value={group} onChange={event => setGroup(event.target.value)}><option value="">Все команды</option>{[...new Set(commands.map(command => command.group))].map(name => <option key={name} value={name}>{name}</option>)}</select>
      {filterCommands(commands, search).filter(command => !group || command.group === group).map(command => <button type="button" key={command.command} onMouseDown={event => event.preventDefault()} onClick={() => insert(command)}><code>{command.command}</code><span>{command.description}</span><small>{command.insert}</small></button>)}
    </div>}
  </div>;
}
