"use strict";

/**
 * Database — in-memory cache backed by the Flask/SQLite REST API.
 *
 * On login:   db.init(uid)   loads all data from the server.
 * Mutations:  each write method calls the API then updates the local cache,
 *             so all controller render() calls stay synchronous.
 */
class Database {
  constructor() {
    this.data = {
      users: [],
      products: [],
      msgs: [],
      txns: [],
      reviews: [],
      reports: [],
    };
  }

  /**
   * Fetch all data for the logged-in user in one round-trip.
   * Must be awaited before rendering any page.
   * @param {number} uid — current user ID
   */
  async init(uid) {
    if (uid === 0) {
      this.data.products = await ApiService.getProducts();
      this.data.users = [];
      this.data.msgs = [];
      this.data.txns = [];
      this.data.reviews = [];
      this.data.reports = [];
      return;
    }
    const d = await ApiService.init(uid);
    this.data.users = d.users || [];
    this.data.products = d.products || [];
    this.data.msgs = d.msgs || [];
    this.data.txns = d.txns || [];
    this.data.reviews = d.reviews || [];
    this.data.reports = d.reports || [];
  }

  // ── Sync lookups (read from cache) ─────────────────────────────────────────

  /** @returns {object|undefined} */
  user(id) {
    return this.data.users.find((u) => u.id === id);
  }

  /** @returns {object|undefined} */
  prod(id) {
    return this.data.products.find((p) => p.id === id);
  }

  /** All partner user IDs for uid */
  partners(uid) {
    const mine = this.data.msgs.filter((m) => m.from === uid || m.to === uid);
    return [...new Set(mine.map((m) => (m.from === uid ? m.to : m.from)))];
  }

  /** Messages exchanged between uid and pid */
  thread(uid, pid) {
    return this.data.msgs.filter(
      (m) =>
        (m.from === uid && m.to === pid) || (m.from === pid && m.to === uid),
    );
  }

  /** Count of conversation partners (badge count) */
  unread(uid) {
    return this.partners(uid).length;
  }

  // ── Async mutators (API → cache) ───────────────────────────────────────────

  /** Create a new product listing */
  async addProduct(data) {
    const saved = await ApiService.createProduct(data);
    this.data.products.unshift(saved); // newest-first
    return saved;
  }

  /**
   * Update an existing product.
   * @param {number} id
   * @param {object} changes — full product fields to update
   */
  async updateProduct(id, changes) {
    const saved = await ApiService.updateProduct(id, changes);
    const idx = this.data.products.findIndex((p) => p.id === id);
    if (idx >= 0) this.data.products[idx] = saved;
    return saved;
  }

  /** Delete a product */
  async removeProd(id) {
    await ApiService.deleteProduct(id);
    this.data.products = this.data.products.filter((p) => p.id !== id);
  }

  /** Send a chat message */
  async addMsg(data) {
    const saved = await ApiService.sendMessage(data);
    this.data.msgs.push(saved);
    return saved;
  }

  /** Reload messages for uid (e.g. after sending) */
  async reloadMsgs(uid) {
    this.data.msgs = await ApiService.getMessages(uid);
  }

  /** Create a purchase transaction (also marks product Sold on server) */
  async addTxn(data) {
    const saved = await ApiService.createTransaction(data);
    this.data.txns.push(saved);
    // Reflect sold status in cache
    const p = this.prod(data.pid);
    if (p) p.status = "Sold";
    return saved;
  }

  /** Submit a content report */
  async addReport(data) {
    const saved = await ApiService.createReport(data);
    this.data.reports.push(saved);
    return saved;
  }

  /** Resolve a report (admin) */
  async resolveReport(id) {
    const saved = await ApiService.resolveReport(id);
    const idx = this.data.reports.findIndex((r) => r.id === id);
    if (idx >= 0) this.data.reports[idx] = saved;
    return saved;
  }

  /** Update a user's profile fields */
  async updateUser(uid, changes) {
    const saved = await ApiService.updateUser(uid, changes);
    const idx = this.data.users.findIndex((u) => u.id === uid);
    if (idx >= 0) this.data.users[idx] = saved;
    return saved;
  }

  /** Update a user's password after validating current password */
  async updatePassword(uid, currentPw, newPw) {
    return ApiService.updatePassword(uid, currentPw, newPw);
  }

  /** Admin: create a new user account */
  async addUser(data) {
    const saved = await ApiService.register(data);
    this.data.users.push(saved);
    return saved;
  }

  /** Admin: promote/demote a user's role */
  async setUserRole(uid, role) {
    const saved = await ApiService.put(`/users/${uid}/role`, { role });
    const idx = this.data.users.findIndex((u) => u.id === uid);
    if (idx >= 0) this.data.users[idx] = saved;
    return saved;
  }

  /** Admin: delete a user */
  async removeUser(uid) {
    await ApiService.deleteUser(uid);
    this.data.users = this.data.users.filter((u) => u.id !== uid);
    this.data.products = this.data.products.filter((p) => p.sid !== uid);
    this.data.msgs = this.data.msgs.filter((m) => m.from !== uid && m.to !== uid);
    this.data.reviews = this.data.reviews.filter((r) => r.by !== uid && r.for !== uid);
    this.data.txns = this.data.txns.filter((t) => t.bid !== uid && t.seller !== uid);
    this.data.reports = this.data.reports.filter((r) => r.by !== uid);
  }

  // ── Review helpers (read from cache) ────────────────────────────────────────

  /** All reviews received by uid */
  reviewsFor(uid) {
    return this.data.reviews.filter((r) => r.for === uid);
  }

  /** All reviews written by uid */
  reviewsBy(uid) {
    return this.data.reviews.filter((r) => r.by === uid);
  }

  /** Average star rating for uid (from rating rows, stars > 0). Returns null if none. */
  avgRating(uid) {
    const rows = this.data.reviews.filter((r) => r.for === uid && r.stars > 0);
    if (!rows.length) return null;
    return (rows.reduce((s, r) => s + r.stars, 0) / rows.length).toFixed(1);
  }

  /** Number of distinct people who rated uid */
  ratingCount(uid) {
    return this.data.reviews.filter((r) => r.for === uid && r.stars > 0).length;
  }

  /** Number of text reviews received by uid */
  reviewCount(uid) {
    return this.data.reviews.filter((r) => r.for === uid && r.stars === 0 && r.text).length;
  }

  // ── Review mutators (API → cache) ────────────────────────────────────────────

  /**
   * Submit a rating (stars > 0, upserted) or text review (stars === 0).
   * @param {{ by, for, stars, text }} data
   */
  async addReview(data) {
    const saved = await ApiService.submitReview({
      by: data.by,
      for: data.for,
      stars: data.stars || 0,
      text: data.text || '',
    });
    if (data.stars > 0) {
      // Upsert: replace existing rating row in cache
      const idx = this.data.reviews.findIndex(
        (r) => r.by === data.by && r.for === data.for && r.stars > 0,
      );
      if (idx >= 0) this.data.reviews[idx] = saved;
      else this.data.reviews.push(saved);
    } else {
      this.data.reviews.push(saved);
    }
    return saved;
  }

  /** Update a review row's text or stars */
  async updateReview(id, changes) {
    const saved = await ApiService.updateReview(id, changes);
    const idx = this.data.reviews.findIndex((r) => r.id === id);
    if (idx >= 0) this.data.reviews[idx] = saved;
    return saved;
  }

  /** Delete a review row */
  async deleteReview(id) {
    await ApiService.deleteReview(id);
    this.data.reviews = this.data.reviews.filter((r) => r.id !== id);
  }

  /**
   * Merge a fresh batch of reviews for a user into the cache
   * (used when opening a public profile to pull that user's reviews).
   */
  mergeReviews(reviews) {
    reviews.forEach((r) => {
      const idx = this.data.reviews.findIndex((x) => x.id === r.id);
      if (idx >= 0) this.data.reviews[idx] = r;
      else this.data.reviews.push(r);
    });
  }
}
