(function () {
  "use strict";

  // 1. Memory leak prevention: Clean up previous instance running under this instanceId
  window.supercomponentCleanups = window.supercomponentCleanups || {};
  var currentInstanceId = typeof instanceId !== "undefined" ? String(instanceId) : "default";

  if (window.supercomponentCleanups[currentInstanceId]) {
    window.supercomponentCleanups[currentInstanceId]();
  }

  var frame = 0;
  var lastTime = 0;
  var current = null;
  var height = 1;
  var observer = null;
  var motion = null;
  var root = null;
  var wake = null;
  var measure = null;
  var paint = null;
  var tick = null;
  var cleanup = null;
  var updateHandler = null;

  function init() {
    var container = (
      (typeof instanceId !== "undefined" && (
        document.querySelector('[data-instance-id="' + currentInstanceId + '"]') ||
        document.querySelector(".elementor-element-" + currentInstanceId)
      )) ||
      document.querySelector("[data-push-timeline]")
    );

    if (!container) return;

    root = container.matches("[data-push-timeline]") ? container : container.querySelector("[data-push-timeline]");
    if (!root) return;

    var triggerAttr = root.getAttribute("data-trigger");
    var smoothingAttr = root.getAttribute("data-smoothing");
    var offsetAttr = root.getAttribute("data-start-offset");

    var settings = {
      trigger: triggerAttr ? parseFloat(triggerAttr) / 100 : 0.65,
      smoothing: smoothingAttr ? parseFloat(smoothingAttr) / 100 : 0.12,
      startOffset: offsetAttr ? parseFloat(offsetAttr) : 40
    };

    var body = root.querySelector(".push-timeline__body");
    var fill = root.querySelector(".push-timeline__fill");
    if (!body || !fill) return;

    motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    var steps = Array.prototype.slice.call(
      root.querySelectorAll(".push-timeline__step")
    ).map(function (element) {
      return {
        element: element,
        content: element.querySelector(".push-timeline__content"),
        dot: element.querySelector(".push-timeline__dot")
      };
    }).filter(function (step) {
      return step.content && step.dot;
    });

    if (!steps.length) return;

    var clamp = function (value, min, max) {
      return Math.max(min, Math.min(value, max));
    };

    measure = function () {
      if (!root || !root.isConnected) return;
      height = Math.max(1, body.offsetHeight);

      steps.forEach(function (step) {
        var dotSize = step.dot.offsetHeight;
        step.top = step.element.offsetTop;
        step.start = step.top + settings.startOffset;
        step.end = Math.max(
          step.start,
          step.top + step.content.offsetHeight - dotSize / 2
        );
        step.radius = dotSize / 2;
      });

      wake();
    };

    paint = function (position) {
      if (!fill) return;
      fill.style.transform = "scaleY(" + (position / height) + ")";

      steps.forEach(function (step) {
        var center = motion.matches
          ? step.end
          : clamp(position, step.start, step.end);

        step.dot.style.setProperty(
          "--dot-y",
          (center - step.top - step.radius) + "px"
        );

        var reached = position >= step.start;
        var complete = position >= step.end;

        step.dot.classList.toggle("is-active", reached && !complete);
        step.dot.classList.toggle("is-complete", complete);

        var reveal = clamp((position - step.start + 110) / 180, 0, 1);

        step.content.style.setProperty(
          "--reveal",
          (0.16 + reveal * 0.84).toFixed(3)
        );

        step.content.style.setProperty(
          "--lift",
          ((1 - reveal) * 18).toFixed(2) + "px"
        );
      });
    };

    tick = function (time) {
      frame = 0;

      if (!root || !root.isConnected) {
        if (cleanup) cleanup();
        return;
      }

      var target = clamp(
        window.innerHeight * settings.trigger - body.getBoundingClientRect().top,
        0,
        height
      );

      var elapsed = lastTime ? Math.min(time - lastTime, 64) : 16.67;
      lastTime = time;

      var ease = 1 - Math.pow(1 - settings.smoothing, elapsed / 16.67);

      if (current === null || motion.matches) {
        current = target;
      } else {
        current += (target - current) * ease;
      }

      var moving = Math.abs(target - current) > 0.1;
      if (!moving) current = target;

      paint(current);

      if (moving) {
        frame = requestAnimationFrame(tick);
      } else {
        lastTime = 0;
      }
    };

    wake = function () {
      if (!frame) {
        frame = requestAnimationFrame(tick);
      }
    };

    if (window.ResizeObserver) {
      observer = new ResizeObserver(measure);
      observer.observe(body);
      steps.forEach(function (step) {
        observer.observe(step.content);
      });
    }

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    if (motion.addEventListener) {
      motion.addEventListener("change", wake);
    } else if (motion.addListener) {
      motion.addListener(wake);
    }

    root.classList.add("is-enhanced");
    measure();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (root && root.isConnected && measure) measure();
      });
    }
  }

  cleanup = function () {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (wake) {
      window.removeEventListener("scroll", wake);
    }
    if (measure) {
      window.removeEventListener("resize", measure);
    }
    if (motion) {
      if (motion.removeEventListener) {
        motion.removeEventListener("change", wake);
      } else if (motion.removeListener) {
        motion.removeListener(wake);
      }
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (updateHandler) {
      window.removeEventListener("supercomponent:update", updateHandler);
      if (window.parent && window.parent !== window) {
        try {
          window.parent.removeEventListener("supercomponent:update", updateHandler);
        } catch (e) {}
      }
      updateHandler = null;
    }
    if (root) {
      root.classList.remove("is-enhanced");
      root = null;
    }
  };

  // Register cleanup for this instance
  window.supercomponentCleanups[currentInstanceId] = cleanup;

  // Listen for live Elementor editor updates
  updateHandler = function (e) {
    if (!e || !e.detail) return;
    if (String(e.detail.instanceId) === currentInstanceId || !currentInstanceId) {
      if (cleanup) cleanup();
      requestAnimationFrame(function () {
        init();
      });
    }
  };

  window.addEventListener("supercomponent:update", updateHandler);
  if (window.parent && window.parent !== window) {
    try {
      window.parent.addEventListener("supercomponent:update", updateHandler);
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
