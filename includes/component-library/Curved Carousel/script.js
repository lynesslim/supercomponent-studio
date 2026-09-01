(function () {
  "use strict";

  // 1. Clean up any previous instance running under this instanceId
  window.supercomponentCleanups = window.supercomponentCleanups || {};
  var cleanupKey = String(instanceId);
  if (window.supercomponentCleanups[cleanupKey]) {
    window.supercomponentCleanups[cleanupKey]();
  }

  // 2. Locate container
  var container =
    document.querySelector('[data-instance-id="' + instanceId + '"]') ||
    document.querySelector('.elementor-element-' + instanceId) ||
    document.querySelector('[data-instance="' + instanceId + '"]');

  if (!container) return;

  var stage = container.querySelector(".sc-curved-carousel__stage");
  var cards = Array.prototype.slice.call(
    container.querySelectorAll(".sc-curved-carousel__card")
  );
  var prevBtn = container.querySelector(".sc-curved-carousel__nav--prev");
  var nextBtn = container.querySelector(".sc-curved-carousel__nav--next");

  if (!stage || cards.length === 0) return;

  // 3. State & Configuration
  var isDragging = false;
  var startX = 0;
  var currentX = 0;
  var lastX = 0;
  var lastTime = 0;
  var velocity = 0;
  var movedDistance = 0;
  var isClickPrevented = false;

  var currentOffset = 0;
  var targetOffset = 0;
  var animFrameId = null;
  var autoplayTimer = null;

  var cardCount = cards.length;
  var cardWidth = 290;
  var cardGap = 26;
  var spacing = 316;
  var arcCurvature = 45;
  var arcTilt = 11;
  var isInfinite = cardCount >= 3;

  function readSettings() {
    var computed = window.getComputedStyle(container);

    var rawCurvature = parseFloat(computed.getPropertyValue("--arc_curvature"));
    if (!isNaN(rawCurvature)) arcCurvature = rawCurvature;

    var rawTilt = parseFloat(computed.getPropertyValue("--arc_tilt"));
    if (!isNaN(rawTilt)) arcTilt = rawTilt;

    var rawGap = parseFloat(computed.getPropertyValue("--card_gap"));
    if (!isNaN(rawGap)) cardGap = rawGap;

    if (cards[0]) {
      cardWidth = cards[0].offsetWidth || 290;
    }
    spacing = cardWidth + cardGap;
  }

  // 4. Transform calculation per card along the convex curve
  function updateCardTransforms() {
    var totalWidth = cardCount * spacing;

    for (var i = 0; i < cardCount; i++) {
      var card = cards[i];
      var basePos = i * spacing;
      var diff = basePos - currentOffset;

      if (isInfinite) {
        // Wrap around seamlessly
        diff = ((diff % totalWidth) + totalWidth) % totalWidth;
        if (diff > totalWidth / 2) {
          diff -= totalWidth;
        }
      }

      var u = diff / spacing; // Normalized offset from center
      var absU = Math.abs(u);

      // Parabolic vertical dip (convex arch: center cards are highest, sides dip downward)
      var y = Math.pow(absU, 1.7) * arcCurvature;

      // Tangential tilt: outward fan tilt (left cards tilt counter-clockwise outward, right cards tilt clockwise outward)
      var rotZ = u * arcTilt;

      // Subtle 3D perspective rotation
      var rotY = -u * 4;

      // Subtle depth scaling
      var scale = Math.max(0.86, 1 - absU * 0.04);

      // Dynamic z-index layering
      var zIndex = Math.round(100 - absU * 10);

      // Opacity fade-out for distant off-screen cards
      var opacity = Math.max(0, 1 - Math.pow(absU / 3.4, 2));

      card.style.transform =
        "translate3d(" +
        diff.toFixed(2) +
        "px, " +
        y.toFixed(2) +
        "px, 0) rotateZ(" +
        rotZ.toFixed(2) +
        "deg) rotateY(" +
        rotY.toFixed(2) +
        "deg) scale(" +
        scale.toFixed(3) +
        ")";

      card.style.zIndex = zIndex;
      card.style.opacity = opacity.toFixed(3);

      if (absU < 0.5) {
        card.classList.add("is-active");
      } else {
        card.classList.remove("is-active");
      }
    }
  }

  // 5. Animation Loop
  function tick() {
    if (!isDragging) {
      // Smooth spring damping interpolation towards target
      var delta = targetOffset - currentOffset;
      if (Math.abs(delta) > 0.1) {
        currentOffset += delta * 0.14;
      } else {
        currentOffset = targetOffset;
      }
    }

    updateCardTransforms();
    animFrameId = requestAnimationFrame(tick);
  }

  // Snap to the nearest card
  function snapToNearest() {
    var nearestIndex = Math.round(targetOffset / spacing);
    if (!isInfinite) {
      nearestIndex = Math.max(0, Math.min(cardCount - 1, nearestIndex));
    }
    targetOffset = nearestIndex * spacing;
  }

  // 6. Pointer & Drag Interaction
  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    isDragging = true;
    isClickPrevented = false;
    movedDistance = 0;
    startX = e.clientX;
    currentX = e.clientX;
    lastX = e.clientX;
    lastTime = Date.now();
    velocity = 0;

    stage.classList.add("is-dragging");
    pauseAutoplay();

    if (stage.setPointerCapture) {
      try {
        stage.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    var x = e.clientX;
    var dx = x - currentX;
    var now = Date.now();
    var dt = now - lastTime;

    if (dt > 0) {
      velocity = (x - lastX) / dt;
    }

    lastX = x;
    lastTime = now;
    currentX = x;

    movedDistance += Math.abs(dx);
    if (movedDistance > 6) {
      isClickPrevented = true;
    }

    // Drag directly
    currentOffset -= dx;
    targetOffset = currentOffset;

    if (!isInfinite) {
      // Add rubber-band resistance at boundaries
      var minOffset = 0;
      var maxOffset = (cardCount - 1) * spacing;
      if (targetOffset < minOffset) {
        targetOffset = minOffset - (minOffset - targetOffset) * 0.3;
      } else if (targetOffset > maxOffset) {
        targetOffset = maxOffset + (targetOffset - maxOffset) * 0.3;
      }
    }
  }

  function onPointerUp(e) {
    if (!isDragging) return;

    isDragging = false;
    stage.classList.remove("is-dragging");

    if (stage.releasePointerCapture) {
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    // Apply inertia on release
    if (Math.abs(velocity) > 0.25) {
      targetOffset -= velocity * 130;
    }

    snapToNearest();
    startAutoplay();

    // Reset click prevention after brief delay
    setTimeout(function () {
      isClickPrevented = false;
    }, 50);
  }

  // 7. Click to Center Card
  function setupCardClicks() {
    cards.forEach(function (card, index) {
      card.addEventListener("click", function (e) {
        if (isClickPrevented) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        var totalWidth = cardCount * spacing;
        var basePos = index * spacing;
        var diff = basePos - currentOffset;

        if (isInfinite) {
          diff = ((diff % totalWidth) + totalWidth) % totalWidth;
          if (diff > totalWidth / 2) diff -= totalWidth;
        }

        var u = diff / spacing;
        if (Math.abs(u) >= 0.5) {
          // If clicking an off-center card, animate it to center
          e.preventDefault();
          e.stopPropagation();
          targetOffset += diff;
          snapToNearest();
        }
      });
    });
  }

  // 8. Navigation Controls (Next/Prev)
  function slideNext() {
    targetOffset += spacing;
    snapToNearest();
  }

  function slidePrev() {
    targetOffset -= spacing;
    snapToNearest();
  }

  if (prevBtn) prevBtn.addEventListener("click", slidePrev);
  if (nextBtn) nextBtn.addEventListener("click", slideNext);

  // 9. Autoplay Support
  function getAutoplayConfig() {
    var isAuto = false;
    var speed = 4000;

    // 1. Try reading data-settings JSON on container
    try {
      var rawSettings = container.getAttribute("data-settings");
      if (rawSettings) {
        var parsed = JSON.parse(rawSettings);
        if (parsed.autoplay === "yes" || parsed.autoplay === true || parsed.autoplay === "true") {
          isAuto = true;
        }
        if (parsed.autoplay_speed) {
          if (typeof parsed.autoplay_speed === "object" && parsed.autoplay_speed.size) {
            speed = parseInt(parsed.autoplay_speed.size, 10);
          } else if (!isNaN(parseInt(parsed.autoplay_speed, 10))) {
            speed = parseInt(parsed.autoplay_speed, 10);
          }
        }
      }
    } catch (e) {}

    // 2. Fallback to HTML data attributes (from template.html or container)
    var innerWrap = container.querySelector(".sc-curved-carousel-wrap") || container;
    var attrAuto = innerWrap.getAttribute("data-autoplay") || container.getAttribute("data-autoplay");
    if (attrAuto === "yes" || attrAuto === "true") {
      isAuto = true;
    }
    var attrSpeed = innerWrap.getAttribute("data-autoplay-speed") || container.getAttribute("data-autoplay-speed");
    if (attrSpeed && !isNaN(parseInt(attrSpeed, 10))) {
      speed = parseInt(attrSpeed, 10);
    }

    return { enabled: isAuto, speed: speed || 4000 };
  }

  function startAutoplay() {
    pauseAutoplay();
    var config = getAutoplayConfig();
    if (config.enabled) {
      autoplayTimer = setInterval(function () {
        slideNext();
      }, config.speed);
    }
  }

  function pauseAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  stage.addEventListener("mouseenter", pauseAutoplay);
  stage.addEventListener("mouseleave", startAutoplay);

  // 10. Resize Observer
  var onResize = function () {
    readSettings();
    updateCardTransforms();
  };
  window.addEventListener("resize", onResize);

  // Bind pointer events
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);

  // Prevent default image drag
  stage.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });

  // 11. Initial Setup
  readSettings();
  setupCardClicks();
  snapToNearest();
  currentOffset = targetOffset;
  tick();
  startAutoplay();

  // 12. Register cleanup for live Elementor rebuilds
  window.supercomponentCleanups[cleanupKey] = function () {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (autoplayTimer) clearInterval(autoplayTimer);

    window.removeEventListener("resize", onResize);
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerup", onPointerUp);
    stage.removeEventListener("pointercancel", onPointerUp);
    stage.removeEventListener("mouseenter", pauseAutoplay);
    stage.removeEventListener("mouseleave", startAutoplay);

    if (prevBtn) prevBtn.removeEventListener("click", slidePrev);
    if (nextBtn) nextBtn.removeEventListener("click", slideNext);
  };
})();
