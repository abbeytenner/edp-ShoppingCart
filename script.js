
const API = "https://api.escuelajs.co/api/v1";
const PLACEHOLDER = "https://placehold.co/200x200/eee/999?text=?";

// ── State ──────────────────────────────────────────────────────────────────
let all = [], filtered = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let activeCat = null, minPrice = null, maxPrice = null;

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  fetchCategories();

  const res = await fetch(`${API}/products?limit=200&offset=0`).catch(() => null);
  if (!res?.ok) {
    document.getElementById("grid").innerHTML = '<div class="status">Failed to load.</div>';
    return;
  }

  all = await res.json();
  applyFilters();
  updateCount();
}

// ── Categories ─────────────────────────────────────────────────────────────
async function fetchCategories() {
  const res = await fetch(`${API}/categories`).catch(() => null);
  if (!res?.ok) return;

  const cats = await res.json();
  const list = document.getElementById("cat-list");

  const allBtn = makeBtn("All", true, () => setCat(null, allBtn));
  list.appendChild(allBtn);

  cats.forEach(c => {
    const btn = makeBtn(c.name, false, () => setCat(c.id, btn));
    list.appendChild(btn);
  });
}

function makeBtn(label, active, onClick) {
  const btn = document.createElement("button");
  btn.className = "cat-btn" + (active ? " active" : "");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function setCat(id, el) {
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  activeCat = id;
  applyFilters();
}

// ── Filters ────────────────────────────────────────────────────────────────
function onSearch() { applyFilters(); }

function onPriceChange() {
  minPrice = parseFloat(document.getElementById("min-price").value) || null;
  maxPrice = parseFloat(document.getElementById("max-price").value) || null;
  applyFilters();
}

function applyFilters() {
  const q = document.getElementById("search").value.toLowerCase();

  filtered = all.filter(p =>
    (!activeCat || p.category?.id === activeCat) &&
    (!q || p.title.toLowerCase().includes(q)) &&
    (minPrice == null || p.price >= minPrice) &&
    (maxPrice == null || p.price <= maxPrice)
  );

  document.getElementById("result-count").textContent = `${filtered.length} results`;
  renderGrid();
}

// ── Image helper ───────────────────────────────────────────────────────────
function getImg(p) {
  if (!p) return PLACEHOLDER;

  let images = p.images;
  if (typeof images === "string") {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }

  if (Array.isArray(images)) {
    for (let img of images) {
      if (typeof img !== "string") continue;
      img = img.trim();
      if (img.startsWith("[")) {
        try { img = JSON.parse(img)[0]; } catch { img = img.replace(/^\["|"\]$/g, ""); }
      }
      if (img?.startsWith("http")) return img;
    }
  }

  const fallback = p.image ?? p.category?.image;
  if (typeof fallback === "string" && fallback.trim().startsWith("http")) return fallback.trim();

  return PLACEHOLDER;
}

// ── Grid rendering ─────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById("grid");

  if (!filtered.length) {
    grid.innerHTML = '<div class="status">No products found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const inCart = cart.some(c => c.id === p.id);
    return `<div class="card">
      <img src="${getImg(p)}" onerror="this.src='${PLACEHOLDER}'" alt="${p.title || "Product"}">
      <div class="card-cat">${p.category?.name || ""}</div>
      <div class="card-name">${p.title}</div>
      <div class="card-price">$${p.price.toFixed(2)}</div>
      <button onclick="addToCart(${p.id})" id="btn-${p.id}" ${inCart ? 'class="in-cart"' : ""}>
        ${inCart ? "IN CART" : "ADD TO CART"}
      </button>
    </div>`;
  }).join("");
}

// ── Cart logic ─────────────────────────────────────────────────────────────
function addToCart(id) {
  const p = all.find(x => x.id === id);
  if (!p) return;

  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name: p.title, price: p.price, img: getImg(p), qty: 1 });
  }

  persist();
  setCartBtn(id, true);
  toast("Added to cart");
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  persist();
  renderCart();
  setCartBtn(id, false);
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }

  persist();
  renderCart();
}

function setCartBtn(id, inCart) {
  const btn = document.getElementById(`btn-${id}`);
  if (!btn) return;
  btn.textContent = inCart ? "IN CART" : "ADD TO CART";
  btn.classList.toggle("in-cart", inCart);
}

function persist() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCount();
}

function updateCount() {
  document.getElementById("cart-count").textContent = cart.reduce((s, c) => s + c.qty, 0);
}

// ── Cart drawer ────────────────────────────────────────────────────────────
function renderCart() {
  const el = document.getElementById("drawer-items");
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  document.getElementById("cart-total").textContent = `$${total.toFixed(2)}`;
  updateCount();

  if (!cart.length) {
    el.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    return;
  }

  el.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.img}" onerror="this.src='${PLACEHOLDER}'" alt="${item.name}">
      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-price">$${(item.price * item.qty).toFixed(2)}</div>
        <div class="ci-qty">
          <button class="qty-btn" onclick="changeQty(${item.id},-1)">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
        </div>
      </div>
      <button class="rm-btn" onclick="removeFromCart(${item.id})">✕</button>
    </div>`).join("");
}

function openCart() {
  renderCart();
  document.getElementById("overlay").classList.add("open");
  document.getElementById("drawer").classList.add("open");
}

function closeCart() {
  document.getElementById("overlay").classList.remove("open");
  document.getElementById("drawer").classList.remove("open");
}

// ── Checkout ───────────────────────────────────────────────────────────────
function checkout() {
  if (!cart.length) { toast("Cart is empty"); return; }

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (!user.email) { toast("Please login first"); return; }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  toast("Processing order...");

  setTimeout(() => {
    if (Math.random() > 0.1) {
      const orders = JSON.parse(localStorage.getItem("orders") || "[]");
      orders.push({ user, items: cart, total });
      localStorage.setItem("orders", JSON.stringify(orders));

      cart = [];
      persist();
      renderGrid();
      closeCart();
      toast("Order placed successfully!");
    } else {
      toast("Order failed. Please try again.");
    }
  }, 2000);
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
}

init();