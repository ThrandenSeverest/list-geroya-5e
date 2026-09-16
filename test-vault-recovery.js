(() => {
  const VAULT_KEY = "list-geroya-character-vault-v1";
  const BACKUP_KEY = "list-geroya-character-vault-v1-gh-pages-backup";
  const ORIGINAL_KEY = "herolist-recovery-original-v2";
  const SNAPSHOT_KEY = "herolist-recovery-snapshot-v2";
  const RECOVERY_VERSION = 2;
  const MAX_DEPTH = 5;
  const MAX_NODES = 15000;
  const MAX_SNAPSHOT_BYTES = 1800000;

  function parseJson(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function object(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function hasAbilityBlock(value) {
    if (!object(value?.abilities)) return false;
    return ["str", "dex", "con", "int", "wis", "cha"].filter(key => Number.isFinite(Number(value.abilities[key]))).length >= 3;
  }

  function characterScore(value) {
    if (!object(value)) return 0;
    let score = 0;
    if (typeof value.name === "string" && value.name.trim()) score += 1;
    if (typeof value.race === "string" && value.race.trim()) score += 2;
    if (typeof value.className === "string" && value.className.trim()) score += 2;
    if (Array.isArray(value.classes) && value.classes.some(item => item && typeof item.classId === "string" && item.classId)) score += 3;
    if (hasAbilityBlock(value)) score += 4;
    if (Number.isFinite(Number(value.level)) && Number(value.level) > 0) score += 1;
    if (Number.isFinite(Number(value.schemaVersion))) score += 2;
    if (typeof value.background === "string" && value.background.trim()) score += 1;
    if (object(value.personality)) score += 1;
    if (Array.isArray(value.spells)) score += 1;
    if (Array.isArray(value.feats)) score += 1;
    return score;
  }

  function looksLikeCharacter(value) {
    if (!object(value)) return false;
    const core = hasAbilityBlock(value)
      || (typeof value.className === "string" && !!value.className)
      || (typeof value.race === "string" && !!value.race)
      || (Array.isArray(value.classes) && value.classes.some(item => item && item.classId))
      || Number.isFinite(Number(value.schemaVersion));
    return core && characterScore(value) >= 4;
  }

  function isMeaningfulCharacter(value) {
    return looksLikeCharacter(value) && (
      String(value.name || "").trim()
      || String(value.race || "").trim()
      || String(value.className || "").trim()
      || String(value.background || "").trim()
      || String(value.subclass || "").trim()
      || (Array.isArray(value.classes) && value.classes.some(item => item && item.classId))
      || (Array.isArray(value.spells) && value.spells.length)
      || (Array.isArray(value.feats) && value.feats.length)
    );
  }

  function isVault(value) {
    return object(value) && Array.isArray(value.slots);
  }

  function meaningfulSlotCount(vault) {
    return isVault(vault)
      ? vault.slots.filter(slot => slot && isMeaningfulCharacter(slot.character)).length
      : 0;
  }

  function timestamp(value) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function fingerprint(character) {
    try { return JSON.stringify(character); } catch { return String(character?.name || "") + "|" + String(character?.className || ""); }
  }

  function hash(value) {
    let result = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      result ^= value.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  const candidates = [];
  const folders = new Map();
  const candidateSources = new Map();
  let visitedNodes = 0;

  function addCandidate(character, meta = {}) {
    if (!isMeaningfulCharacter(character)) return;
    candidates.push({
      character,
      id: typeof meta.id === "string" && meta.id ? meta.id : "",
      updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : "",
      folderId: typeof meta.folderId === "string" ? meta.folderId : undefined,
      source: String(meta.source || "unknown"),
    });
  }

  function walk(value, source, meta = {}, depth = 0, seen = new Set()) {
    if (depth > MAX_DEPTH || visitedNodes >= MAX_NODES) return;
    visitedNodes += 1;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length <= 4000000) {
        const parsed = parseJson(trimmed);
        if (parsed !== null) walk(parsed, source, meta, depth + 1, seen);
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (looksLikeCharacter(value)) {
      addCandidate(value, { ...meta, source });
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < Math.min(value.length, 1000); i += 1) {
        walk(value[i], source, meta, depth + 1, seen);
      }
      return;
    }

    if (Array.isArray(value.folders)) {
      for (const folder of value.folders) {
        if (folder && typeof folder.id === "string" && typeof folder.name === "string") {
          folders.set(folder.id, folder);
        }
      }
    }

    if (Array.isArray(value.slots)) {
      for (const slot of value.slots) {
        if (!slot || typeof slot !== "object") continue;
        if (slot.character) {
          addCandidate(slot.character, {
            id: slot.id,
            updatedAt: slot.updatedAt,
            folderId: slot.folderId,
            source,
          });
        } else {
          walk(slot, source, { id: slot.id, updatedAt: slot.updatedAt, folderId: slot.folderId }, depth + 1, seen);
        }
      }
    }

    const preferred = ["characters", "heroes", "saves", "items", "records", "vault", "data", "payload", "state", "character", "currentCharacter", "activeCharacter"];
    const visitedKeys = new Set(["slots", "folders"]);
    for (const key of preferred) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        visitedKeys.add(key);
        walk(value[key], source, meta, depth + 1, seen);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (visitedKeys.has(key)) continue;
      if (depth >= 3 && !["character", "characters", "heroes", "saves", "items", "records"].includes(key)) continue;
      walk(child, source, meta, depth + 1, seen);
    }
  }

  function scanStorage(storage, label) {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      const raw = storage.getItem(key);
      const parsed = parseJson(raw);
      if (parsed === null) continue;
      const before = candidates.length;
      walk(parsed, `${label}:${key}`);
      if (candidates.length > before && typeof raw === "string") {
        candidateSources.set(`${label}:${key}`, raw);
      }
    }
  }

  try { scanStorage(localStorage, "localStorage"); } catch {}
  try { scanStorage(sessionStorage, "sessionStorage"); } catch {}

  const primaryRaw = localStorage.getItem(VAULT_KEY);
  const primaryParsed = parseJson(primaryRaw);
  const primary = isVault(primaryParsed)
    ? primaryParsed
    : { version: 1, capacity: 5, activeId: "", slots: [], folders: [] };
  const primaryMeaningful = meaningfulSlotCount(primary);

  if (Array.isArray(primary.folders)) {
    for (const folder of primary.folders) {
      if (folder && typeof folder.id === "string" && typeof folder.name === "string") folders.set(folder.id, folder);
    }
  }

  const byId = new Map();
  const exact = new Set();
  const currentSlots = Array.isArray(primary.slots) ? primary.slots : [];

  for (const slot of currentSlots) {
    if (!slot || typeof slot !== "object") continue;
    const id = typeof slot.id === "string" && slot.id ? slot.id : `existing-${hash(JSON.stringify(slot))}`;
    byId.set(id, { ...slot, id });
    if (slot.character) exact.add(fingerprint(slot.character));
  }

  let recovered = 0;
  for (const candidate of candidates) {
    const fp = fingerprint(candidate.character);
    const preferredId = candidate.id || `recovered-${hash(candidate.source + "|" + fp)}`;
    const existing = byId.get(preferredId);

    if (existing) {
      const existingMeaningful = isMeaningfulCharacter(existing.character);
      const candidateIsBetter = !existingMeaningful
        || (timestamp(candidate.updatedAt) > timestamp(existing.updatedAt));
      if (candidateIsBetter) {
        byId.set(preferredId, {
          ...existing,
          id: preferredId,
          character: candidate.character,
          updatedAt: candidate.updatedAt || existing.updatedAt || new Date().toISOString(),
          folderId: candidate.folderId || existing.folderId,
        });
        if (!existingMeaningful) recovered += 1;
      }
      exact.add(fp);
      continue;
    }

    if (exact.has(fp)) continue;
    byId.set(preferredId, {
      id: preferredId,
      character: candidate.character,
      updatedAt: candidate.updatedAt || new Date().toISOString(),
      folderId: candidate.folderId,
    });
    exact.add(fp);
    recovered += 1;
  }

  const mergedSlots = [...byId.values()];
  const mergedMeaningful = mergedSlots.filter(slot => isMeaningfulCharacter(slot.character)).length;
  const folderList = [...folders.values()];
  const validFolderIds = new Set(folderList.map(folder => folder.id));
  const cleanedSlots = mergedSlots.map(slot => ({
    ...slot,
    folderId: slot.folderId && validFolderIds.has(slot.folderId) ? slot.folderId : undefined,
  }));
  const activeId = cleanedSlots.some(slot => slot.id === primary.activeId)
    ? primary.activeId
    : cleanedSlots.find(slot => isMeaningfulCharacter(slot.character))?.id || cleanedSlots[0]?.id || "";
  const mergedVault = {
    version: 1,
    capacity: Math.max(5, Number(primary.capacity) || 5, cleanedSlots.length),
    activeId,
    slots: cleanedSlots,
    folders: folderList,
  };

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }

  function snapshotCandidateSources() {
    if (localStorage.getItem(SNAPSHOT_KEY)) return;
    const sources = {};
    let used = 0;
    for (const [key, raw] of candidateSources.entries()) {
      const size = raw.length * 2;
      if (size > 900000 || used + size > MAX_SNAPSHOT_BYTES) continue;
      sources[key] = raw;
      used += size;
    }
    if (!Object.keys(sources).length) return;
    safeSet(SNAPSHOT_KEY, JSON.stringify({ version: RECOVERY_VERSION, createdAt: new Date().toISOString(), sources }));
  }

  const shouldWrite = mergedMeaningful > primaryMeaningful || (!isVault(primaryParsed) && mergedMeaningful > 0);
  if (shouldWrite) {
    if (primaryRaw && !localStorage.getItem(ORIGINAL_KEY)) safeSet(ORIGINAL_KEY, primaryRaw);
    snapshotCandidateSources();
    const mergedRaw = JSON.stringify(mergedVault);
    safeSet(VAULT_KEY, mergedRaw);
    const backupParsed = parseJson(localStorage.getItem(BACKUP_KEY));
    if (meaningfulSlotCount(backupParsed) < mergedMeaningful) safeSet(BACKUP_KEY, mergedRaw);
  } else if (isVault(primaryParsed) && primaryMeaningful > 0) {
    const backupParsed = parseJson(localStorage.getItem(BACKUP_KEY));
    if (meaningfulSlotCount(backupParsed) < primaryMeaningful) safeSet(BACKUP_KEY, primaryRaw);
  }

  window.__HEROLIST_RECOVERY__ = {
    version: RECOVERY_VERSION,
    scannedCandidates: candidates.length,
    primaryCharacters: primaryMeaningful,
    mergedCharacters: shouldWrite ? mergedMeaningful : primaryMeaningful,
    recoveredCharacters: Math.max(0, (shouldWrite ? mergedMeaningful : primaryMeaningful) - primaryMeaningful),
    sourceKeys: [...candidateSources.keys()],
  };

  const restoredCount = window.__HEROLIST_RECOVERY__.recoveredCharacters;
  if (restoredCount > 0) {
    const announce = () => {
      if (document.getElementById("herolist-recovery-banner")) return;
      const banner = document.createElement("div");
      banner.id = "herolist-recovery-banner";
      banner.textContent = `Восстановлено старых персонажей: ${restoredCount}`;
      Object.assign(banner.style, {
        position: "fixed",
        left: "50%",
        top: "12px",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "9px 14px",
        borderRadius: "10px",
        background: "#173d43",
        color: "white",
        font: "600 14px system-ui, sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,.22)",
      });
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 9000);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", announce, { once: true });
    else announce();
  }
})();
