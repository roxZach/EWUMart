"use strict";

/**
 * ProfileController — profile view + edit form (async save).
 */
class ProfileController {
  static _isEditing = false;
  static _initialFormState = null;
  static _openInEditMode = false;

  static requestOpenInEditMode() {
    ProfileController._openInEditMode = true;
  }

  static render() {
    const u = AuthController.user;
    const init = u.fname[0] + (u.lname ? u.lname[0] : "");

    Avatar.apply(document.getElementById("pfl-av"), u.id, init);

    // Show/hide the Remove photo button
    const removeBtn = document.getElementById("pfl-av-remove");
    if (removeBtn) removeBtn.style.display = Avatar.get(u.id) ? "" : "none";
    document.getElementById("pfl-name").textContent = u.fname + " " + u.lname;
    document.getElementById("pfl-id").textContent = u.sid || "";
    document.getElementById("pfl-dept").textContent = u.dept;
    document.getElementById("pfl-sem").textContent = u.sem;
    document.getElementById("pfl-email").textContent = u.email;

    document.getElementById("e-fn").value = u.fname;
    document.getElementById("e-ln").value = u.lname || "";
    document.getElementById("e-em").value = u.email;
    document.getElementById("e-dept").value = u.dept;
    document.getElementById("e-sem").value = u.sem;
    document.getElementById("e-bio").value = u.bio || "";
    document.getElementById("e-cp").value = "";
    document.getElementById("e-np").value = "";
    document.getElementById("e-cf").value = "";

    ProfileController._initialFormState = ProfileController._captureFormState();
    ProfileController._setEditMode(ProfileController._openInEditMode);
    ProfileController._openInEditMode = false;
    ProfileController._updateRatingDisplay();
    ProfileController._renderReviews(u.id);
  }

  static _captureFormState() {
    return {
      fn: document.getElementById("e-fn").value,
      ln: document.getElementById("e-ln").value,
      em: document.getElementById("e-em").value,
      dept: document.getElementById("e-dept").value,
      sem: document.getElementById("e-sem").value,
      bio: document.getElementById("e-bio").value,
      cp: document.getElementById("e-cp").value,
      np: document.getElementById("e-np").value,
      cf: document.getElementById("e-cf").value,
    };
  }

  static _applyFormState(state) {
    if (!state) return;
    document.getElementById("e-fn").value = state.fn;
    document.getElementById("e-ln").value = state.ln;
    document.getElementById("e-em").value = state.em;
    document.getElementById("e-dept").value = state.dept;
    document.getElementById("e-sem").value = state.sem;
    document.getElementById("e-bio").value = state.bio;
    document.getElementById("e-cp").value = state.cp;
    document.getElementById("e-np").value = state.np;
    document.getElementById("e-cf").value = state.cf;
  }

  static _setEditMode(isEditing) {
    ProfileController._isEditing = isEditing;

    const editBtn = document.getElementById("pfl-edit-btn");
    const actionBtns = document.getElementById("pfl-edit-actions");
    if (editBtn) editBtn.classList.toggle("hidden", isEditing);
    if (actionBtns) actionBtns.classList.toggle("hidden", !isEditing);

    [
      "e-fn",
      "e-ln",
      "e-dept",
      "e-sem",
      "e-bio",
      "e-cp",
      "e-np",
      "e-cf",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = !isEditing;
    });

    // Email stays non-editable in both states.
    const email = document.getElementById("e-em");
    if (email) email.disabled = true;
  }

  static startEdit() {
    ProfileController._initialFormState = ProfileController._captureFormState();
    ProfileController._setEditMode(true);
  }

  static cancelEdit() {
    ProfileController._applyFormState(ProfileController._initialFormState);
    ProfileController._setEditMode(false);
  }

  static _clearPasswordErrors() {
    ["e-cp-err", "e-np-err", "e-cf-err"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });
  }

  static _setPasswordError(field, message) {
    const map = {
      current: "e-cp-err",
      next: "e-np-err",
      confirm: "e-cf-err",
    };
    const el = document.getElementById(map[field]);
    if (el) el.textContent = message;
  }

  static async _sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /** Save profile changes — async API update */
  static async save() {
    if (!ProfileController._isEditing) return;

    const u = AuthController.user;
    const fn = document.getElementById("e-fn").value.trim();
    const ln = document.getElementById("e-ln").value.trim();
    const dept = document.getElementById("e-dept").value;
    const sem = document.getElementById("e-sem").value;
    const bio = document.getElementById("e-bio").value.trim();
    const currentPw = document.getElementById("e-cp").value;
    const newPw = document.getElementById("e-np").value;
    const confirmPw = document.getElementById("e-cf").value;

    const wantsPasswordChange = currentPw || newPw || confirmPw;
    ProfileController._clearPasswordErrors();

    if (wantsPasswordChange) {
      let hasPasswordError = false;

      if (!currentPw) {
        ProfileController._setPasswordError(
          "current",
          "Current password is required.",
        );
        hasPasswordError = true;
      }

      if (!newPw) {
        ProfileController._setPasswordError(
          "next",
          "New password is required.",
        );
        hasPasswordError = true;
      } else if (newPw.length < 6) {
        ProfileController._setPasswordError(
          "next",
          "New password must be at least 6 characters.",
        );
        hasPasswordError = true;
      }

      if (!confirmPw) {
        ProfileController._setPasswordError(
          "confirm",
          "Please confirm your new password.",
        );
        hasPasswordError = true;
      } else if (newPw !== confirmPw) {
        ProfileController._setPasswordError(
          "confirm",
          "New password and confirm password do not match.",
        );
        hasPasswordError = true;
      }

      if (hasPasswordError) {
        Toast.show("Please fix the password errors.");
        return;
      }

      // Fast local verification to keep feedback specific even if API response is generic.
      if (u.pw) {
        const currentHash = await ProfileController._sha256(currentPw);
        if (currentHash !== u.pw) {
          ProfileController._setPasswordError(
            "current",
            "Current password does not match.",
          );
          Toast.show("Current password does not match.");
          return;
        }
      }
    }

    try {
      Loader.show("Saving...");

      const payload = {
        fname: fn,
        lname: ln,
        dept,
        sem,
        bio,
      };

      if (wantsPasswordChange) {
        payload.currentPw = currentPw;
        payload.newPw = newPw;
      }

      const saved = await db.updateUser(u.id, payload);

      if (wantsPasswordChange) {
        const newHash = await ProfileController._sha256(newPw);

        // Backward compatibility: if /users PUT didn't update password,
        // try the dedicated endpoint before failing.
        if (saved.pw !== newHash) {
          try {
            await db.updatePassword(u.id, currentPw, newPw);
            saved.pw = newHash;
          } catch {
            throw new Error(
              "We couldn't change your password right now. Please try again.",
            );
          }
        }
      }
      // Update live session reference
      Object.assign(u, saved);
      const init = fn[0] + (ln ? ln[0] : "");
      Avatar.apply(document.getElementById("nav-av"), u.id, init);
      DashController.render();
      ProfileController.render();
      Toast.show(
        wantsPasswordChange
          ? "Profile and password updated. Use your new password on next login."
          : "Profile Saved",
      );
    } catch (e) {
      const msg = e.message || "Failed to save profile!";

      if (wantsPasswordChange) {
        const lower = msg.toLowerCase();
        if (lower.includes("current password")) {
          ProfileController._setPasswordError(
            "current",
            "Current password does not match.",
          );
          Toast.show("Current password does not match.");
          return;
        }
        if (lower.includes("at least 6")) {
          ProfileController._setPasswordError(
            "next",
            "New password must be at least 6 characters.",
          );
          Toast.show("New password must be at least 6 characters.");
          return;
        }
        if (lower.includes("do not match")) {
          ProfileController._setPasswordError(
            "confirm",
            "New password and confirm password do not match.",
          );
          Toast.show("New password and confirm password do not match.");
          return;
        }
        if (lower.includes("couldn't change your password")) {
          ProfileController._setPasswordError(
            "current",
            "Password could not be changed right now. Please try again.",
          );
          Toast.show(
            "Password could not be changed right now. Please try again.",
          );
          return;
        }
      }

      Toast.show(msg);
    } finally {
      Loader.hide();
    }
  }

  /** Handle avatar file pick — compress, store, rerender everywhere */
  static saveAvatar(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Compress to max 200x200 via canvas to keep localStorage light
      const img = new Image();
      img.onload = () => {
        const MAX = 200;
        const ratio = Math.min(MAX / img.width, MAX / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        const u = AuthController.user;
        Avatar.set(u.id, dataUrl);

        // Refresh every avatar location
        const init = u.fname[0] + (u.lname ? u.lname[0] : "");
        Avatar.apply(document.getElementById("nav-av"), u.id, init);
        Avatar.apply(document.getElementById("pfl-av"), u.id, init);
        Avatar.apply(document.getElementById("dh-av"), u.id, init);

        // Update the preview ring on the profile page
        ProfileController._updateAvatarPreview(dataUrl);

        Toast.show("Profile photo updated! 🎉");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  /** Update the avatar preview overlay on the profile card. */
  static _updateAvatarPreview(dataUrl) {
    const el = document.getElementById("pfl-av");
    if (!el) return;
    const removeBtn = document.getElementById("pfl-av-remove");
    if (dataUrl) {
      el.textContent = "";
      el.style.backgroundImage = `url('${dataUrl}')`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      if (removeBtn) removeBtn.style.display = "";
    } else {
      const u = AuthController.user;
      el.style.backgroundImage = "";
      el.textContent = u.fname[0] + (u.lname ? u.lname[0] : "");
      if (removeBtn) removeBtn.style.display = "none";
    }
  }

  /** Remove the current profile photo */
  static removeAvatar() {
    const u = AuthController.user;
    Avatar.remove(u.id);
    const init = u.fname[0] + (u.lname ? u.lname[0] : "");
    Avatar.apply(document.getElementById("nav-av"), u.id, init);
    Avatar.apply(document.getElementById("pfl-av"), u.id, init);
    Avatar.apply(document.getElementById("dh-av"), u.id, init);
    ProfileController._updateAvatarPreview(null);
    Toast.show("Profile photo removed.");
  }

  static _updateRatingDisplay() {
    const el = document.getElementById("pfl-rating-display");
    if (!el) return;
    const u = AuthController.user;
    if (!u) return;
    el.innerHTML = ReviewController.statLine(u.id);
  }

  static _renderReviews(userId) {
    const el = document.getElementById("pfl-reviews");
    if (!el) return;
    const viewerUid = AuthController.user ? AuthController.user.id : 0;
    ReviewController.renderForUser(userId, el, viewerUid);
  }
}

const Profile = ProfileController;
