"use strict";

/**
 * Badge — syncs unread message count badges across the navbar, sidebar, and bottom bar.
 *
 * "Unread" = threads where the last message was sent TO the current user and the
 * user has not opened that conversation since it arrived.
 *
 * Read state is persisted in localStorage so it survives page refresh.
 * Key: `ewu_seen_${uid}`  Value: JSON { [partnerId]: lastSeenMsgId }
 */
class Badge {
  static _seenKey(uid) {
    return `ewu_seen_${uid}`;
  }

  static _loadSeen(uid) {
    try {
      return JSON.parse(localStorage.getItem(Badge._seenKey(uid)) || "{}");
    } catch {
      return {};
    }
  }

  static _saveSeen(uid, map) {
    localStorage.setItem(Badge._seenKey(uid), JSON.stringify(map));
  }

  /** Mark a conversation as fully read — call when a thread is opened. */
  static markRead(uid, partnerId) {
    const thread = db.thread(uid, partnerId);
    if (!thread.length) return;
    const lastMsg = thread[thread.length - 1];
    const seen = Badge._loadSeen(uid);
    seen[String(partnerId)] = lastMsg.id;
    Badge._saveSeen(uid, seen);
    Badge.update();
  }

  /** Count threads where latest msg was received and not yet seen. */
  static _countUnread(uid) {
    const seen = Badge._loadSeen(uid);
    let count = 0;
    db.partners(uid).forEach((pid) => {
      const thread = db.thread(uid, pid);
      if (!thread.length) return;
      const last = thread[thread.length - 1];
      if (last.to !== uid) return; // last msg was sent by me — not unread
      if (seen[String(pid)] !== last.id) count++;
    });
    return count;
  }

  /** Recalculate and push counts to all badge elements. */
  static update() {
    const u = AuthController.user;
    if (!u || u.role === "visitor") return;

    const count = Badge._countUnread(u.id);
    ["nav-msg-cnt", "sb-msg-bdg", "bar-msg-bb"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = count || "";
      el.classList.toggle("hidden", count === 0);
    });
  }
}
