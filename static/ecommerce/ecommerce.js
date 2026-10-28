'use strict';

const API = '/api/shop';
const CART_KEY = 'nexora-cart-v1';

const state = {
  query: '',
  category: '',
  sort: 'featured',
  products: [],
  visibleProducts: [],
  categories: [],
  cart: readCart(),
  wishlist: []
};

const $ = id => document.getElementById(id);

const ui = {
  headerSearch: $('header-search'),
  search: $('catalog-search'),
  category: $('category-filter'),
  sort: $('sort-filter'),
  grid: $('product-grid'),
  status: $('catalog-status'),
  count: $('catalog-count'),
  error: $('catalog-error'),
  errorMessage: $('catalog-error-message'),
  retry: $('retry-load'),
  cartCount: $('cart-count'),
  drawer: $('cart-drawer'),
  overlay: $('cart-overlay'),
  cartItems: $('cart-items'),
  cartEmpty: $('cart-empty'),
  cartSummary: $('cart-summary'),
  subtotal: $('cart-subtotal'),
  cartTitleCount: $('cart-title-count'),
  dialog: $('product-dialog'),
  dialogContent: $('dialog-content'),
  toast: $('toast'),
  wishlistDialog: $('wishlist-dialog'),
  wishlistItems: $('wishlist-items'),
  wishlistEmpty: $('wishlist-empty'),
  wishlistCount: $('wishlist-count'),
  openWishlistBtn: $('open-wishlist'),
  closeWishlistBtn: $('close-wishlist')
};

const money = value =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

const heartSVG = (filled) => `
  <svg viewBox="0 0 24 24" width="20" height="20" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
`;

async function getJSON(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { Accept: 'application/json', ...options.headers }
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar à API Flask.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('A API retornou uma resposta que não é JSON válido.');
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `Erro HTTP ${response.status}.`);
  }
  return data;
}

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(item =>
      item && Number.isSafeInteger(item.id) && item.id > 0 &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0
    );
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    return true;
  } catch {
    toast('Não foi possível salvar o carrinho neste navegador.');
    return false;
  }
}

let toastTimer;
function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 2400);
}

function makeImage(src, alt, className) {
  const img = document.createElement('img');
  img.alt = alt;
  img.className = className;
  img.loading = 'lazy';
  img.onerror = () => { img.removeAttribute('src'); img.alt = `Imagem indisponível: ${alt}`; };
  img.src = src;
  return img;
}

function productById(id) {
  return state.products.find(product => product.id === id);
}

async function toggleWishlist(id) {
  const isInWishlist = state.wishlist.includes(id);
  const method = isInWishlist ? 'DELETE' : 'POST';
  const url = isInWishlist ? `${API}/wishlist/${id}` : `${API}/wishlist`;

  try {
    const data = await getJSON(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ id }) : null
    });
    state.wishlist = data.items || [];
    document.querySelectorAll(`[data-wishlist-id="${id}"]`).forEach(btn => {
      btn.innerHTML = heartSVG(state.wishlist.includes(id));
      btn.classList.toggle('active', state.wishlist.includes(id));
    });
    renderWishlist();
    toast(isInWishlist ? 'Removido da lista de desejos.' : 'Adicionado à lista de desejos!');
  } catch (error) {
    toast(`Erro na lista de desejos: ${error.message}`);
  }
}

function renderWishlist() {
  ui.wishlistItems.replaceChildren();
  const items = state.wishlist.map(id => productById(id)).filter(Boolean);
  ui.wishlistEmpty.hidden = items.length > 0;
  ui.wishlistCount.textContent = items.length;
  for (const product of items) {
    const row = document.createElement('article');
    row.className = 'wishlist-row';
    row.append(makeImage(product.image, product.name, 'wishlist-image'));
    const info = document.createElement('div');
    info.className = 'wishlist-info';
    const name = document.createElement('h3');
    name.textContent = product.name;
    const price = document.createElement('span');
    price.className = 'wishlist-price';
    price.textContent = money(product.price);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'wishlist-remove';
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => toggleWishlist(product.id));
    info.append(name, price, removeBtn);
    row.append(info);
    ui.wishlistItems.append(row);
  }
}

async function init() {
  ui.status.textContent = 'Conectando à API Flask…';
  ui.error.hidden = true;
  try {
    const [catalog, categories, wishlistData] = await Promise.all([
      getJSON(`${API}/products?sort=featured`),
      getJSON(`${API}/categories`),
      getJSON(`${API}/wishlist`)
    ]);
    if (!Array.isArray(catalog.items) || !Array.isArray(categories.items)) {
      throw new Error('Estrutura de dados inválida recebida da API.');
    }
    state.products = catalog.items;
    state.categories = categories.items;
    state.wishlist = wishlistData.items || [];
    ui.category.replaceChildren(new Option('Todas as categorias', ''));
    state.categories.forEach(category => ui.category.add(new Option(category, category)));
    ui.category.value = state.category;
    reconcileCart();
    renderWishlist();
    await refresh();
  } catch (error) {
    ui.status.textContent = '';
    ui.error.hidden = false;
    ui.errorMessage.textContent = `${error.message} Verifique se o Flask está em execução.`;
    ui.count.textContent = 'Catálogo indisponível';
  }
}

function reconcileCart() {
  state.cart = state.cart.map(item => {
    const product = productById(item.id);
    if (!product || product.stock <= 0) return null;
    return { id: item.id, quantity: Math.min(item.quantity, product.stock) };
  }).filter(Boolean);
  saveCart();
  renderCart();
}

let refreshSequence = 0;
async function refresh() {
  const sequence = ++refreshSequence;
  ui.error.hidden = true;
  ui.status.textContent = 'Atualizando catálogo…';
  const params = new URLSearchParams({ sort: state.sort });
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.category) params.set('category', state.category);
  try {
    const data = await getJSON(`${API}/products?${params.toString()}`);
    if (sequence !== refreshSequence) return;
    if (!Array.isArray(data.items) || !Number.isFinite(data.total)) {
      throw new Error('Resposta de catálogo inválida.');
    }
    state.visibleProducts = data.items;
    renderProducts(state.visibleProducts);
    ui.count.textContent = `${data.total} ${data.total === 1 ? 'produto' : 'produtos'}`;
    ui.status.textContent = data.total ? '' : 'Nenhum produto corresponde aos filtros.';
    renderCart();
  } catch (error) {
    if (sequence !== refreshSequence) return;
    ui.status.textContent = '';
    ui.error.hidden = false;
    ui.errorMessage.textContent = error.message;
  }
}

function clearFilters() {
  state.query = '';
  state.category = '';
  state.sort = 'featured';
  ui.search.value = '';
  ui.headerSearch.value = '';
  ui.category.value = '';
  ui.sort.value = 'featured';
  refresh();
}

function renderProducts(products) {
  ui.grid.replaceChildren();
  if (!products.length) {
    const box = document.createElement('div');
    box.className = 'empty-results';
    const heading = document.createElement('h3');
    heading.textContent = 'Nenhum resultado por aqui.';
    const description = document.createElement('p');
    description.textContent = 'Experimente outro termo ou remova algum filtro.';
    const button = document.createElement('button');
    button.className = 'button button-dark';
    button.type = 'button';
    button.textContent = 'Limpar filtros';
    button.addEventListener('click', clearFilters);
    box.append(heading, description, button);
    ui.grid.append(box);
    return;
  }
  for (const product of products) {
    const card = document.createElement('article');
    card.className = 'product-card';
    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-image-wrap';
    imageWrap.append(makeImage(product.image, product.name, 'product-image'));
    const tag = document.createElement('span');
    tag.className = `product-tag${product.stock <= 0 ? ' sold' : ''}`;
    tag.textContent = product.stock <= 0 ? 'Indisponível' : product.stock <= 5 ? 'Últimas unidades' : 'Curadoria NXR';
    imageWrap.append(tag);
    const wishBtn = document.createElement('button');
    wishBtn.className = 'wishlist-btn';
    wishBtn.type = 'button';
    wishBtn.dataset.wishlistId = product.id;
    wishBtn.innerHTML = heartSVG(state.wishlist.includes(product.id));
    wishBtn.classList.toggle('active', state.wishlist.includes(product.id));
    wishBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleWishlist(product.id); });
    imageWrap.append(wishBtn);
    const add = document.createElement('button');
    add.className = 'quick-add';
    add.type = 'button';
    add.textContent = product.stock > 0 ? '+ Adicionar ao carrinho' : 'Sem estoque';
    add.disabled = product.stock <= 0;
    add.addEventListener('click', () => addToCart(product.id));
    imageWrap.append(add);
    const meta = document.createElement('div');
    meta.className = 'product-meta';
    const category = document.createElement('span');
    category.className = 'product-category';
    category.textContent = product.category;
    const stock = document.createElement('span');
    stock.textContent = product.stock > 0 ? `${product.stock} disponíveis` : 'Esgotado';
    meta.append(category, stock);
    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = product.name;
    const bottom = document.createElement('div');
    bottom.className = 'product-bottom';
    const price = document.createElement('span');
    price.className = 'product-price';
    price.textContent = money(product.price);
    const details = document.createElement('button');
    details.className = 'details-link';
    details.type = 'button';
    details.textContent = 'Ver detalhes ↗';
    details.addEventListener('click', () => detailsFor(product.id));
    bottom.append(price, details);
    card.append(imageWrap, meta, name, bottom);
    ui.grid.append(card);
  }
}

async function detailsFor(id) {
  try {
    const product = await getJSON(`${API}/products/${id}`);
    ui.dialogContent.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'dialog-product';
    wrap.append(makeImage(product.image, product.name, 'dialog-image'));
    const copy = document.createElement('div');
    copy.className = 'dialog-copy';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `${product.category} / NXR-${product.id}`;
    const heading = document.createElement('h2');
    heading.textContent = product.name;
    const description = document.createElement('p');
    description.textContent = product.description;
    const stock = document.createElement('p');
    stock.textContent = product.stock > 0 ? `${product.stock} unidades disponíveis` : 'Produto indisponível no momento.';
    const price = document.createElement('strong');
    price.className = 'dialog-price';
    price.textContent = money(product.price);
    const wishBtn = document.createElement('button');
    wishBtn.className = 'wishlist-btn-modal';
    wishBtn.type = 'button';
    wishBtn.dataset.wishlistId = product.id;
    wishBtn.innerHTML = heartSVG(state.wishlist.includes(product.id));
    wishBtn.classList.toggle('active', state.wishlist.includes(product.id));
    wishBtn.addEventListener('click', () => toggleWishlist(product.id));
    const add = document.createElement('button');
    add.className = 'button button-dark';
    add.type = 'button';
    add.disabled = product.stock <= 0;
    add.textContent = product.stock > 0 ? 'Adicionar ao carrinho +' : 'Sem estoque';
    add.addEventListener('click', () => { addToCart(product.id); ui.dialog.close(); });
    copy.append(eyebrow, heading, description, stock, price, wishBtn, add);
    wrap.append(copy);
    ui.dialogContent.append(wrap);
    if (!ui.dialog.open) ui.dialog.showModal();
  } catch (error) {
    toast(`Não foi possível carregar os detalhes: ${error.message}`);
  }
}

function addToCart(id) {
  const product = productById(id);
  if (!product || product.stock <= 0) { toast('Produto indisponível.'); return; }
  const item = state.cart.find(entry => entry.id === id);
  if (item) {
    if (item.quantity >= product.stock) { toast('Limite de estoque atingido.'); return; }
    item.quantity++;
  } else {
    state.cart.push({ id, quantity: 1 });
  }
  saveCart();
  renderCart();
  toast(`${product.name} adicionado ao carrinho.`);
}

function changeQty(id, delta) {
  const item = state.cart.find(entry => entry.id === id);
  const product = productById(id);
  if (!item || !product) return;
  const next = item.quantity + delta;
  if (next < 1) { removeItem(id); return; }
  if (next > product.stock) { toast('Quantidade máxima disponível atingida.'); return; }
  item.quantity = next;
  saveCart();
  renderCart();
}

function removeItem(id) {
  state.cart = state.cart.filter(item => item.id !== id);
  saveCart();
  renderCart();
  toast('Item removido do carrinho.');
}

function renderCart() {
  const items = state.cart.map(item => ({ ...item, product: productById(item.id) })).filter(item => item.product);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  $('cart-count').textContent = count;
  ui.cartTitleCount.textContent = `(${count})`;
  ui.subtotal.textContent = money(total);
  ui.cartItems.replaceChildren();
  ui.cartEmpty.hidden = items.length > 0;
  ui.cartSummary.hidden = items.length === 0;
  for (const item of items) {
    const product = item.product;
    const row = document.createElement('article');
    row.className = 'cart-row';
    row.append(makeImage(product.image, product.name, 'cart-image'));
    const info = document.createElement('div');
    const category = document.createElement('div');
    category.className = 'cart-category';
    category.textContent = product.category;
    const title = document.createElement('h3');
    title.textContent = product.name;
    const price = document.createElement('div');
    price.className = 'cart-price';
    price.textContent = money(product.price * item.quantity);
    const qty = document.createElement('div');
    qty.className = 'quantity-control';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', `Diminuir ${product.name}`);
    minus.addEventListener('click', () => changeQty(item.id, -1));
    const amount = document.createElement('span');
    amount.textContent = item.quantity;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.disabled = item.quantity >= product.stock;
    plus.setAttribute('aria-label', `Aumentar ${product.name}`);
    plus.addEventListener('click', () => changeQty(item.id, 1));
    qty.append(minus, amount, plus);
    info.append(category, title, price, qty);
    const remove = document.createElement('button');
    remove.className = 'remove-item';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remover ${product.name}`);
    remove.addEventListener('click', () => removeItem(item.id));
    row.append(info, remove);
    ui.cartItems.append(row);
  }
}

function openCart() {
  ui.overlay.hidden = false;
  ui.drawer.classList.add('open');
  ui.drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  $('close-cart').focus();
}

function closeCart() {
  ui.drawer.classList.remove('open');
  ui.drawer.setAttribute('aria-hidden', 'true');
  ui.overlay.hidden = true;
  document.body.classList.remove('drawer-open');
  $('open-cart').focus();
}

let searchTimer;
function syncSearch(value) {
  state.query = value;
  if (ui.search.value !== value) ui.search.value = value;
  if (ui.headerSearch.value !== value) ui.headerSearch.value = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 180);
}

ui.search.addEventListener('input', event => syncSearch(event.target.value));
ui.headerSearch.addEventListener('input', event => syncSearch(event.target.value));
ui.category.addEventListener('change', event => { state.category = event.target.value; refresh(); });
ui.sort.addEventListener('change', event => { state.sort = event.target.value; refresh(); });
ui.retry.addEventListener('click', init);
$('open-cart').addEventListener('click', openCart);
$('close-cart').addEventListener('click', closeCart);
ui.overlay.addEventListener('click', closeCart);
$('continue-shopping').addEventListener('click', () => { closeCart(); $('catalogo').scrollIntoView({ behavior: 'smooth' }); });
$('close-dialog').addEventListener('click', () => ui.dialog.close());
ui.dialog.addEventListener('click', event => { if (event.target === ui.dialog) ui.dialog.close(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && ui.drawer.classList.contains('open')) closeCart();
});
ui.openWishlistBtn.addEventListener('click', () => { renderWishlist(); ui.wishlistDialog.showModal(); });
ui.closeWishlistBtn.addEventListener('click', () => ui.wishlistDialog.close());
ui.wishlistDialog.addEventListener('click', (e) => { if (e.target === ui.wishlistDialog) ui.wishlistDialog.close(); });

renderCart();
init();