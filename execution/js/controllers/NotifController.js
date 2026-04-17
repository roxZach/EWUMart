"use strict";

/**
 * NotifController — real-time notification dropdown.
 *
 * Shows notifications only for reviews/ratings received by the current user.
 * The unread dot clears once the dropdown is opened.
 * Persists "last seen" review ID in localStorage so new reviews show as new.
 */
class NotifController {
  static _seenKey() {
    const u = AuthController.user;
    return u ? `ewu_notif_seen_${u.id}` : null;
  }

  static _loadLastSeen() {
    const key = NotifController._seenKey();
    if (!key) return 0;
    return parseInt(localStorage.getItem(key) || "0", 10);
  }

  static _saveLastSeen(maxId) {
    const key = NotifController._seenKey();
    if (key) localStorage.setItem(key, String(maxId));
  }

  /** Build notification items for all reviews/ratings received */
  static _buildItems() {
    const u = AuthController.user;
    if (!u) return [];

    // Get all star ratings AND text reviews received, newest first
    const reviews = db.data.reviews
      .filter((r) => r.for === u.id)
      .sort((a, b) => b.id - a.id)
      .slice(0, 10); // cap at 10

    return reviews.map((r) => {
      const reviewer = db.user(r.by);
      const name = reviewer ? reviewer.fname + " " + reviewer.lname : "Someone";
      if (r.stars > 0) {
        return {
          id: r.id,
          title: `${name} rated you ${"★".repeat(r.stars)}`,
          sub: `You received a ${r.stars}-star rating`,
          date: r.date,
        };
      } else {
        return {
          id: r.id,
          title: `${name} left you a review`,
          sub: `"${r.text.slice(0, 60)}${r.text.length > 60 ? "…" : ""}"`,
          date: r.date,
        };
      }
    });
  }

  /** Count reviews received since the last time dropdown was opened */
  static countNew() {
    const u = AuthController.user;
    if (!u) return 0;
    const lastSeen = NotifController._loadLastSeen();
    return db.data.reviews.filter(
      (r) => r.for === u.id && r.id > lastSeen
    ).length;
  }

  /** Update the notification dot visibility */
  static updateDot() {
    const dot = document.getElementById("notif-dot");
    if (!dot) return;
    const hasNew = NotifController.countNew() > 0;
    dot.style.display = hasNew ? "" : "none";
  }

  /** Render the dropdown content */
  static _render() {
    const dd = document.getElementById("notif-dd");
    if (!dd) return;

    const items = NotifController._buildItems();

    if (!items.length) {
      dd.innerHTML = `
        <div class="dd-hdr">Notifications</div>
        <div class="dd-item" style="color:var(--text3);text-align:center;padding:20px 16px">
          <i class="ph-bold ph-bell-slash" style="font-size:24px;display:block;margin-bottom:6px"></i>
          No notifications yet
        </div>`;
      return;
    }

    const lastSeen = NotifController._loadLastSeen();
    dd.innerHTML = `<div class="dd-hdr">Notifications</div>` +
      items.map((item) => `
        <div class="dd-item${item.id > lastSeen ? " dd-item-new" : ""}">
          <div class="ni-t">${item.title}</div>
          <div class="ni-s">${item.sub}</div>
          ${item.date ? `<div class="ni-date">${item.date}</div>` : ""}
        </div>`).join("");
  }

  /** Toggle the notification dropdown and mark all as seen */
  static toggle() {
    const dd = document.getElementById("notif-dd");
    if (!dd) return;

    const isOpen = dd.classList.toggle("open");

    if (isOpen) {
      NotifController._render();

      // Mark all current reviews as seen
      const u = AuthController.user;
      if (u) {
        const allReviewIds = db.data.reviews
          .filter((r) => r.for === u.id)
          .map((r) => r.id);
        if (allReviewIds.length) {
          NotifController._saveLastSeen(Math.max(...allReviewIds));
        }
      }

      // Clear the dot
      const dot = document.getElementById("notif-dot");
      if (dot) dot.style.display = "none";
    }
  }
}
