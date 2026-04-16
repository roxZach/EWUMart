"use strict";

/**
 * PublicProfileController — read-only profile modal for any user.
 *
 * Opens an overlay showing avatar, info, real rating stats, and full
 * reviews rendered by ReviewController. Has a Message button.
 * Cannot be used to view own profile (redirects to Profile page instead).
 */
class PublicProfileController {
  static _uid = null; // currently displayed user's ID

  /**
   * Open the public profile modal for a user.
   * @param {number} uid — target user ID
   */
  static async open(uid) {
    if (!AuthController.user) return;

    // Viewing own profile → go to profile page instead
    if (uid === AuthController.user.id) {
      Router.go("profile");
      return;
    }

    const overlay = document.getElementById("public-profile-modal");
    if (!overlay) return;

    PublicProfileController._uid = uid;

    // Show modal with spinner
    document.getElementById("pub-pfl-body").innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text3)">
        <div style="width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--brand-mid);
          border-radius:50%;animation:spin .7s linear infinite;margin-right:12px"></div>
        Loading…
      </div>`;
    overlay.classList.add("open");

    try {
      // Fetch fresh user data; reviews are already being cached in db.data.reviews
      // but we fetch to ensure we have the full picture even if they weren't
      // in the current user's init data.
      const [userData, freshRevs] = await Promise.all([
        ApiService.getUser(uid),
        ApiService.getReviewsFor(uid),
      ]);

      // Merge fresh reviews into cache
      db.mergeReviews(freshRevs);

      PublicProfileController._render(userData);
    } catch (e) {
      document.getElementById("pub-pfl-body").innerHTML = `
        <div style="color:var(--danger);padding:24px;text-align:center">
          <i class="ph-bold ph-warning" style="font-size:32px;display:block;margin-bottom:8px"></i>
          Could not load profile.
        </div>`;
    }
  }

  static _render(u) {
    const viewerUid = AuthController.user.id;
    const init = u.fname[0] + (u.lname ? u.lname[0] : "");
    const isVisitorUser = u.role === "visitor";

    document.getElementById("pub-pfl-body").innerHTML = `
      <div class="pub-pfl-top">
        <div class="pub-pfl-av-wrap">
          <div class="pub-pfl-av" id="pub-pfl-av-img"></div>
        </div>
        <div class="pub-pfl-info">
          <div class="pub-pfl-name">${PublicProfileController._esc(u.fname + " " + u.lname)}</div>
          ${u.sid ? `<div class="pub-pfl-id">${PublicProfileController._esc(u.sid)}</div>` : ""}
          <div class="pub-pfl-meta">
            <span>${PublicProfileController._esc(u.dept)}</span>
            ${u.sem ? `<span>${PublicProfileController._esc(u.sem)}</span>` : ""}
          </div>
          <div class="pub-pfl-rating" id="pub-pfl-stat">
            ${ReviewController.statLine(u.id)}
          </div>
        </div>
      </div>

      ${u.bio ? `<div class="pub-pfl-bio">"${PublicProfileController._esc(u.bio)}"</div>` : ""}

      <div class="pub-pfl-actions">
        ${
          !isVisitorUser
            ? `<button class="btn btn-primary" onclick="PublicProfileController.message()">
            <i class="ph-bold ph-chat-circle-dots"></i> Message
          </button>`
            : ""
        }
      </div>

      <div class="pub-pfl-rv-section">
        <div class="sec-title" style="margin-bottom:14px">Reviews</div>
        <div id="pub-pfl-reviews"></div>
      </div>`;

    // Apply profile photo after DOM is ready
    const avEl = document.getElementById("pub-pfl-av-img");
    if (avEl) Avatar.apply(avEl, u.id, init);

    ReviewController.renderForUser(
      u.id,
      document.getElementById("pub-pfl-reviews"),
      viewerUid,
    );
  }

  /** Start a message thread with the currently viewed user */
  static message() {
    if (AuthController.checkVisitor()) return;
    PublicProfileController.close();
    MsgController.startWith(PublicProfileController._uid);
  }

  static close() {
    const overlay = document.getElementById("public-profile-modal");
    if (overlay) overlay.classList.remove("open");
    PublicProfileController._uid = null;
  }

  static _esc(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

const PublicProfile = PublicProfileController;
