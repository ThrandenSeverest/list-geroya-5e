import test from "node:test";
import assert from "node:assert/strict";
import { effectHandlingLabel, markFeature } from "../app/featureHandling";
import type { Feature } from "../app/rules";
const feature = (name: string): Feature => ({ name, description: "Текст правила." });
test("curated features distinguish applied values, conditions and manual use", () => {
  assert.equal(markFeature(feature("Бард · Мастер на все руки"), "class", "bard").effectHandling, "automatic");
  assert.equal(markFeature(feature("Варвар · Быстрое передвижение"), "class", "barbarian").effectHandling, "conditional");
  assert.equal(markFeature(feature("Воин · Всплеск действий"), "class", "fighter").effectHandling, "manual");
  assert.equal(markFeature(feature("Когти"), "race", "tortle").effectHandling, "automatic");
  assert.equal(markFeature(feature("Защита панцирем"), "race", "tortle").effectHandling, "conditional");
  assert.equal(markFeature(feature("Бдительный"), "feat", "", "alert").effectHandling, "automatic");
  assert.equal(effectHandlingLabel("manual"), "Применяется вручную");
});
test("unreviewed entries stay unmarked, even if their prose mentions a bonus", () => {
  const unknown = feature("Неизвестный бонус к скорости +10");
  assert.deepEqual(markFeature(unknown, "class", "fighter"), unknown);
  assert.deepEqual(markFeature(feature("Быстрое передвижение"), "class", "wizard"), feature("Быстрое передвижение"));
});
