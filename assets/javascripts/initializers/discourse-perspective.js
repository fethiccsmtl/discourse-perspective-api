import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { withPluginApi } from "discourse/lib/plugin-api";
import { i18n } from "discourse-i18n";

function initialize(api) {
  api.modifyClass("service:composer", {
    pluginId: "discourse-perspective-api",

    dialog: service(),
    siteSettings: service(),

    save(force) {

      if (this.disableSubmit) {
        return;
      }

      const originalSave = this._super.bind(this);

      const perspectiveEnabled = this.siteSettings.perspective_enabled;
      const perspectiveNotifyUser =
        this.siteSettings.perspective_notify_posting_min_toxicity_enable;

      if (perspectiveEnabled && perspectiveNotifyUser) {
        const isPM = this.get("topic.isPrivateMessage");
        const checkPM = this.siteSettings.perspective_check_private_message;

        const isSecureCategory = this.get("model.category.read_restricted");
        const checkSecureCategories =
          this.siteSettings.perspective_check_secured_categories;

        const check =
          !isPM || checkPM || !isSecureCategory || checkSecureCategories;

        if (check) {
          this.set("disableSubmit", true);

          const concat = ["title", "raw", "reply"]
            .map((item) => this.model.get(item))
            .filter(Boolean)
            .join(" ")
            .trim();

          return ajax("/perspective/post_toxicity", {
            type: "POST",
            data: { concat },
          })
            .then((response) => {
              if (response && response["score"] !== undefined) {
                this.dialog.confirm({
                  message: i18n("perspective.perspective_message"),
                  confirmButtonLabel: "perspective.composer_edit",
                  confirmButtonClass: "btn-primary perspective-edit-post",
                  cancelButtonLabel: "perspective.composer_continue",
                  cancelButtonClass: "perspective-continue-post",
                  didConfirm: () => {
                    if (this.isDestroying || this.isDestroyed) {
                      return;
                    }
                    this.set("disableSubmit", false);
                  },
                  didCancel: () => {
                    this.set("disableSubmit", false);
                    originalSave(force);
                  },
                });
              } else {
                this.set("disableSubmit", false);
                originalSave(force);
              }
            })
            .catch(() => {
              // fail silently
              this.set("disableSubmit", false);
              originalSave(force);
            });
        }
      }

      return this._super(force);
    },

  });
}

export default {
  name: "discourse-perspective-api",

  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");
    if (
      siteSettings.perspective_enabled &&
      siteSettings.perspective_notify_posting_min_toxicity_enable
    ) {
      withPluginApi("0.8.17", initialize);
    }
  },
};
