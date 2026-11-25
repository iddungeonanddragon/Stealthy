import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3.0.0";

const METADATA_KEY = "custom.stealth-tracker/state";

let currentRole = "PLAYER";
let currentPlayerId = "";
let partyPlayers = [];
let trackerEntries = [];

const roleBadge = document.getElementById("role-badge");
const controlsEl = document.getElementById("controls");
const listEl = document.getElementById("tracker-list");
const nameInput = document.getElementById("char-name");
const valInput = document.getElementById("stealth-val");
const addBtn = document.getElementById("add-btn");

OBR.onReady(async () => {
  currentRole = await OBR.player.getRole();
  currentPlayerId = await OBR.player.getId();
  roleBadge.textContent = currentRole;

  controlsEl.style.display = "flex";

  partyPlayers = await OBR.party.getPlayers();
  OBR.party.onChange((players) => {
    partyPlayers = players;
    render();
  });

  const metadata = await OBR.scene.getMetadata();
  if (metadata[METADATA_KEY]) {
    trackerEntries = metadata[METADATA_KEY].entries || [];
  }
  render();

  OBR.scene.onMetadataChange((meta) => {
    trackerEntries = meta[METADATA_KEY]?.entries || [];
    render();
  });
});

async function saveEntries(newEntries) {
  await OBR.scene.setMetadata({
    [METADATA_KEY]: { entries: newEntries }
  });
}

addBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const roll = parseInt(valInput.value, 10);
  if (!name || isNaN(roll)) return;

  const newEntry = {
    id: crypto.randomUUID(),
    name,
    roll,
    hidden: true,
    createdBy: currentPlayerId,
    allowedPlayers: []
  };

  await saveEntries([...trackerEntries, newEntry]);
  nameInput.value = "";
  valInput.value = "";
});

window.togglePlayerAccess = async (entryId, targetPlayerId) => {
  if (currentRole !== "GM") return;

  const updated = trackerEntries.map((entry) => {
    if (entry.id !== entryId) return entry;
    const currentAllowed = entry.allowedPlayers || [];
    const exists = currentAllowed.includes(targetPlayerId);
    const allowedPlayers = exists
      ? currentAllowed.filter((id) => id !== targetPlayerId)
      : [...currentAllowed, targetPlayerId];
    return { ...entry, allowedPlayers };
  });

  await saveEntries(updated);
};

window.updateRoll = async (entryId, newVal) => {
  if (currentRole !== "GM") return;
  const roll = parseInt(newVal, 10);
  if (isNaN(roll)) return;

  const updated = trackerEntries.map((e) =>
    e.id === entryId ? { ...e, roll } : e
  );
  await saveEntries(updated);
};

window.toggleHidden = async (entryId) => {
  if (currentRole !== "GM") return;
  const updated = trackerEntries.map((e) =>
    e.id === entryId ? { ...e, hidden: !e.hidden } : e
  );
  await saveEntries(updated);
};

window.deleteEntry = async (entryId) => {
  if (currentRole !== "GM") return;
  const updated = trackerEntries.filter((e) => e.id !== entryId);
  await saveEntries(updated);
};

function render() {
  const visibleEntries =
    currentRole === "GM"
      ? trackerEntries
      : trackerEntries.filter(
          (entry) =>
            Array.isArray(entry.allowedPlayers) &&
            entry.allowedPlayers.includes(currentPlayerId)
        );

  if (visibleEntries.length === 0) {
    listEl.innerHTML = `<div class="empty">Belum ada data Stealth yang diizinkan untukmu.</div>`;
    return;
  }

  listEl.innerHTML = visibleEntries
    .map((entry) => {
      const allowedList = entry.allowedPlayers || [];

      const playerAccessHTML =
        currentRole === "GM"
          ? `<div class="players-list">
              <span style="width:100%;font-size:10px;color:var(--muted);">Izinkan lihat:</span>
              ${
                partyPlayers.length === 0
                  ? `<span style="color:var(--muted);font-size:11px;">Belum ada player di room</span>`
                  : partyPlayers
                      .map((p) => {
                        const checked = allowedList.includes(p.id) ? "checked" : "";
                        return `
                          <label class="player-chip">
                            <input
                              type="checkbox"
                              ${checked}
                              onchange="togglePlayerAccess('${entry.id}', '${p.id}')"
                            />
                            ${p.name}
                          </label>
                        `;
                      })
                      .join("")
              }
            </div>`
          : "";

      const rollDisplay =
        currentRole === "GM"
          ? `<input
              type="number"
              value="${entry.roll}"
              style="width:48px;padding:3px 4px;font-weight:700;color:#a892ff;"
              onchange="updateRoll('${entry.id}', this.value)"
            />`
          : `<span class="roll-val">${entry.roll}</span>`;

      const gmActions =
        currentRole === "GM"
          ? `
            <button
              style="font-size:11px;padding:2px 6px;background:${entry.hidden ? "#38b27b" : "#e05263"}"
              onclick="toggleHidden('${entry.id}')"
            >
              ${entry.hidden ? "Hidden" : "Spotted"}
            </button>
            <button class="btn-del" onclick="deleteEntry('${entry.id}')">✕</button>
          `
          : `<span style="font-size:11px;color:${entry.hidden ? "#38b27b" : "#e05263"}">
              ${entry.hidden ? "● Hidden" : "● Spotted"}
            </span>`;

      return `
        <div class="card ${entry.hidden ? "" : "spotted"}">
          <div class="card-header">
            <span>${entry.name}</span>
            <div style="display:flex;align-items:center;gap:6px;">
              ${rollDisplay}
              ${gmActions}
            </div>
          </div>
          ${playerAccessHTML}
        </div>
      `;
    })
    .join("");
}