"use strict";

/**
 * DeleteModal — reusable delete-confirmation modal.
 * Usage:
 *   DeleteModal.open(id, callback)  — opens modal for given post id
 *   DeleteModal.confirm()           — called by the "Yes, Delete" button
 *   DeleteModal.close()             — called by the "Cancel" button
 */
const DeleteModal = {
  _id: null,
  _callback: null,

  /** Open the modal, storing which post and what to do on confirm. */
  open(id, callback) {
    DeleteModal._id = id;
    DeleteModal._callback = callback;
    document.getElementById("delete-post-modal").classList.add("open");
  },

  /** Execute the stored callback then close. */
  async confirm() {
    DeleteModal.close();
    if (DeleteModal._callback) {
      await DeleteModal._callback(DeleteModal._id);
    }
  },

  /** Close without doing anything. */
  close() {
    document.getElementById("delete-post-modal").classList.remove("open");
  },
};

const DeleteUserModal = {
  _id: null,
  _callback: null,

  open(id, callback) {
    DeleteUserModal._id = id;
    DeleteUserModal._callback = callback;
    document.getElementById("delete-user-modal").classList.add("open");
  },

  async confirm() {
    DeleteUserModal.close();
    if (DeleteUserModal._callback) {
      await DeleteUserModal._callback(DeleteUserModal._id);
    }
  },

  close() {
    document.getElementById("delete-user-modal").classList.remove("open");
  },
};
