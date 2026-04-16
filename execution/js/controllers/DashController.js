"use strict";

/**
 * DashController — renders the dashboard page.
 * Shows user hero card, stat grid, recent listings, and reviews.
 * Depends on: db, AuthController
 */
class DashController {
  /** Open profile page directly in edit mode from dashboard CTA */
  static editProfile() {
    Router.go("profile");
    requestAnimationFrame(() => ProfileController.startEdit());
  }

  /** Render the full dashboard for the logged-in user */
  static render() {
    const u = AuthController.user;
    if (!u) return;

    // Hero card
    const init = u.fname[0] + (u.lname ? u.lname[0] : "");
    Avatar.apply(document.getElementById("dh-av"), u.id, init);
    document.getElementById("dh-name").textContent = u.fname + " " + u.lname;
    document.getElementById("dh-dept").textContent = u.dept;
    document.getElementById("dh-sem").textContent = u.sem;
    DashController._updateRatingDisplay();

    if (u.role === "admin") {
      // Platform Statistics
      document.getElementById("dash-adm-u").textContent = db.data.users.length;
      document.getElementById("dash-adm-l").textContent =
        db.data.products.filter((p) => p.status === "Active").length;
      document.getElementById("dash-adm-t").textContent = db.data.txns.length;
      document.getElementById("dash-adm-r").textContent =
        db.data.reports.filter((r) => r.status === "Pending").length;
    } else {
      // Stat counters
      const mine = db.data.products.filter((p) => p.sid === u.id);
      document.getElementById("s-listed").textContent = mine.length;
      document.getElementById("s-sold").textContent = mine.filter(
        (p) => p.status === "Sold",
      ).length;
      document.getElementById("s-bought").textContent = db.data.txns.filter(
        (t) => t.bid === u.id,
      ).length;

      // Recent listings
      DashController._renderListings(mine);

      // Recent reviews
      DashController._renderReviews(u.id);
    }
  }

  /** Update the live rating stat line in the dashboard hero */
  static _updateRatingDisplay() {
    const el = document.getElementById("dh-rating");
    if (!el) return;
    const u = AuthController.user;
    if (!u || u.role === "admin") return;
    el.innerHTML = ReviewController.statLine(u.id);
  }

  /** Render recent 4 listings in the dashboard card */
  static _renderListings(mine) {
    const el = document.getElementById("dash-listings");
    const recent = mine.slice(-4).reverse();

    el.innerHTML = recent.length
      ? recent
          .map(
            (p) => `
          <div class="txn-row">
            <span style="font-size:22px">${p.em}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.title}</div>
              <div style="font-size:12px;color:var(--text3)">${p.course} · ৳${p.price}</div>
            </div>
            <span class="badge ${p.status === "Active" ? "badge-green" : "badge-gray"}">${p.status}</span>
          </div>`,
          )
          .join("")
      : '<div style="color:var(--text3);font-size:14px;text-align:center;padding:20px 0">No listings yet</div>';
  }

  /** Render the last 3 text reviews (stars === 0) received by userId */
  static _renderReviews(userId) {
    const el = document.getElementById("dash-reviews");

    // Only show text reviews (not rating-only rows)
    const textRevs = db.data.reviews
      .filter((r) => r.for === userId && r.stars === 0 && r.text)
      .slice(-3)
      .reverse();

    if (!textRevs.length) {
      el.innerHTML =
        '<div style="color:var(--text3);font-size:14px;text-align:center;padding:20px 0">No reviews yet</div>';
      return;
    }

    el.innerHTML = textRevs
      .map((r) => {
        const who = db.user(r.by);
        const whoId = who ? who.id : 0;
        const theirRating = db.data.reviews.find(
          (rv) => rv.by === r.by && rv.for === userId && rv.stars > 0,
        );
        return `
          <div class="rv-item">
            <div class="rv-user">
              <div onclick="${whoId ? `PublicProfileController.open(${whoId})` : ""}"
                   title="${who ? "View " + who.fname + "'s profile" : ""}"
                   style="${whoId ? "cursor:pointer;" : ""}">
                <div class="rv-av" id="dash-rv-av-${r.id}"></div>
              </div>
              <div>
                <div style="font-weight:500;font-size:13px;${whoId ? "cursor:pointer;" : ""}"
                     onclick="${whoId ? `PublicProfileController.open(${whoId})` : ""}">
                  ${who ? who.fname + " " + who.lname : "Unknown"}
                </div>
                ${theirRating ? `<div class="stars" style="font-size:12px">${"★".repeat(theirRating.stars)}${"☆".repeat(5 - theirRating.stars)}</div>` : ""}
              </div>
              <div style="margin-left:auto;font-size:11px;color:var(--text3)">${r.date}</div>
            </div>
            <div class="rv-text">"${r.text}"</div>
          </div>`;
      })
      .join("");

    // Apply profile photos after DOM is ready (matches the proven Avatar.apply approach)
    textRevs.forEach((r) => {
      const who = db.user(r.by);
      const avEl = document.getElementById(`dash-rv-av-${r.id}`);
      if (avEl && who) {
        const init = who.fname[0] + (who.lname ? who.lname[0] : "");
        Avatar.apply(avEl, who.id, init);
      }
    });
  }
}

const Dash = DashController;
