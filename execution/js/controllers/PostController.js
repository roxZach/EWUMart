"use strict";

/**
 * PostController — create & edit post form (async submit).
 * Product images are stored in localStorage via MarketController.saveImage().
 */
class PostController {
  static _editId = null;
  static _type = "Sell";
  static _pendingImage = null; // base64 data-URL for newly selected photo

  static _EM = {
    Textbooks: "📚",
    "Lab Supplies": "🔬",
    "Notes & Reports": "📓",
    Electronics: "💻",
    Stationery: "✏️",
    Other: "📦",
  };

  static selectType(type, el) {
    PostController._type = type;
    document.querySelectorAll(".pt-opt").forEach((e) => e.classList.remove("sel"));
    el.classList.add("sel");
  }

  static initForm() {
    PostController._editId
      ? PostController._loadEdit(PostController._editId)
      : PostController._reset();
    PostController._wireImageInput();
  }

  static edit(id) {
    PostController._editId = id;
    Router.go("create-post");
  }

  /** Wire up the photo file input to preview and store the image */
  static _wireImageInput() {
    PostController._pendingImage = null;
    const inp = document.getElementById("p-img");
    if (!inp) return;

    // Clone to remove any old listeners
    const fresh = inp.cloneNode(true);
    inp.parentNode.replaceChild(fresh, inp);

    fresh.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        Toast.show("Image must be under 5 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        PostController._pendingImage = ev.target.result;
        PostController._showPreview(ev.target.result);
      };
      reader.readAsDataURL(file);
    });

    // If editing and product already has an image, show it
    if (PostController._editId) {
      const existing = MarketController.getImage(PostController._editId);
      if (existing) PostController._showPreview(existing);
    }
  }

  static _showPreview(dataUrl) {
    const area = document.querySelector(".upload-area");
    if (!area) return;
    area.style.backgroundImage = `url('${dataUrl}')`;
    area.style.backgroundSize = "cover";
    area.style.backgroundPosition = "center";
    area.style.minHeight = "140px";
    area.innerHTML = `
      <button type="button" onclick="PostController._clearImage(event)"
        style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;
               border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px">
        ✕ Remove
      </button>
      <input type="file" id="p-img" class="hidden" accept="image/*">`;
    // Re-wire new input
    document.getElementById("p-img").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        PostController._pendingImage = ev.target.result;
        PostController._showPreview(ev.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  static _clearImage(ev) {
    ev.stopPropagation();
    PostController._pendingImage = null;
    if (PostController._editId) MarketController.removeImage(PostController._editId);
    const area = document.querySelector(".upload-area");
    if (!area) return;
    area.style.backgroundImage = "";
    area.style.minHeight = "";
    area.innerHTML = `
      <div style="font-size:30px;margin-bottom:8px"><i class="ph-bold ph-camera"></i></div>
      <div style="font-size:14px;color:var(--text2)">Click to upload photo</div>
      <div style="font-size:12px;color:var(--text3);margin-top:3px">JPG, PNG up to 5MB</div>
      <input type="file" id="p-img" class="hidden" accept="image/*">`;
    document.getElementById("p-img").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        PostController._pendingImage = ev.target.result;
        PostController._showPreview(ev.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  /** Submit create or update — async API call */
  static async submit() {
    const title  = document.getElementById("p-title").value.trim();
    const course = document.getElementById("p-course").value.trim();
    const price  = parseFloat(document.getElementById("p-price").value);
    const cat    = document.getElementById("p-cat").value;
    const desc   = document.getElementById("p-desc").value.trim();
    const cond   = document.getElementById("p-cond").value;

    if (!title || !course || !price) {
      Toast.show("Please fill all required fields.");
      return;
    }

    // Use emoji only when no photo is selected
    const em = PostController._EM[cat] || "📦";

    try {
      Loader.show("Saving…");
      let savedId;

      if (PostController._editId) {
        const existing = db.prod(PostController._editId);
        await db.updateProduct(PostController._editId, {
          ...existing,
          title, course, price, cat, desc, cond,
          type: PostController._type,
          em,
        });
        savedId = PostController._editId;
        Toast.show("Post updated! ✅");
      } else {
        const saved = await db.addProduct({
          sid: AuthController.user.id,
          title, course, cat, price,
          type: PostController._type,
          cond, desc, em,
        });
        savedId = saved.id;
        Toast.show("Post published! 🎉");
      }

      // Persist the selected image (if any) after we have the product ID
      if (PostController._pendingImage && savedId) {
        MarketController.saveImage(savedId, PostController._pendingImage);
      }

      PostController._editId = null;
      PostController._pendingImage = null;
      Router.go("my-posts");
    } catch (e) {
      Toast.show("Failed to save post.");
    } finally {
      Loader.hide();
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  static _reset() {
    PostController._editId = null;
    PostController._pendingImage = null;
    PostController._type = "Sell";
    document.getElementById("cp-title").textContent = "Create New Post";
    document.getElementById("cp-btn").textContent = "Publish Post";
    ["p-title", "p-course", "p-price", "p-desc"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
    document.getElementById("p-cat").value = "Textbooks";
    document.getElementById("p-cond").value = "Good";
    document.querySelectorAll(".pt-opt").forEach((el, i) => el.classList.toggle("sel", i === 0));

    // Reset upload area to default state
    const area = document.querySelector(".upload-area");
    if (area) {
      area.style.backgroundImage = "";
      area.style.minHeight = "";
      area.innerHTML = `
        <div style="font-size:30px;margin-bottom:8px"><i class="ph-bold ph-camera"></i></div>
        <div style="font-size:14px;color:var(--text2)">Click to upload photo</div>
        <div style="font-size:12px;color:var(--text3);margin-top:3px">JPG, PNG up to 5MB</div>
        <input type="file" id="p-img" class="hidden" accept="image/*">`;
    }
  }

  static _loadEdit(id) {
    const p = db.prod(id);
    if (!p) return;
    document.getElementById("cp-title").textContent = "Edit Post";
    document.getElementById("cp-btn").textContent   = "Save Changes";
    document.getElementById("p-title").value  = p.title;
    document.getElementById("p-course").value = p.course;
    document.getElementById("p-cat").value    = p.cat;
    document.getElementById("p-price").value  = p.price;
    document.getElementById("p-desc").value   = p.desc;
    document.getElementById("p-cond").value   = p.cond;
    PostController._type = p.type;
    document.querySelectorAll(".pt-opt").forEach((el, i) =>
      el.classList.toggle("sel", (i === 0 && p.type === "Sell") || (i === 1 && p.type === "Want")),
    );
  }
}

const Post = PostController;
