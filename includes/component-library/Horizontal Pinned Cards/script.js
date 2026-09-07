(function() {
  // 1. Memory leak prevention: Clean up previous instance running under this instanceId
  if (typeof instanceId !== 'undefined' && window.supercomponentCleanups && window.supercomponentCleanups[instanceId]) {
    window.supercomponentCleanups[instanceId]();
  }

  const currentInstanceId = typeof instanceId !== 'undefined' ? instanceId : 'default';
  let draggableInstance = null;
  let resizeHandler = null;
  let wheelHandler = null;
  let clickCaptureHandler = null;
  let wheelTween = null;

  function loadDependencies(callback) {
    if (window.gsap && window.Draggable) {
      callback();
      return;
    }

    const loadScript = (src, check) => new Promise((resolve) => {
      if (check()) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', () => !!window.gsap)
      .then(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Draggable.min.js', () => !!(window.gsap && window.Draggable)))
      .then(() => callback());
  }

  function init(passedSettings) {
    const container = document.querySelector(`[data-instance-id="${currentInstanceId}"]`) ||
                      document.querySelector(`#supercomponent-${currentInstanceId}`) ||
                      document.querySelector(`.elementor-element-${currentInstanceId}`) ||
                      document.querySelector('.el-hs-wrapper') ||
                      document.querySelector('#elHsWrapper');
    if (!container) return;

    let settings = passedSettings || {};
    if (!passedSettings) {
      try {
        const rawSettings = container.getAttribute('data-settings');
        if (rawSettings) settings = JSON.parse(rawSettings);
      } catch (e) {
        console.warn('SuperComponent: Failed to parse settings', e);
      }
    }

    if (!window.gsap || !window.Draggable) return;
    gsap.registerPlugin(Draggable);

    const stage = container.querySelector('.el-hs-pin-stage');
    const track = container.querySelector('.el-hs-track');
    if (!stage || !track) return;

    // Clean up any existing Draggable instance
    if (draggableInstance) {
      draggableInstance.kill();
      draggableInstance = null;
    }

    function getMinX() {
      const diff = track.scrollWidth - stage.clientWidth;
      return diff > 0 ? -diff : 0;
    }

    const resistance = (settings.edge_resistance && typeof settings.edge_resistance.size !== 'undefined')
      ? settings.edge_resistance.size
      : (typeof settings.edge_resistance === 'number' ? settings.edge_resistance : 0.65);

    let hasDragged = false;
    let pointerStartX = 0;

    // Create GSAP Draggable instance
    const draggables = Draggable.create(track, {
      type: 'x',
      bounds: {
        minX: getMinX(),
        maxX: 0
      },
      edgeResistance: resistance,
      dragClickables: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      zIndexBoost: false,
      onPress: function() {
        stage.classList.add('is-dragging');
        hasDragged = false;
        pointerStartX = this.pointerX;
      },
      onDrag: function() {
        if (Math.abs(this.pointerX - pointerStartX) > 5) {
          hasDragged = true;
        }
      },
      onRelease: function() {
        stage.classList.remove('is-dragging');
        const minX = getMinX();
        const currentX = gsap.getProperty(track, 'x') || 0;
        if (currentX > 0) {
          gsap.to(track, { x: 0, duration: 0.4, ease: 'power2.out' });
        } else if (currentX < minX) {
          gsap.to(track, { x: minX, duration: 0.4, ease: 'power2.out' });
        }
      }
    });

    draggableInstance = draggables && draggables.length ? draggables[0] : null;

    // Suppress clicks on child links if user was dragging
    clickCaptureHandler = function(e) {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasDragged = false;
      }
    };
    track.addEventListener('click', clickCaptureHandler, true);

    // Mouse wheel horizontal scrolling
    if (settings.enable_mousewheel !== 'no') {
      wheelHandler = function(e) {
        const minX = getMinX();
        if (minX >= 0) return;

        const currentX = gsap.getProperty(track, 'x') || 0;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(delta) < 2) return;

        const targetX = Math.max(minX, Math.min(0, currentX - delta * 1.5));
        if (targetX !== currentX) {
          e.preventDefault();
          if (wheelTween) wheelTween.kill();
          wheelTween = gsap.to(track, {
            x: targetX,
            duration: 0.35,
            ease: 'power2.out',
            overwrite: 'auto',
            onUpdate: function() {
              if (draggableInstance) draggableInstance.update();
            }
          });
        }
      };
      stage.addEventListener('wheel', wheelHandler, { passive: false });
    }

    // Window resize handler to recalculate bounds
    resizeHandler = function() {
      if (!draggableInstance) return;
      const minX = getMinX();
      draggableInstance.applyBounds({
        minX: minX,
        maxX: 0
      });
      const currentX = gsap.getProperty(track, 'x') || 0;
      if (currentX < minX) {
        gsap.to(track, { x: minX, duration: 0.25, ease: 'power2.out' });
      }
    };
    window.addEventListener('resize', resizeHandler);

    // Delayed bounds recalculation after fonts/images settle
    setTimeout(resizeHandler, 200);
    setTimeout(resizeHandler, 800);
    setTimeout(resizeHandler, 1600);
  }

  // Cleanup handler for live re-renders
  window.supercomponentCleanups = window.supercomponentCleanups || {};
  window.supercomponentCleanups[currentInstanceId] = function() {
    if (wheelTween) {
      wheelTween.kill();
      wheelTween = null;
    }
    if (draggableInstance) {
      draggableInstance.kill();
      draggableInstance = null;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    const container = document.querySelector(`[data-instance-id="${currentInstanceId}"]`) ||
                      document.querySelector(`#supercomponent-${currentInstanceId}`);
    if (container) {
      const stage = container.querySelector('.el-hs-pin-stage');
      const track = container.querySelector('.el-hs-track');
      if (stage && wheelHandler) stage.removeEventListener('wheel', wheelHandler);
      if (track && clickCaptureHandler) track.removeEventListener('click', clickCaptureHandler, true);
    }
  };

  // Listen for live Elementor editor setting updates
  function handleUpdate(e) {
    if (e.detail && (e.detail.instanceId === currentInstanceId || !currentInstanceId)) {
      if (window.supercomponentCleanups && window.supercomponentCleanups[currentInstanceId]) {
        window.supercomponentCleanups[currentInstanceId]();
      }
      loadDependencies(function() {
        init(e.detail.settings);
      });
    }
  }

  window.addEventListener('supercomponent:update', handleUpdate);
  if (window.parent && window.parent !== window) {
    try {
      window.parent.addEventListener('supercomponent:update', handleUpdate);
    } catch (err) {}
  }

  loadDependencies(init);
})();
