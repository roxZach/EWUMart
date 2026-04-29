"use strict";

/**
 * ApiService — thin HTTP client for the EWUMart REST API.
 * All methods return Promises. Throws on non-2xx responses.
 */
class ApiService {
  static BASE = "/api";

  /**
   * Core request helper.
   * @param {string} method - HTTP verb
   * @param {string} path   - path after /api (e.g. '/login')
   * @param {object} [body] - JSON payload for POST/PUT
   */
  static async _req(method, path, body = null) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body !== null) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(ApiService.BASE + path, opts);
    } catch {
      throw new Error(
        "Unable to reach the server. Please check your connection and try again.",
      );
    }

    const raw = await res.text();

    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      if (data && data.error) {
        throw new Error(data.error);
      }

      const t = (raw || "").trim().toLowerCase();
      if (t.startsWith("<!doctype") || t.startsWith("<html")) {
        throw new Error("Server error. Please try again in a moment.");
      }

      throw new Error(`Request failed (${res.status})`);
    }

    if (data === null) {
      const t = (raw || "").trim().toLowerCase();
      if (t.startsWith("<!doctype") || t.startsWith("<html")) {
        throw new Error("Server error. Please refresh and try again.");
      }
      throw new Error("Unexpected server response. Please try again.");
    }

    return data;
  }

  static get(path) {
    return ApiService._req("GET", path);
  }
  static post(path, body) {
    return ApiService._req("POST", path, body);
  }
  static put(path, body) {
    return ApiService._req("PUT", path, body);
  }
  static del(path) {
    return ApiService._req("DELETE", path);
  }

  // ── Shortcuts ──────────────────────────────────────────────────────────────

  /** Login — returns user object or throws */
  static login(email, pw) {
    return ApiService.post("/login", { email, pw });
  }

  /** Register — returns new user object or throws */
  static register(data) {
    return ApiService.post("/register", data);
  }

  /** Google Register — verifies ID token server-side, upserts user, returns user object */
  static registerGoogle(data) {
    return ApiService.post("/register/google", data);
  }

  /**
   * Unified Google Auth — verifies token, returns existing user OR
   * {new_user: true, email, given_name, family_name} for new students.
   */
  static authGoogle(data) {
    return ApiService.post("/auth/google", data);
  }

  /** Load all app data for uid in one round-trip */
  static init(uid) {
    return ApiService.get(`/init/${uid}`);
  }

  /** Products */
  static getProducts() {
    return ApiService.get("/products");
  }
  static createProduct(data) {
    return ApiService.post("/products", data);
  }
  static updateProduct(id, data) {
    return ApiService.put(`/products/${id}`, data);
  }
  static deleteProduct(id) {
    return ApiService.del(`/products/${id}`);
  }

  /** Messages */
  static getMessages(uid) {
    return ApiService.get(`/messages/${uid}`);
  }
  static sendMessage(data) {
    return ApiService.post("/messages", data);
  }

  /** Transactions */
  static createTransaction(data) {
    return ApiService.post("/transactions", data);
  }

  /** Reports */
  static createReport(data) {
    return ApiService.post("/reports", data);
  }
  static resolveReport(id) {
    return ApiService.put(`/reports/${id}`, { status: "Resolved" });
  }

  /** Users */
  static updateUser(id, data) {
    return ApiService.put(`/users/${id}`, data);
  }

  static deleteUser(id) {
    return ApiService.del(`/users/${id}`);
  }

  static updatePassword(id, currentPw, newPw) {
    return ApiService.put(`/users/${id}/password`, { currentPw, newPw });
  }

  /** Single user public data */
  static getUser(uid) {
    return ApiService.get(`/users/${uid}`);
  }

  /** Reviews */
  static getReviewsFor(uid) {
    return ApiService.get(`/reviews/${uid}`);
  }
  static submitReview(data) {
    return ApiService.post('/reviews', data);
  }
  static updateReview(id, data) {
    return ApiService.put(`/reviews/${id}`, data);
  }
  static deleteReview(id) {
    return ApiService.del(`/reviews/${id}`);
  }
}
