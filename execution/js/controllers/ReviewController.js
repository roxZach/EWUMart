"use strict";

/**
 * ReviewController — user-to-user review & rating widget.
 *
 * Rating model (stars > 0):  one per (viewer → target) pair, upserted.
 * Text review (stars === 0): multiple per pair, each independently editable/deletable.
 *
 * Usage:
 *   ReviewController.renderForUser(targetUid, containerEl, viewerUid)
 *   ReviewController.statLine(uid)   → HTML string showing "★ 4.5 · 3 reviews"
 */
class ReviewController {
  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Render the full review section (write widget + reviewer groups) into container.
   * @param {number} targetUid  — whose reviews are being shown
   * @param {HTMLElement} container
   * @param {number} viewerUid  — currently logged-in user
   */
  static renderForUser(targetUid, container, viewerUid) {
    if (!container) return;

    const reviews = db.data.reviews.filter((r) => r.for === targetUid);
    // Unique reviewer IDs — order: viewer first (so own block is on top), then others
    const reviewerIds = [...new Set(reviews.map((r) => r.by))].sort((a, b) => {
      if (a === viewerUid) return -1;
      if (b === viewerUid) return 1;
      return 0;
    });

    let html = "";

    // Write / rate section (only for non-owners who are logged in)
    if (viewerUid && viewerUid !== targetUid && viewerUid !== 0) {
      html += ReviewController._writeSection(targetUid, viewerUid);
    }

    if (reviewerIds.length === 0) {
      html += '<div class="rv-empty">No reviews yet. Be the first!</div>';
    } else {
      reviewerIds.forEach((rid) => {
        html += ReviewController._reviewerGroup(rid, targetUid, viewerUid, reviews);
      });
    }

    container.innerHTML = html;

    // Apply profile photos to reviewer avatars AFTER DOM is ready
    // (Avatar.apply works on real elements; Avatar.html only embeds static strings)
    reviewerIds.forEach((rid) => {
      const reviewer = db.user(rid);
      if (!reviewer) return;
      const avEl = container.querySelector(`#rv-group-av-${rid}`);
      if (avEl) {
        const init = reviewer.fname[0] + (reviewer.lname ? reviewer.lname[0] : "");
        Avatar.apply(avEl, reviewer.id, init);
      }
    });

    ReviewController._wireStarPicker(container, targetUid, viewerUid);
  }

  /**
   * Return an inline HTML stat line: "★ 4.5 · 3 reviews" or "No ratings yet"
   * @param {number} uid
   * @returns {string}
   */
  static statLine(uid) {
    const avg = db.avgRating(uid);
    const rCount = db.ratingCount(uid);
    const tCount = db.reviewCount(uid);

    if (!avg && tCount === 0) {
      return '<span class="rv-no-rating">No ratings yet</span>';
    }

    let html = "";
    if (avg) {
      html += `<span class="stars" style="font-size:15px">★</span> <strong>${avg}</strong>`;
      if (rCount > 1) html += ` <span style="color:var(--text3);font-size:12px">(${rCount})</span>`;
    } else {
      html += '<span style="color:var(--text3)">Not rated</span>';
    }
    if (tCount > 0) {
      html += ` <span class="rv-stat-sep">·</span> <span class="rv-stat-txt">${tCount} ${tCount === 1 ? "review" : "reviews"}</span>`;
    }
    return html;
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  /** Submit or update the viewer's star rating for targetUid */
  static async submitRating(targetUid, stars) {
    if (AuthController.checkVisitor()) return;
    try {
      await db.addReview({ by: AuthController.user.id, for: targetUid, stars, text: "" });
      Toast.show(`Rated ${stars} ★`);
      ReviewController._refresh(targetUid);
    } catch (e) {
      Toast.show("Failed to save rating.");
    }
  }

  /** Remove the viewer's rating for targetUid */
  static async _removeRating(targetUid, rid) {
    try {
      await db.deleteReview(rid);
      Toast.show("Rating removed.");
      ReviewController._refresh(targetUid);
    } catch (e) {
      Toast.show("Failed to remove rating.");
    }
  }

  /** Post a new text review */
  static async submitText(targetUid) {
    if (AuthController.checkVisitor()) return;
    const inp = document.getElementById(`rv-inp-${targetUid}`);
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) {
      Toast.show("Please write something first.");
      return;
    }
    try {
      await db.addReview({ by: AuthController.user.id, for: targetUid, stars: 0, text });
      inp.value = "";
      Toast.show("Review posted! ✅");
      ReviewController._refresh(targetUid);
      DashController.render();
    } catch (e) {
      Toast.show("Failed to post review.");
    }
  }

  /** Switch a text bubble to inline-edit mode */
  static editReview(rid, targetUid) {
    const rv = db.data.reviews.find((r) => r.id === rid);
    if (!rv) return;
    const el = document.getElementById(`rv-b-${rid}`);
    if (!el) return;
    el.innerHTML = `
      <div class="rv-edit-row">
        <textarea class="rv-textarea" id="rv-edit-${rid}" rows="2">${ReviewController._esc(rv.text)}</textarea>
        <div class="rv-edit-btns">
          <button class="btn btn-primary btn-sm" onclick="ReviewController._saveEdit(${rid},${targetUid})">Save</button>
          <button class="btn btn-ghost btn-sm"   onclick="ReviewController._refresh(${targetUid})">Cancel</button>
        </div>
      </div>`;
  }

  static async _saveEdit(rid, targetUid) {
    const inp = document.getElementById(`rv-edit-${rid}`);
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) {
      Toast.show("Review cannot be empty.");
      return;
    }
    try {
      await db.updateReview(rid, { text });
      Toast.show("Review updated.");
      ReviewController._refresh(targetUid);
    } catch (e) {
      Toast.show("Failed to update review.");
    }
  }

  static async deleteReview(rid, targetUid) {
    if (!confirm("Delete this review?")) return;
    try {
      await db.deleteReview(rid);
      Toast.show("Review deleted.");
      ReviewController._refresh(targetUid);
      DashController.render();
    } catch (e) {
      Toast.show("Failed to delete review.");
    }
  }

  // ── Private: HTML builders ────────────────────────────────────────────────────

  static _writeSection(targetUid, viewerUid) {
    const myRating = db.data.reviews.find(
      (r) => r.by === viewerUid && r.for === targetUid && r.stars > 0,
    );
    const myStars = myRating ? myRating.stars : 0;
    const myRid = myRating ? myRating.id : null;

    return `
      <div class="rv-write-box">
        <div class="rv-write-title">Your Rating &amp; Review</div>
        <div class="rv-star-picker" data-uid="${targetUid}">
          ${[1, 2, 3, 4, 5]
            .map(
              (s) =>
                `<span class="sp-star ${s <= myStars ? "filled" : ""}" data-val="${s}">★</span>`,
            )
            .join("")}
          <span class="sp-label">
            ${
              myStars > 0
                ? `${myStars}.0 rated &nbsp;<button class="sp-remove" onclick="ReviewController._removeRating(${targetUid},${myRid})">✕ Remove</button>`
                : "Tap to rate"
            }
          </span>
        </div>
        <div class="rv-text-row">
          <textarea id="rv-inp-${targetUid}" class="rv-textarea" rows="2"
            placeholder="Share your experience…"></textarea>
          <button class="btn btn-primary btn-sm"
            onclick="ReviewController.submitText(${targetUid})">Post</button>
        </div>
      </div>`;
  }

  static _reviewerGroup(reviewerId, targetUid, viewerUid, reviews) {
    const reviewer = db.user(reviewerId);
    if (!reviewer) return "";

    const ratingRow = reviews.find(
      (r) => r.by === reviewerId && r.for === targetUid && r.stars > 0,
    );
    const textRows = reviews.filter(
      (r) => r.by === reviewerId && r.for === targetUid && r.stars === 0 && r.text,
    );

    if (!ratingRow && textRows.length === 0) return "";

    const init = reviewer.fname[0] + (reviewer.lname ? reviewer.lname[0] : "");
    const isOwn = reviewerId === viewerUid;
    const canViewProfile = reviewerId !== viewerUid;

    return `
      <div class="rv-group">
        <div class="rv-group-hdr">
          <div class="rv-group-av"
            ${canViewProfile ? `onclick="PublicProfileController.open(${reviewerId})" title="View profile"` : ""}
            style="${canViewProfile ? "cursor:pointer;" : ""}">
            <div class="rg-av" id="rv-group-av-${reviewerId}"></div>
          </div>
          <div class="rv-group-info">
            <div class="rv-group-name">${ReviewController._esc(reviewer.fname + " " + reviewer.lname)}</div>
            <div class="rv-group-meta">${ReviewController._esc(reviewer.dept)} · ${ReviewController._esc(reviewer.sem)}</div>
          </div>
          ${
            ratingRow
              ? `<div class="rv-group-rating">
              <span class="stars">${"★".repeat(ratingRow.stars)}${"☆".repeat(5 - ratingRow.stars)}</span>
              <span class="rv-stars-num">${ratingRow.stars}.0</span>
              ${isOwn ? `<button class="rv-act-btn rv-act-del" onclick="ReviewController._removeRating(${targetUid},${ratingRow.id})" title="Remove rating"><i class="ph-bold ph-x" style="font-size:12px"></i></button>` : ""}
            </div>`
              : ""
          }
        </div>
        ${textRows
          .map(
            (r) => `
          <div class="rv-bubble" id="rv-b-${r.id}">
            <div class="rv-bubble-txt">"${ReviewController._esc(r.text)}"</div>
            <div class="rv-bubble-ftr">
              <span class="rv-date">${r.date}</span>
              ${
                isOwn
                  ? `<div class="rv-acts">
                  <button class="rv-act-btn" onclick="ReviewController.editReview(${r.id},${targetUid})" title="Edit">
                    <i class="ph-bold ph-pencil-simple" style="font-size:13px"></i>
                  </button>
                  <button class="rv-act-btn rv-act-del" onclick="ReviewController.deleteReview(${r.id},${targetUid})" title="Delete">
                    <i class="ph-bold ph-trash" style="font-size:13px"></i>
                  </button>
                </div>`
                  : ""
              }
            </div>
          </div>`,
          )
          .join("")}
      </div>`;
  }

  // ── Private: star picker wiring ───────────────────────────────────────────────

  static _wireStarPicker(container, targetUid, viewerUid) {
    const picker = container.querySelector(`.rv-star-picker[data-uid="${targetUid}"]`);
    if (!picker) return;
    const stars = picker.querySelectorAll(".sp-star");
    stars.forEach((star) => {
      star.addEventListener("mouseenter", () => {
        const val = +star.dataset.val;
        stars.forEach((s) => s.classList.toggle("hover", +s.dataset.val <= val));
      });
      star.addEventListener("mouseleave", () => stars.forEach((s) => s.classList.remove("hover")));
      star.addEventListener("click", () =>
        ReviewController.submitRating(targetUid, +star.dataset.val),
      );
    });
  }

  // ── Private: refresh ─────────────────────────────────────────────────────────

  /**
   * Re-render all visible places that display reviews/rating for targetUid.
   * @param {number} targetUid
   */
  static _refresh(targetUid) {
    const viewerUid = AuthController.user ? AuthController.user.id : 0;

    // 1. Public profile modal
    const pubModal = document.getElementById("public-profile-modal");
    const pubCont = document.getElementById("pub-pfl-reviews");
    if (
      pubModal &&
      pubModal.classList.contains("open") &&
      pubCont &&
      PublicProfileController._uid === targetUid
    ) {
      ReviewController.renderForUser(targetUid, pubCont, viewerUid);
      const statEl = document.getElementById("pub-pfl-stat");
      if (statEl) statEl.innerHTML = ReviewController.statLine(targetUid);
    }

    // 2. Own profile page
    const pflPage = document.getElementById("page-profile");
    const pflCont = document.getElementById("pfl-reviews");
    if (
      pflPage &&
      pflPage.classList.contains("active") &&
      pflCont &&
      viewerUid === targetUid
    ) {
      ReviewController.renderForUser(targetUid, pflCont, viewerUid);
      ProfileController._updateRatingDisplay();
    }

    // 3. Dashboard rating stat (only if it's for the logged-in user)
    if (viewerUid === targetUid) {
      DashController._updateRatingDisplay();
    }

    // 4. Product modal seller rating chip
    const pmStat = document.getElementById("pm-seller-stat");
    if (pmStat && +pmStat.dataset.uid === targetUid) {
      pmStat.innerHTML = ReviewController.statLine(targetUid);
    }
  }

  // ── Private: util ────────────────────────────────────────────────────────────

  static _esc(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

const Review = ReviewController;
