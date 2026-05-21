const LOCAL_KEY = "indy500-pitch-in-items";

const state = {
  partyId: getPartyId(),
  items: [],
  status: "loading",
  apiAvailable: false
};

const elements = {
  addForm: document.querySelector("#addForm"),
  nameInput: document.querySelector("#nameInput"),
  itemInput: document.querySelector("#itemInput"),
  list: document.querySelector("#list"),
  statusPill: document.querySelector("#statusPill"),
  statusText: document.querySelector("#statusText"),
  setupNote: document.querySelector("#setupNote"),
  partyCode: document.querySelector("#partyCode"),
  totalCount: document.querySelector("#totalCount"),
  checkedCount: document.querySelector("#checkedCount"),
  takenCount: document.querySelector("#takenCount"),
  copyLink: document.querySelector("#copyLink"),
  copyText: document.querySelector("#copyText")
};

elements.partyCode.textContent = `Party code: ${state.partyId}`;

init();

elements.addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.nameInput.value.trim();
  const item = elements.itemInput.value.trim();
  if (!name || !item) return;

  await addItem({
    name,
    item,
    checked: false,
    taken: false,
    createdAt: Date.now()
  });
  elements.itemInput.value = "";
  elements.itemInput.focus();
});

elements.copyLink.addEventListener("click", async () => {
  await navigator.clipboard.writeText(window.location.href);
  elements.copyText.textContent = "Link copied";
  setTimeout(() => {
    elements.copyText.textContent = "Copy text link";
  }, 1500);
});

function getPartyId() {
  const params = new URLSearchParams(window.location.search);
  const existing = params.get("party");
  if (existing) return existing;

  const generated = crypto.randomUUID().slice(0, 8);
  params.set("party", generated);
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  return generated;
}

async function init() {
  try {
    state.items = await fetchItems();
    state.apiAvailable = true;
    setStatus("live");
    render();
  } catch {
    state.items = readLocal();
    setStatus("local");
    render();
  }
}

async function fetchItems() {
  const response = await fetch(apiUrl("/api/items"));
  if (!response.ok) throw new Error("Could not load items");
  const data = await response.json();
  return data.items || [];
}

async function addItem(payload) {
  if (state.apiAvailable) {
    const response = await fetch(apiUrl("/api/items"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return;
    state.items = await fetchItems();
    render();
    return;
  }

  state.items = [...state.items, { ...payload, id: crypto.randomUUID() }];
  writeLocal();
  render();
}

async function toggleItem(id, key, value) {
  if (state.apiAvailable) {
    const response = await fetch(apiUrl(`/api/items/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value })
    });
    if (!response.ok) return;
    state.items = await fetchItems();
    render();
    return;
  }

  state.items = state.items.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry));
  writeLocal();
  render();
}

async function deleteItem(id) {
  if (state.apiAvailable) {
    const response = await fetch(apiUrl(`/api/items/${encodeURIComponent(id)}`), {
      method: "DELETE"
    });
    if (!response.ok) return;
    state.items = await fetchItems();
    render();
    return;
  }

  state.items = state.items.filter((entry) => entry.id !== id);
  writeLocal();
  render();
}

function readLocal() {
  return JSON.parse(localStorage.getItem(`${LOCAL_KEY}-${state.partyId}`) || "[]");
}

function writeLocal() {
  localStorage.setItem(`${LOCAL_KEY}-${state.partyId}`, JSON.stringify(state.items));
}

function setStatus(status) {
  state.status = status;
  elements.statusPill.className = `live-pill live-pill--${status}`;
  elements.statusText.textContent = status === "live" ? "Python shared list" : "Local preview mode";
  elements.setupNote.hidden = status === "live";
}

function apiUrl(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("party", state.partyId);
  return url.toString();
}

function render() {
  const checked = state.items.filter((entry) => entry.checked).length;
  const taken = state.items.filter((entry) => entry.taken).length;

  elements.totalCount.textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
  elements.checkedCount.textContent = `${checked} checked`;
  elements.takenCount.textContent = `${taken} taken`;

  if (!state.items.length) {
    elements.list.innerHTML = `
      <div class="empty">
        <span class="icon icon--large">⚑</span>
        <p>No one has claimed an item yet.</p>
      </div>
    `;
    return;
  }

  elements.list.innerHTML = "";
  state.items.forEach((entry) => {
    const row = document.createElement("article");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry__main">
        <strong>${escapeHtml(entry.item)}</strong>
        <span>${escapeHtml(entry.name)}</span>
      </div>
      <div class="entry__actions">
        <button class="${entry.checked ? "toggle toggle--active" : "toggle"}" type="button" data-action="checked" aria-pressed="${entry.checked}">
          <span class="icon">✓</span>
          Checked
        </button>
        <button class="${entry.taken ? "toggle toggle--active" : "toggle"}" type="button" data-action="taken" aria-pressed="${entry.taken}">
          <span class="icon">✓</span>
          Taken
        </button>
        <button class="icon-button" type="button" data-action="delete" title="Remove item" aria-label="Remove ${escapeHtml(entry.item)}">
          ×
        </button>
      </div>
    `;

    row.querySelector('[data-action="checked"]').addEventListener("click", () => {
      toggleItem(entry.id, "checked", !entry.checked);
    });
    row.querySelector('[data-action="taken"]').addEventListener("click", () => {
      toggleItem(entry.id, "taken", !entry.taken);
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", () => {
      deleteItem(entry.id);
    });

    elements.list.append(row);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const escapes = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return escapes[character];
  });
}
