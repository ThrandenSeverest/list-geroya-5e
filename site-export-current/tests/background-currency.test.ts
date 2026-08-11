import assert from "node:assert/strict";
import { backgroundEquipmentWithoutStartingGold, backgroundRule, backgroundStartingGold } from "../app/backgroundRules";
import { selectedEquipment } from "../app/equipment";

assert.equal(backgroundStartingGold("acolyte"), 15, "Acolyte starts with 15 gp in the wallet");
assert.equal(backgroundStartingGold("hermit"), 5, "The hermit's plain '5 зм' entry is also starting money");
for (const backgroundId of ["acolyte", "charlatan", "criminal", "entertainer", "folkhero", "guild", "hermit", "noble", "outlander", "sage", "sailor", "soldier", "urchin"]) {
  assert.ok(backgroundStartingGold(backgroundId) > 0, `${backgroundId} must contribute starting gold to the wallet`);
}
assert.deepEqual(backgroundEquipmentWithoutStartingGold(backgroundRule("noble").equipment), ["Комплект отличной одежды", "Кольцо-печатка", "Свиток с генеалогическим древом"], "Pouch text must never be an inventory item");
assert.doesNotMatch(selectedEquipment({ className: "fighter", background: "soldier", equipmentSelections: {} }).join(" · "), /кошел(?:[её]к|ь)|\d+\s*зм/i, "Printed inventory must not duplicate background coins");

console.log("Background starting gold is placed in the wallet and removed from inventory.");
