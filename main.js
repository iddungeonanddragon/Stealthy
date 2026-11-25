import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.0.0/+esm";

const KEY = "custom.stealth-tracker/entries";

let role = "PLAYER";
let playerId = "";
let players = [];
let entries = [];
let connectedToOBR = false;

const roleTag = document.getElementById("role-tag");
const nameInput = document.getElementById("name-input");
const rollInput = document.getElementById("roll-input");
const addBtn = document.getElementById("add-btn");
const listEl = document.getElementById("list");

const esc = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function applyMetadata(meta) {
  const saved = meta?.[KEY];
  entries = Array.isArray(saved) ? saved : [];
  render();
}

OBR.onReady(async () => {
  try {
    connectedToOBR = true;
    role = await OBR.player.getRole();
    playerId = await OBR.player.getId();
    roleTag.textContent = role;

    players = await OBR.party.getPlayers();
    OBR.party.onChange((list) => {
      players = Array.isArray(list) ? list : [];
      render();
    });

    const meta = await OBR.scene.getMetadata();
    applyMetadata(meta);

    OBR.scene.onMetadataChange((updatedMeta) => {
      applyMetadata(updatedMeta);
    });
  } catch (err) {
    console.error(err);
    roleTag.textContent = "Offline";
    render();
  }
});

async function persist(nextEntries) {
  entries = nextEntries;
  render();
  if (connectedToOBR) {
    await OBR.scene.setMetadata({ [KEY]: entries });
  }
}

addBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const roll = Number.parseInt(rollInput.value, 10);
  if (!name || Number.isNaN(roll)) return;

  const entry = {
    id: crypto.randomUUID(),
    name,
    roll,
    spotted: false,
    allowedPlayers: []
  };

  await persist([...entries, entry]);
  nameInput.value = "";
  rollInput.value = "";
  nameInput.focus();
});

window.toggleAllow = async (id, targetId) => {
  if (role !== "GM") return;
  const next = entries.map((e) => {
    if (e.id !== id) return e;
    const list = Array.isArray(e.allowedPlayers) ? e.allowedPlayers : [];
    const allowedPlayers = list.includes(targetId)
      ? list.filter((x) => x !== targetId)
      : [...list, targetId];
    return { ...e, allowedPlayers };
  });
  await persist(next);
};

window.toggleSpotted = async (id) => {
  if (role !== "GM") return;
  const next = entries.map((e) =>
    e.id === id ? { ...e, spotted: !e.spotted } : e
  );
  await persist(next);
};

window.removeEntry = async (id) => {
  if (role !== "GM") return;
  await persist(entries.filter((e) => e.id !== id));
};

function render() {
  const visible =
    role === "GM"
      ? entries
      : entries.filter(
          (e) => Array.isArray(e.allowedPlayers) && e.allowedPlayers.includes(playerId)
        );

  if (visible.length === 0) {
    listEl.innerHTML = `<div class="empty">Belum ada stealth yang tampil.</div>`;
    return;
  }

  listEl.innerHTML = visible
    .map((e) => {
      const allowed = Array.isArray(e.allowedPlayers) ? e.allowedPlayers : [];
      const gmControls =
        role === "GM"
          ? `
            <button class="ghost" type="button" onclick="toggleSpotted('${e.id}')">
              ${e.spotted ? "Spotted" : "Hidden"}
            </button>
            <button class="danger" type="button" onclick="removeEntry('${e.id}')">✕</button>
          `
          : `<span class="tag">${e.spotted ? "Spotted" : "Hidden"}</span>`;

      const playerChips =
        role === "GM"
          ? `
            <div class="access">
              <span class="access-label">Boleh dilihat player:</span>
              ${
                players.length === 0
                  ? `<span class="tag">Tidak ada player lain</span>`
                  : players
                      .map((p) => {
                        const checked = allowed.includes(p.id) ? "checked" : "";
                        const pName = esc(p.name || p.id.slice(0, 6));
                        return `
                          <label class="chip">
                            <input type="checkbox" ${checked} onchange="toggleAllow('${e.id}', '${p.id}')" />
                            ${pName}
                          </label>
                        `;
                      })
                      .join("")
              }
            </div>
          `
          : "";

      return `
        <div class="item ${e.spotted ? "spotted" : ""}">
          <div class="item-head">
            <span><strong>${esc(e.name)}</strong></span>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="roll">${e.roll}</span>
              ${gmControls}
            </div>
          </div>
          ${playerChips}
        </div>
      `;
    })
    .join("");
}

render();
