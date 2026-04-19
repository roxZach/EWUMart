"use strict";

/**
 * AuthController — Google-only auth for EWUMart.
 *
 * Two tabs share the same GSI callback but behave differently based on _mode:
 *  - "login"    → token sent to /api/auth/google
 *                 existing user → _enter()
 *                 new user      → error "No account found, please sign up"
 *  - "register" → token sent to /api/auth/google
 *                 new user      → show profile-completion modal
 *                 existing user → error "Already registered, please login"
 */

const GOOGLE_CLIENT_ID =
  "863974990132-625q9ea2m387u3c2ktolm22084rmde6t.apps.googleusercontent.com";

class AuthController {
  static _u = null;
  static _googleToken = null;
  static _googlePayload = null;
  static _gsiReady = false;
  static _mode = "login"; // "login" | "register"

  static get user() {
    return AuthController._u;
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

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

    // Track which tab is active so the GSI callback knows what to do
    AuthController._mode = tab === "login" ? "login" : "register";
  }

  // ── GSI Initialisation ────────────────────────────────────────────────────

  /**
   * Called once on page load (app.js → tryRestore → initGSI).
   * Renders two independent Google buttons — one per tab — sharing the same
   * callback. The _mode flag tells the callback how to handle the result.
   */
  static initGSI() {
    if (typeof google === "undefined" || !google.accounts) {
      setTimeout(() => AuthController.initGSI(), 500);
      return;
    }
    if (AuthController._gsiReady) return;
    AuthController._gsiReady = true;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: AuthController._handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    AuthController._renderGSIBtn("google-signin-btn-login");
    AuthController._renderGSIBtn("google-signin-btn-register");
  }

  static _renderGSIBtn(id) {
    const el = document.getElementById(id);
    if (!el) return;
    // Only render if not already populated (avoids duplicate iframes)
    if (el.innerHTML.trim() !== "") return;
    google.accounts.id.renderButton(el, {
      theme: "outline",
      size: "large",
      width: el.closest(".auth-box")?.offsetWidth - 64 || 340,
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
    });
  }

  // ── JWT helper ────────────────────────────────────────────────────────────

  static _decodeJWT(token) {
    try {
      const payload = token.split(".")[1];
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  // ── Google credential callback (shared by both buttons) ───────────────────

  static async _handleGoogleCredential(response) {
    const token = response.credential;
    const payload = AuthController._decodeJWT(token);
    const mode = AuthController._mode;

    // Client-side domain pre-check
    if (payload) {
      const email = (payload.email || "").toLowerCase();
      if (!email.endsWith("@std.ewubd.edu")) {
        AuthController._err(
          `Only @std.ewubd.edu accounts are allowed. You signed in with: ${email}`,
        );
        try {
          google.accounts.id.revoke(email, () => {});
        } catch {}
        return;
      }
    }

    AuthController._googleToken = token;
    AuthController._googlePayload = payload;

    try {
      Loader.show(mode === "login" ? "Signing in…" : "Checking account…");
      const result = await ApiService.authGoogle({ id_token: token });

      // ── LOGIN mode ─────────────────────────────────────────────────────────
      if (mode === "login") {
        if (result.new_user) {
          Loader.hide();
          AuthController._err(
            "No account found with this Google account. " +
              "Please use the Sign Up tab to create one.",
          );
          return;
        }
        await AuthController._enter(result); // ← existing user, log in

        // ── SIGN UP mode ───────────────────────────────────────────────────────
      } else {
        if (!result.new_user) {
          Loader.hide();
          AuthController._err(
            "You already have an account. Please use the Login tab.",
          );
          return;
        }
        Loader.hide();
        AuthController._openProfileModal(result); // ← new user, show step 2
      }
    } catch (e) {
      Loader.hide();
      AuthController._err(
        e.message || "Authentication failed. Please try again.",
      );
    }
  }

  // ── Profile completion modal (step 2, sign-up only) ───────────────────────

  static _openProfileModal(info) {
    document.getElementById("gc-email").textContent = info.email || "";
    document.getElementById("gc-fn").value = info.given_name || "";
    document.getElementById("gc-ln").value = info.family_name || "";
    document.getElementById("gc-sid").value = (info.email || "").split("@")[0];
    document.getElementById("gc-dept").value = "";
    document.getElementById("gc-sem").value = "";
    document.getElementById("gc-err").style.display = "none";
    document.getElementById("google-complete-modal").classList.add("open");
  }

  static async completeGoogleRegister() {
    const fn = document.getElementById("gc-fn").value.trim();
    const ln = document.getElementById("gc-ln").value.trim();
    const dept = document.getElementById("gc-dept").value;
    const sem = document.getElementById("gc-sem").value;
    const sid = document.getElementById("gc-sid").value.trim();

    if (!fn || !dept || !sem) {
      AuthController._gcErr(
        "Please fill in First Name, Department, and Semester.",
      );
      return;
    }

    const btn = document.getElementById("gc-submit-btn");
    btn.disabled = true;

    try {
      Loader.show("Creating your account…");
      const u = await ApiService.registerGoogle({
        id_token: AuthController._googleToken,
        fname: fn,
        lname: ln,
        dept,
        sem,
        sid,
      });
      document.getElementById("google-complete-modal").classList.remove("open");
      await AuthController._enter(u);
    } catch (e) {
      AuthController._gcErr(
        e.message || "Registration failed. Please try again.",
      );
    } finally {
      Loader.hide();
      btn.disabled = false;
    }
  }

  static closeGoogleModal() {
    document.getElementById("google-complete-modal").classList.remove("open");
    AuthController._googleToken = null;
    AuthController._googlePayload = null;
  }

  // ── Visitor ───────────────────────────────────────────────────────────────

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
      Router.go("marketplace");
    } catch {
      AuthController._err("Visitor entry failed.");
    } finally {
      Loader.hide();
    }
  }

  static checkVisitor() {
    if (this._u && this._u.role === "visitor") {
      document.getElementById("vis-modal").classList.add("open");
      return true;
    }
    return false;
  }

  static exitVisitorToLogin() {
    document.getElementById("vis-modal")?.classList.remove("open");
    this.logout();
  }

  // ── Logout modals ─────────────────────────────────────────────────────────

  static confirmLogout() {
    AuthController._closeProfileMenu();
    document.getElementById("logout-modal").classList.add("open");
  }

  static closeLogoutModal() {
    document.getElementById("logout-modal").classList.remove("open");
  }

  // ── Profile dropdown ──────────────────────────────────────────────────────

  static toggleProfileMenu() {
    document.getElementById("profile-dd").classList.toggle("open");
  }

  static _closeProfileMenu() {
    document.getElementById("profile-dd")?.classList.remove("open");
  }

  static goProfile(startEditing = false) {
    AuthController._closeProfileMenu();
    if (startEditing) ProfileController.requestOpenInEditMode();
    Router.go("profile");
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  static logout() {
    AuthController.closeLogoutModal();
    AuthController._u = null;
    AuthController._googleToken = null;
    AuthController._googlePayload = null;
    localStorage.removeItem("ewumart_session");
    document.getElementById("app").classList.remove("visible");
    document.getElementById("auth-screen").style.display = "flex";

    // Reset to login tab for next visit
    const loginTab = document.querySelectorAll(".auth-tab")[0];
    if (loginTab) AuthController.switchTab("login", loginTab);

    // Disable Google auto-select so user must actively pick an account
    try {
      google.accounts.id.disableAutoSelect();
    } catch {}
  }

  // ── Private ───────────────────────────────────────────────────────────────

  static async _enter(u) {
    AuthController._u = u;
    Loader.show("Loading your data…");
    await db.init(u.id);
    Loader.hide();

    localStorage.setItem("ewumart_session", JSON.stringify(u));

    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app").classList.add("visible");

    Avatar.apply(
      document.getElementById("nav-av"),
      u.id,
      u.fname[0] + (u.lname ? u.lname[0] : ""),
    );
    document
      .getElementById("sb-admin-sec")
      .classList.toggle("hidden", u.role !== "admin");
    document.body.classList.toggle("is-admin", u.role === "admin");

    if (!AuthController._outsideClickBound) {
      AuthController._outsideClickBound = true;
      document.addEventListener("click", (e) => {
        const wrap = document.getElementById("profile-dd-wrap");
        if (wrap && !wrap.contains(e.target))
          AuthController._closeProfileMenu();
      });
    }

    Badge.update();
    NotifController.updateDot();
    Router.go("dashboard");
    Toast.show(`Welcome, ${u.fname}! 👋`);
  }

  static _err(msg) {
    const el = document.getElementById("auth-err");
    el.textContent = msg;
    el.style.display = "block";
  }

  static _gcErr(msg) {
    const el = document.getElementById("gc-err");
    el.textContent = msg;
    el.style.display = "block";
  }

  /** Restore session from localStorage on page load. */
  static async tryRestore() {
    const raw = localStorage.getItem("ewumart_session");
    if (!raw) return false;
    try {
      const u = JSON.parse(raw);
      if (!u || !u.id) return false;
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
