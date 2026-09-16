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

const flattenedMoonCircle = "На 2-м уровне вы можете превращаться в Зверя с ПО до 1. С 6-го уровня максимально ПО равен уровню друида ÷ 3 с округлением вниз. | **Уровень** | **Макс. ПО** | **Ограничения** | |-----------|-------------|-------------------------------| | 2–3 | 1 | Без скорости плавания и полёта | | 4–5 | 1 | Без скорости полёта | | 6–7 | 2 | Без скорости полёта | | 8 | 2 | — | | 9–11 | 3 | — | | 12–14 | 4 | — | | 15–17 | 5 | — | | 18–20 | 6 | — |";
const flattenedPlain = normalizeExportText(flattenedMoonCircle);
assert.equal(flattenedPlain.includes("**"), false);
assert.equal(flattenedPlain.includes("|"), false);
assert.match(flattenedPlain, /^На 2-м уровне/m);
assert.match(flattenedPlain, /• Уровень: 2–3; Макс\. ПО: 1; Ограничения: Без скорости плавания и полёта/);
assert.match(flattenedPlain, /• Уровень: 18–20; Макс\. ПО: 6; Ограничения: —/);

const regularText = normalizeExportText("**Важно.** Используйте 1к6 урона.\n- Первый пункт\n- Второй пункт");
assert.equal(regularText, "Важно. Используйте 1к6 урона.\n• Первый пункт\n• Второй пункт");

console.log("Export text normalization passed: regular and flattened Markdown tables become readable plain-text rows.");
