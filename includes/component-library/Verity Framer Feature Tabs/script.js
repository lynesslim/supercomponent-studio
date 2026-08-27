(function () {
  "use strict";

  window.supercomponentCleanups =
    window.supercomponentCleanups || {};

  var cleanupKey = String(instanceId);

  if (window.supercomponentCleanups[cleanupKey]) {
    window.supercomponentCleanups[cleanupKey]();
  }

  var root = null;
  var tabs = [];
  var dashboards = [];
  var clickHandlers = [];
  var updateHandler = null;

  function getWrapper() {
    return (
      document.querySelector(
        '[data-instance-id="' + instanceId + '"]'
      ) ||
      document.querySelector(
        ".elementor-element-" + instanceId
      )
    );
  }

  function findDashboard(id) {
    if (!root) return null;

    var all = root.querySelectorAll(".vt-dashboard");

    for (var i = 0; i < all.length; i++) {
      if (
        String(all[i].getAttribute("data-dashboard")) ===
        String(id)
      ) {
        return all[i];
      }
    }

    return null;
  }

  function activateTab(index, immediate) {
    if (!root || !tabs.length) return;

    var selectedTab = tabs[index];

    if (!selectedTab) return;

    for (var i = 0; i < tabs.length; i++) {
      var isActive = i === index;

      tabs[i].classList.toggle(
        "active",
        isActive
      );

      tabs[i].setAttribute(
        "aria-selected",
        isActive ? "true" : "false"
      );
    }

    for (var j = 0; j < dashboards.length; j++) {
      dashboards[j].classList.remove("active");

      dashboards[j].setAttribute(
        "aria-hidden",
        "true"
      );
    }

    var dashboardId =
      selectedTab.getAttribute("data-tab");

    var selectedDashboard =
      findDashboard(dashboardId);

    if (!selectedDashboard) return;

    function showDashboard() {
      selectedDashboard.classList.add("active");

      selectedDashboard.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    if (immediate) {
      showDashboard();
    } else {
      requestAnimationFrame(showDashboard);
    }
  }

  function init() {
    var wrapper = getWrapper();

    if (!wrapper) return;

    root =
      wrapper.querySelector(".verity-tabs");

    if (!root) return;

    tabs = Array.prototype.slice.call(
      root.querySelectorAll(".vt-item")
    );

    dashboards = Array.prototype.slice.call(
      root.querySelectorAll(".vt-dashboard")
    );

    if (!tabs.length) return;

    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove("active");

      tabs[i].setAttribute(
        "aria-selected",
        "false"
      );
    }

    for (var j = 0; j < dashboards.length; j++) {
      dashboards[j].classList.remove("active");

      dashboards[j].setAttribute(
        "aria-hidden",
        "true"
      );
    }

    clickHandlers = [];

    tabs.forEach(function (tab, index) {
      var handler = function () {
        activateTab(index, false);
      };

      tab.addEventListener(
        "click",
        handler
      );

      clickHandlers.push({
        element: tab,
        handler: handler
      });
    });

    /*
     * Original design starts on tab 01.
     */
    activateTab(0, true);
  }

  function cleanup() {
    clickHandlers.forEach(function (item) {
      item.element.removeEventListener(
        "click",
        item.handler
      );
    });

    clickHandlers = [];

    if (updateHandler) {
      window.removeEventListener(
        "supercomponent:update",
        updateHandler
      );
    }

    root = null;
    tabs = [];
    dashboards = [];
    updateHandler = null;
  }

  window.supercomponentCleanups[cleanupKey] =
    cleanup;

  updateHandler = function (event) {
    if (
      event &&
      event.detail &&
      String(event.detail.instanceId) ===
        cleanupKey
    ) {
      /*
       * Do not call cleanup() here because cleanup()
       * also removes this update listener.
       */
      clickHandlers.forEach(function (item) {
        item.element.removeEventListener(
          "click",
          item.handler
        );
      });

      clickHandlers = [];

      root = null;
      tabs = [];
      dashboards = [];

      requestAnimationFrame(function () {
        init();
      });
    }
  };

  window.addEventListener(
    "supercomponent:update",
    updateHandler
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
