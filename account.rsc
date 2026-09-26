:HL["/list-geroya-5e/assets/index-BeW28_i_.css","style"]
2:T102b,
(() => {
  const VAULT_KEY = "list-geroya-character-vault-v1";
  const VAULT_BACKUP_KEY = "list-geroya-character-vault-v1-safe-backup";
  const LEGACY_KEY = "dark-codex-character";
  const LEGACY_BACKUP_KEY = "dark-codex-character-safe-backup";
  const RELOAD_GUARD_KEY = "herolist-storage-guard-reload-v1";

  const parseObject = raw => {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  };

  const parseVault = raw => {
    const value = parseObject(raw);
    return value && Array.isArray(value.slots) ? value : null;
  };

  const slotIds = raw => {
    const value = parseVault(raw);
    if (!value) return null;
    return value.slots
      .map(slot => slot && typeof slot.id === "string" ? slot.id : "")
      .filter(Boolean);
  };

  const hasCharacters = raw => {
    const ids = slotIds(raw);
    return Array.isArray(ids) && ids.length > 0;
  };

  const preservesSnapshot = (candidateRaw, snapshotRaw) => {
    const candidateIds = slotIds(candidateRaw);
    const snapshotIds = slotIds(snapshotRaw);
    if (!candidateIds || !snapshotIds || snapshotIds.length === 0) return false;
    const current = new Set(candidateIds);
    return snapshotIds.every(id => current.has(id));
  };

  const looksLikeCharacter = raw => {
    const value = parseObject(raw);
    if (!value) return false;
    return typeof value.name === "string"
      || typeof value.race === "string"
      || typeof value.className === "string"
      || typeof value.schemaVersion === "number"
      || (value.abilities && typeof value.abilities === "object");
  };

  try {
    let currentVault = localStorage.getItem(VAULT_KEY);
    const safeBackup = localStorage.getItem(VAULT_BACKUP_KEY);

    // Capture the exact pre-upgrade Vault before React or migrations can touch it.
    if (hasCharacters(currentVault)) {
      localStorage.setItem(VAULT_BACKUP_KEY, currentVault);
    } else if (!parseVault(currentVault) && hasCharacters(safeBackup)) {
      // Missing/corrupted primary storage may be restored immediately. A valid
      // deliberately empty Vault remains authoritative and is not resurrected.
      localStorage.setItem(VAULT_KEY, safeBackup);
      currentVault = safeBackup;
    }

    const legacyCharacter = localStorage.getItem(LEGACY_KEY);
    const legacyBackup = localStorage.getItem(LEGACY_BACKUP_KEY);
    if (looksLikeCharacter(legacyCharacter)) {
      localStorage.setItem(LEGACY_BACKUP_KEY, legacyCharacter);
    } else if (!legacyCharacter && looksLikeCharacter(legacyBackup)) {
      localStorage.setItem(LEGACY_KEY, legacyBackup);
    }

    const bootSnapshot = hasCharacters(currentVault) ? currentVault : null;
    if (!bootSnapshot) return;

    // The normal application may update character contents on boot, but it
    // must never replace/remove the slots that existed before the upgrade.
    const verifyAfterBoot = () => {
      const afterBoot = localStorage.getItem(VAULT_KEY);
      if (preservesSnapshot(afterBoot, bootSnapshot)) {
        localStorage.setItem(VAULT_BACKUP_KEY, afterBoot);
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
        return;
      }

      localStorage.setItem(VAULT_KEY, bootSnapshot);
      localStorage.setItem(VAULT_BACKUP_KEY, bootSnapshot);

      // One automatic retry lets the app start again from the restored data,
      // while the session flag prevents an endless reload loop if old data is
      // genuinely incompatible with a future schema.
      if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== "1") {
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
        window.location.reload();
      }
    };

    const armVerification = () => window.setTimeout(verifyAfterBoot, 1200);
    if (document.readyState === "complete") armVerification();
    else window.addEventListener("load", armVerification, { once: true });
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. Never
    // block the application merely because the safety layer cannot run.
  }
})();
0:{"__route":"route:/account/","__interceptionContext":null,"__layoutIds":["layout:/"],"__rootLayout":"/","page:/account/":"$L1","layout:/":[[[["$","link","css:/list-geroya-5e/assets/index-BeW28_i_.css",{"rel":"stylesheet","precedence":"vite-rsc/importer-resources","href":"/list-geroya-5e/assets/index-BeW28_i_.css","data-rsc-css-href":"/list-geroya-5e/assets/index-BeW28_i_.css"}],"$undefined"],["$","html",null,{"lang":"ru","children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]}],"$L3"]}]],"$L4"],"route:/account/":"$L5","__layoutFlags":{"layout:/":"s"},"__artifactCompatibility":{"schemaVersion":1,"graphVersion":"app-route-graph:qe30xgp2gxqw","deploymentVersion":"db0853a5-9668-4d23-b586-877442c997d7","appElementsSchemaVersion":1,"rscPayloadSchemaVersion":1,"rootBoundaryId":"/","renderEpoch":null}}
6:I["8c0f216c4604",[],"Children",1]
7:I["15c18cfaeeff",[],"LayoutSegmentProvider",1]
8:I["8c0f216c4604",[],"Slot",1]
9:I["593f344dc510",[],"RedirectBoundary",1]
3:["$","body",null,{"className":"__variable_geist_0tvmz3h __variable_geist_mono_1diim1n antialiased","children":["$","$L6",null,{}]}]
4:null
5:[[["$","meta",null,{"charSet":"utf-8"}],[["$","title","0",{"children":"Лист Героя 5e — создание персонажа D&D 2014"}],["$","meta","1",{"name":"description","content":"Пошаговый конструктор персонажа D&D 5e в редакции 2014 года."}],["$","link","2",{"rel":"shortcut icon","href":"/favicon.ico"}],["$","link","3",{"rel":"icon","href":"/favicon.ico"}],["$","meta","4",{"name":"codex-preview","content":"development"}]],[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]],["$","$L7",null,{"segmentMap":{"children":["account"]},"children":["$","$L8",null,{"id":"layout:/","parallelSlots":"$undefined","children":["$","$L9",null,{"children":["$","$L7",null,{"segmentMap":{"children":[]},"children":["$","$L8",null,{"id":"page:/account/"}]}]}]}]}]]
a:I["724dcbd470a5",[],"default",1]
1:["$","$La",null,{"params":"$@b","searchParams":"$@c"}]
b:{}
c:{}
