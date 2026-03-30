const API = "https://api.escuelajs.co/api/v1";
const PLACEHOLDER = "https://placehold.co/200x200/eee/999?text=?";

// ── HARDLOCK CATEGORY ─────────────────────────────────────────────
const ACTIVE_CATEGORY_NAME = "clothes";

// ── State ─────────────────────────────────────────────────────────
let all = [], filtered = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let minPrice = null, maxPrice = null;

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  const res = await fetch(`${API}/products?limit=200&offset=0`).catch(() => null);

  if (!res?.ok) {
    document.getElementById("grid").innerHTML =
      '<div class="status">Failed to load.</div>';
    return;
  }

  all = await res.json();

  applyFilters();
  updateCount();
}

// ── Filters ────────────────────────────────────────────────────────
function onSearch() {
  applyFilters();
}

function onPriceChange() {
  minPrice = parseFloat(document.getElementById("min-price").value) || null;
  maxPrice = parseFloat(document.getElementById("max-price").value) || null;
  applyFilters();
}

function applyFilters() {
  const q = document.getElementById("search").value.toLowerCase();

  filtered = all.filter(p =>
    // ✅ CLOTHES ONLY FILTER (FIXED PROPERLY)
    p.category?.name?.toLowerCase() === ACTIVE_CATEGORY_NAME &&
    (!q || p.title.toLowerCase().includes(q)) &&
    (minPrice == null || p.price >= minPrice) &&
    (maxPrice == null || p.price <= maxPrice)
  );

  document.getElementById("result-count").textContent =
    `${filtered.length} results`;

  renderGrid();
}

// ── IMAGE HANDLER ─────────────────────────────────────────────────
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
        try { img = JSON.parse(img)[0]; }
        catch { img = img.replace(/^\["|"\]$/g, ""); }
      }

      if (img?.startsWith("http")) return img;
    }
  }

  const fallback = p.image ?? p.category?.image;
  if (typeof fallback === "string" && fallback.startsWith("http")) {
    return fallback.trim();
  }

  return PLACEHOLDER;
}

// ── GRID ───────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById("grid");

  if (!filtered.length) {
    grid.innerHTML = '<div class="status">No products found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const inCart = cart.some(c => c.id === p.id);

    return `
      <div class="card">
        <img src="${getImg(p)}"
             onerror="this.src='${PLACEHOLDER}'"
             alt="${p.title || "Product"}">

        <div class="card-cat">${p.category?.name || ""}</div>
        <div class="card-name">${p.title}</div>
        <div class="card-price">$${p.price.toFixed(2)}</div>

        <button onclick="addToCart(${p.id})"
                id="btn-${p.id}"
                ${inCart ? 'class="in-cart"' : ""}>
          ${inCart ? "IN CART" : "ADD TO CART"}
        </button>
      </div>
    `;
  }).join("");
}

// ── CART ───────────────────────────────────────────────────────────
function addToCart(id) {
  const p = all.find(x => x.id === id);
  if (!p) return;

  const existing = cart.find(c => c.id === id);

  if (existing) existing.qty++;
  else {
    cart.push({
      id,
      name: p.title,
      price: p.price,
      img: getImg(p),
      qty: 1
    });
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

  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }

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
  document.getElementById("cart-count").textContent =
    cart.reduce((s, c) => s + c.qty, 0);
}

// ── CART DRAWER ───────────────────────────────────────────────────
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
      <img src="${item.img}"
           onerror="this.src='${PLACEHOLDER}'"
           alt="${item.name}">

      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-price">$${(item.price * item.qty).toFixed(2)}</div>

        <div class="ci-qty">
          <button onclick="changeQty(${item.id},-1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${item.id},1)">+</button>
        </div>
      </div>

      <button onclick="removeFromCart(${item.id})">✕</button>
    </div>
  `).join("");
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

// ── CHECKOUT ───────────────────────────────────────────────────────
function checkout() {
  if (!cart.length) return toast("Cart is empty");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (!user.email) return toast("Please login first");

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

// ── TOAST ──────────────────────────────────────────────────────────
let toastTimer;

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    t.classList.remove("show");
  }, 2000);
}

// ── START ──────────────────────────────────────────────────────────
init();
