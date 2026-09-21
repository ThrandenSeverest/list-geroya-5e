import assert from "node:assert/strict";
import { normalizeExportText } from "../app/exportText";

const markdownTable = `**Ограничения**
| Уровень | Количество | Ограничение |
| --- | ---: | --- |
| 2-3 | 1 | Без скорости плавания и полёта |
| 4-5 | 1 | Без скорости полёта |
| 8 | 2 | — |`;

const plain = normalizeExportText(markdownTable);
assert.equal(plain.includes("**"), false);
assert.equal(plain.includes("| ---"), false);
assert.equal(plain.includes("| 2-3"), false);
assert.match(plain, /^Ограничения/m);
assert.match(plain, /• Уровень: 2-3; Количество: 1; Ограничение: Без скорости плавания и полёта/);
assert.match(plain, /• Уровень: 8; Количество: 2; Ограничение: —/);

const collapsedTable = normalizeExportText("До таблицы. | Уровень | Макс. ПО | Ограничения | | --- | --- | --- | | 2–3 | 1/4 | Без скорости плавания и полёта | | 4–7 | 1/2 | Без скорости полёта |");
assert.equal(collapsedTable.includes("| ---"), false);
assert.equal(collapsedTable.includes("| 2–3"), false);
assert.match(collapsedTable, /• Уровень: 2–3; Макс\. ПО: 1\/4; Ограничения: Без скорости плавания и полёта/);
assert.match(collapsedTable, /• Уровень: 4–7; Макс\. ПО: 1\/2; Ограничения: Без скорости полёта/);

const regularText = normalizeExportText("**Важно.** Используйте 1к6 урона.\n- Первый пункт\n- Второй пункт");
assert.equal(regularText, "Важно. Используйте 1к6 урона.\n• Первый пункт\n• Второй пункт");

console.log("Export text normalization passed: Markdown tables become readable plain-text rows.");
