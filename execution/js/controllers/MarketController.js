"use strict";

/**
 * MarketController — renders and filters the product marketplace.
 * Product images are stored in localStorage under ewumart_prod_img_<id>.
 * Sold products remain visible (tagged "Sold"). Products are newest-first.
 */
class MarketController {
  /**
   * Render the products grid.
   * @param {Array} [list] - Optional pre-filtered list; defaults to all products
   */
  static render(list) {
    const grid = document.getElementById("products-grid");
    // Products arrive newest-first from the API (ORDER BY id DESC).
    const items = list !== undefined ? list : db.data.products;

    if (!items.length) {
      grid.innerHTML =
        '<div style="color:var(--text3);text-align:center;padding:40px;grid-column:1/-1">No products found.</div>';
      return;
    }

    grid.innerHTML = items.map((p) => MarketController._card(p)).join("");

    // Apply product photos AFTER DOM is set (same pattern as Avatar.apply)
    items.forEach((p) => {
      const img = MarketController.getImage(p.id);
      if (img) {
        const el = document.getElementById(`pc-img-${p.id}`);
        if (el) {
          el.style.backgroundImage = `url('${img}')`;
          el.style.backgroundSize = "cover";
          el.style.backgroundPosition = "center";
          const em = el.querySelector(".pc-em");
          if (em) em.style.display = "none"; // hide emoji when photo present
        }
      }
    });
  }

  /** Get stored product image from localStorage */
  static getImage(pid) {
    return localStorage.getItem(`ewumart_prod_img_${pid}`) || null;
  }

  /** Store product image */
  static saveImage(pid, dataUrl) {
    localStorage.setItem(`ewumart_prod_img_${pid}`, dataUrl);
  }

  /** Remove stored product image */
  static removeImage(pid) {
    localStorage.removeItem(`ewumart_prod_img_${pid}`);
  }

  /** Build a product card HTML string */
  static _card(p) {
    const seller = db.user(p.sid);
    const own = p.sid === AuthController.user.id;
    const isSold = p.status === "Sold";
    return `
      <div class="pc${isSold ? " pc-sold" : ""}" onclick="ModalController.openProduct(${p.id})">
        <div class="pc-img" id="pc-img-${p.id}">
          <span class="pc-em">${p.em}</span>
          <span class="pc-type badge ${p.type === "Sell" ? "badge-blue" : "badge-amber"}">${p.type}</span>
          ${isSold ? '<span class="pc-stat badge badge-gray">Sold</span>' : p.status !== "Active" ? `<span class="pc-stat badge badge-gray">${p.status}</span>` : ""}
        </div>
        <div class="pc-body">
          <div class="pc-title">${p.title}</div>
          <div class="pc-course">${p.course} · ${p.cat}</div>
          <div class="pc-price">৳${p.price.toLocaleString()}</div>
          <div class="pc-seller">By ${seller ? seller.fname + " " + seller.lname : "Unknown"} · ${p.cond}</div>
        </div>
        <div class="pc-footer">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();ModalController.openProduct(${p.id})">View</button>
          ${
            own
              ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();PostController.edit(${p.id})"><i class="ph-bold ph-pencil-simple"></i> Edit</button>`
              : isSold
              ? `<button class="btn btn-ghost btn-sm" disabled style="opacity:.5;cursor:default">Sold</button>`
              : `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();MsgController.startWith(${p.sid})"><i class="ph-bold ph-chat-circle-dots"></i> Chat</button>`
          }
        </div>
      </div>`;
  }

  /** Apply filter bar values and re-render */
  static filter() {
    const c = document.getElementById("f-course").value.toLowerCase();
    const cat = document.getElementById("f-cat").value;
    const mn = parseFloat(document.getElementById("f-min").value) || 0;
    const mx = parseFloat(document.getElementById("f-max").value) || Infinity;
    const ty = document.getElementById("f-type").value;

    MarketController.render(
      db.data.products.filter(
        (p) =>
          (!c || p.course.toLowerCase().includes(c) || p.title.toLowerCase().includes(c)) &&
          (!cat || p.cat === cat) &&
          p.price >= mn &&
          p.price <= mx &&
          (!ty || p.type === ty),
      ),
    );
  }

  /** Reset all filters and re-render full list */
  static clearFilters() {
    ["f-course", "f-min", "f-max"].forEach((id) => (document.getElementById(id).value = ""));
    ["f-cat", "f-type"].forEach((id) => (document.getElementById(id).value = ""));
    MarketController.render();
  }

  /** Search from the global nav bar and navigate to marketplace */
  static globalSearch() {
    const q = document.getElementById("g-srch").value.toLowerCase().trim();
    if (!q) return;
    Router.go("marketplace");
    MarketController.render(
      db.data.products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.course.toLowerCase().includes(q) ||
          p.cat.toLowerCase().includes(q),
      ),
    );
  }
}

const Market = MarketController;
