"use strict";

/**
 * AuthController — handles login, registration, demo login, and logout.
 * All auth calls hit the Flask API; on success db.init() loads all app data.
 * Depends on: ApiService, db (Database), Badge, Router, Toast, Loader
 */
class AuthController {
  static _u = null;

  static get user() {
    return AuthController._u;
  }

  static switchTab(tab, btn) {
    document
      .querySelectorAll(".auth-tab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document
      .getElementById("login-form")
      .classList.toggle("hidden", tab !== "login");
    document
      .getElementById("register-form")
      .classList.toggle("hidden", tab !== "register");
    document.getElementById("auth-err").style.display = "none";
    document.getElementById("auth-h").textContent =
      tab === "login" ? "Welcome back" : "Create Account";
  }

  /** Email/password login via API */
  static async login() {
    const em = document.getElementById("l-email").value.trim();
    const pw = document.getElementById("l-pass").value;
    if (!em || !pw) {
      AuthController._err("Please enter email and password.");
      return;
    }

    try {
      Loader.show("Signing in…");
      const u = await ApiService.login(em, pw);
      await AuthController._enter(u);
    } catch (e) {
      AuthController._err(e.message || "Login failed.");
    } finally {
      Loader.hide();
    }
  }

  /** Register new account via API */
  static async register() {
    const fn = document.getElementById("r-fn").value.trim();
    const ln = document.getElementById("r-ln").value.trim();
    const em = document.getElementById("r-em").value.trim();
    const sid = document.getElementById("r-sid").value.trim();
    const dept = document.getElementById("r-dept").value;
    const sem = document.getElementById("r-sem").value;
    const pw = document.getElementById("r-pw").value;

    if (!fn || !em || !pw || !dept || !sem) {
      AuthController._err("Please fill all required fields.");
      return;
    }
    if (pw.length < 6) {
      AuthController._err("Password must be at least 6 characters.");
      return;
    }

    try {
      Loader.show("Creating account…");
      const u = await ApiService.register({
        fname: fn,
        lname: ln,
        email: em,
        pw,
        dept,
        sem,
        sid,
      });
      await AuthController._enter(u);
    } catch (e) {
      AuthController._err(e.message || "Registration failed.");
    } finally {
      Loader.hide();
    }
  }

  /** Quick visitor login */
  static async visitor() {
    try {
      Loader.show("Entering as visitor…");
      const u = {
        id: 0,
        fname: "Guest",
        lname: "Visitor",
        role: "visitor",
        dept: "",
        sem: "",
      };
      await AuthController._enter(u);
      Router.go("marketplace"); // Default to marketplace for visitors
    } catch (e) {
      AuthController._err("Visitor entry failed.");
    } finally {
      Loader.hide();
    }
  }

  static exitVisitorToRegister() {
    document.getElementById("vis-modal").classList.remove("open");
    this.logout();
    this.switchTab("register", document.querySelectorAll(".auth-tab")[1]);
  }

  static checkVisitor() {
    if (this._u && this._u.role === "visitor") {
      document.getElementById("vis-modal").classList.add("open");
      return true;
    }
    return false;
  }

  static confirmLogout() {
    AuthController._closeProfileMenu();
    document.getElementById("logout-modal").classList.add("open");
  }

  static closeLogoutModal() {
    document.getElementById("logout-modal").classList.remove("open");
  }

  /** Toggle the profile dropdown open/closed. */
  static toggleProfileMenu() {
    const dd = document.getElementById("profile-dd");
    dd.classList.toggle("open");
  }

  /** Close the profile dropdown (used internally). */
  static _closeProfileMenu() {
    const dd = document.getElementById("profile-dd");
    if (dd) dd.classList.remove("open");
  }

  /** Navigate to Profile page and optionally open edit mode. */
  static goProfile(startEditing = false) {
    AuthController._closeProfileMenu();
    if (startEditing) {
      ProfileController.requestOpenInEditMode();
    }
    Router.go("profile");
  }

  /** Logout — clear session and return to auth screen */
  static logout() {
    AuthController.closeLogoutModal();
    AuthController._u = null;
    localStorage.removeItem("ewumart_session");
    document.getElementById("app").classList.remove("visible");
    document.getElementById("auth-screen").style.display = "flex";
  }

  // ── Private ─────────────────────────────────────────────────────────────

  /** Load all data then enter the app */
  static async _enter(u) {
    AuthController._u = u;
    Loader.show("Loading your data…");
    await db.init(u.id);
    Loader.hide();

    // Persist session so refresh doesn't log out
    localStorage.setItem("ewumart_session", JSON.stringify(u));

    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app").classList.add("visible");
    const navAv = document.getElementById("nav-av");
    Avatar.apply(navAv, u.id, u.fname[0] + (u.lname ? u.lname[0] : ""));
    document
      .getElementById("sb-admin-sec")
      .classList.toggle("hidden", u.role !== "admin");
    document.body.classList.toggle("is-admin", u.role === "admin");

    // Close profile dropdown on outside click (attach once)
    if (!AuthController._outsideClickBound) {
      AuthController._outsideClickBound = true;
      document.addEventListener("click", (e) => {
        const wrap = document.getElementById("profile-dd-wrap");
        if (wrap && !wrap.contains(e.target)) {
          AuthController._closeProfileMenu();
        }
      });
    }

    Badge.update();
    Router.go("dashboard");
    Toast.show(`Welcome, ${u.fname}! 👋`);
  }

  static _err(msg) {
    const el = document.getElementById("auth-err");
    el.textContent = msg;
    el.style.display = "block";
  }

  /**
   * Try to restore a previous session from localStorage.
   * Called once on page load by app.js.
   * Returns true if a session was restored, false otherwise.
   */
  static async tryRestore() {
    const raw = localStorage.getItem("ewumart_session");
    if (!raw) return false;
    try {
      const u = JSON.parse(raw);
      if (!u || !u.id) return false;
      // Visitor sessions should NOT be persisted
      if (u.role === "visitor") {
        localStorage.removeItem("ewumart_session");
        return false;
      }
      await AuthController._enter(u);
      return true;
    } catch {
      localStorage.removeItem("ewumart_session");
      return false;
    }
  }
}

const Auth = AuthController;
