(function() {
  // 1. Memory leak prevention: Clean up previous instance running under this instanceId
  if (typeof instanceId !== 'undefined' && window.supercomponentCleanups && window.supercomponentCleanups[instanceId]) {
    window.supercomponentCleanups[instanceId]();
  }

  const currentInstanceId = typeof instanceId !== 'undefined' ? instanceId : 'default';
  let scrollTriggerInstance = null;
  let animationTimeline = null;

  function loadGSAP(callback) {
    if (window.gsap && window.ScrollTrigger) {
      callback();
      return;
    }

    const loadScript = (src, check) => new Promise((resolve) => {
      if (check()) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

    loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', () => !!window.gsap)
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js', () => !!window.ScrollTrigger))
      .then(() => callback());
  }

  function init(passedSettings) {
    const container = document.querySelector(`[data-instance-id="${currentInstanceId}"]`) ||
                      document.querySelector(`#supercomponent-${currentInstanceId}`) ||
                      document.querySelector(`.elementor-element-${currentInstanceId}`) ||
                      document.querySelector('.dial-demo-wrapper') ||
                      document.querySelector('#circularDialDemo');
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

    const defaultStages = [
      {
        number: '01',
        title: 'Brand Identity & Strategy',
        body: 'We build meaningful brand identities — from strategic positioning to visual systems that bring your brand to life.',
        tags: 'Positioning, Visual Identity, Design System',
        link: { url: '', is_external: false },
        bg_image: { url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1600&auto=format&fit=crop' }
      },
      {
        number: '02',
        title: 'Precision shaping',
        body: 'Each component is formed with controlled tolerances to preserve the intended geometry.',
        tags: 'Tooling, Tolerances, Form',
        link: { url: '', is_external: false },
        bg_image: { url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?q=80&w=1600&auto=format&fit=crop' }
      },
      {
        number: '03',
        title: 'Surface refinement',
        body: 'Textures and finishes are developed to create depth, grip and a distinctive visual rhythm.',
        tags: 'Textures, Finishes, Ergonomics',
        link: { url: '', is_external: false },
        bg_image: { url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1600&auto=format&fit=crop' }
      },
      {
        number: '04',
        title: 'System assembly',
        body: 'Individual parts are aligned and assembled into one coherent, high-performance structure.',
        tags: 'Architecture, Integration, Performance',
        link: { url: '', is_external: false },
        bg_image: { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1600&auto=format&fit=crop' }
      },
      {
        number: '05',
        title: 'Final validation',
        body: 'The complete product is tested, adjusted and approved before it reaches its final form.',
        tags: 'Validation, Quality Assurance, Launch',
        link: { url: '', is_external: false },
        bg_image: { url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=1600&auto=format&fit=crop' }
      }
    ];

    const stages = (settings.stages && Array.isArray(settings.stages) && settings.stages.length > 0)
      ? settings.stages
      : defaultStages;

    gsap.registerPlugin(ScrollTrigger);

    const stage = container.querySelector('.dial-stage');
    const dot = container.querySelector('.dial__dot');
    const labelsWrap = container.querySelector('.dial__labels');
    const title = container.querySelector('.dial-content__title');
    const body = container.querySelector('.dial-content__body');
    const tagsContainer = container.querySelector('.dial-content__tags');
    const actionContainer = container.querySelector('.dial-content__action');
    const counterCurrent = container.querySelector('.dial-content__counter .current');
    const counterTotal = container.querySelector('.dial-content__counter .total');
    const counterSeparator = container.querySelector('.dial-content__counter .separator');
    const stageLayersWrap = container.querySelector('.dial-bg-stage-layers');
    const fixedBg = container.querySelector('.dial-bg--fixed');

    if (!stage || !labelsWrap) return;

    // Background mode sync
    const bgMode = settings.bg_mode || (settings.show_bg_image === 'yes' ? 'fixed' : 'dynamic');
    container.setAttribute('data-bg-mode', bgMode);

    if (fixedBg && settings.bg_image && settings.bg_image.url) {
      fixedBg.style.backgroundImage = `url("${settings.bg_image.url}")`;
    }

    // Populate stage background layers if wrap exists
    if (stageLayersWrap) {
      stageLayersWrap.innerHTML = '';
      stages.forEach((item, index) => {
        const bgDiv = document.createElement('div');
        bgDiv.className = 'dial-bg dial-bg--stage' + (index === 0 ? ' is-active' : '');
        bgDiv.dataset.index = index;
        const imgUrl = (item.bg_image && item.bg_image.url) ? item.bg_image.url : '';
        if (imgUrl) {
          bgDiv.style.backgroundImage = `url("${imgUrl}")`;
        }
        stageLayersWrap.appendChild(bgDiv);
      });
    }

    // Dial dot size customizer
    if (dot) {
      const dotRadius = (settings.dial_dot_size && typeof settings.dial_dot_size.size !== 'undefined')
        ? settings.dial_dot_size.size
        : (typeof settings.dial_dot_size === 'number' ? settings.dial_dot_size : 5);
      dot.setAttribute('r', dotRadius);
    }

    // Counter separator & total text
    if (counterTotal) {
      counterTotal.textContent = String(stages.length).padStart(2, '0');
    }
    if (counterSeparator && typeof settings.counter_separator !== 'undefined') {
      counterSeparator.textContent = settings.counter_separator;
    }

    const CX = 500;
    const CY = 500;
    const R = 430;
    const ACTIVE_ANGLE = 0;
    const STAGE_START_ANGLE = -56;
    const STAGE_END_ANGLE = 56;

    const toRad = deg => deg * Math.PI / 180;
    const stageAngle = index => {
      if (stages.length <= 1) return 0;
      return STAGE_START_ANGLE + (STAGE_END_ANGLE - STAGE_START_ANGLE) * (index / (stages.length - 1));
    };

    function pointOnCircle(angle, radius = R) {
      const a = toRad(angle);
      return {
        x: CX + Math.cos(a) * radius,
        y: CY + Math.sin(a) * radius
      };
    }

    labelsWrap.innerHTML = '';
    const stageLabels = [];

    stages.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'dial__label sc-dial_label_typography';
      el.textContent = item.number || String(index + 1).padStart(2, '0');
      el.dataset.index = index;
      labelsWrap.appendChild(el);
      stageLabels.push(el);
    });

    function setElementOnCircle(el, angle, radius) {
      const point = pointOnCircle(angle, radius);
      el.style.left = `${point.x / 10}%`;
      el.style.top = `${point.y / 10}%`;
    }

    function updateDial(stagePosition) {
      const totalStages = Math.max(1, stages.length - 1);
      const interpolatedSourceAngle = STAGE_START_ANGLE +
        (STAGE_END_ANGLE - STAGE_START_ANGLE) * (stagePosition / totalStages);
      const rotationOffset = ACTIVE_ANGLE - interpolatedSourceAngle;

      stageLabels.forEach((label, index) => {
        setElementOnCircle(label, stageAngle(index) + rotationOffset, R + 62);
      });
    }

    if (dot) {
      const fixedDot = pointOnCircle(ACTIVE_ANGLE, R);
      dot.setAttribute('cx', fixedDot.x);
      dot.setAttribute('cy', fixedDot.y);
    }

    let activeIndex = -1;

    function updateActive(stagePosition) {
      const index = Math.max(0, Math.min(stages.length - 1, Math.round(stagePosition)));
      if (index === activeIndex) return;
      activeIndex = index;

      // Update dial numbers
      stageLabels.forEach((label, i) => {
        label.classList.toggle('is-active', i === index);
        gsap.to(label, {
          scale: i === index ? 1.22 : 1,
          opacity: i === index ? 1 : .46,
          duration: .25,
          overwrite: true
        });
      });

      // Update background layers
      if (stageLayersWrap) {
        const stageBgs = stageLayersWrap.querySelectorAll('.dial-bg--stage');
        stageBgs.forEach((bg, i) => {
          bg.classList.toggle('is-active', i === index);
        });
      }

      const next = stages[index];
      if (!next) return;

      const outgoing = [];
      if (title) outgoing.push(title);
      if (body) outgoing.push(body);
      if (tagsContainer && tagsContainer.children.length > 0) outgoing.push(tagsContainer);
      if (actionContainer && actionContainer.children.length > 0) outgoing.push(actionContainer);
      if (counterCurrent) outgoing.push(counterCurrent);

      function renderStageContent() {
        // 1. Title (with optional link)
        if (title) {
          const hasLink = next.link && next.link.url;
          if (hasLink) {
            const isExternal = next.link.is_external === true || next.link.is_external === 'yes' || next.link.is_external === '1' || next.link.is_external === 1;
            const target = isExternal ? '_blank' : '_self';
            const rel = isExternal ? ' rel="noopener noreferrer"' : '';
            title.innerHTML = `<a href="${next.link.url}" target="${target}"${rel} class="dial-content__title-link">${next.title || ''}</a>`;
          } else {
            title.textContent = next.title || '';
          }
        }

        // 2. Description
        if (body) {
          body.textContent = next.body || '';
        }

        // 3. Pill Tags
        if (tagsContainer) {
          tagsContainer.innerHTML = '';
          const rawTags = next.tags || next.pill_tags || '';
          if (rawTags && typeof rawTags === 'string' && rawTags.trim()) {
            const tagList = rawTags.split(',').map(t => t.trim()).filter(Boolean);
            if (tagList.length > 0) {
              const hasLink = next.link && next.link.url;
              const isExternal = hasLink && (next.link.is_external === true || next.link.is_external === 'yes' || next.link.is_external === '1' || next.link.is_external === 1);
              const target = isExternal ? '_blank' : '_self';
              const rel = isExternal ? ' rel="noopener noreferrer"' : '';

              tagList.forEach(tagText => {
                const tagEl = document.createElement(hasLink ? 'a' : 'span');
                tagEl.className = 'dial-content__tag sc-pill_typography';
                tagEl.textContent = tagText;
                if (hasLink) {
                  tagEl.href = next.link.url;
                  tagEl.target = target;
                  if (rel) tagEl.rel = 'noopener noreferrer';
                }
                tagsContainer.appendChild(tagEl);
              });
              tagsContainer.style.display = 'flex';
            } else {
              tagsContainer.style.display = 'none';
            }
          } else {
            tagsContainer.style.display = 'none';
          }
        }

        // 4. Action CTA Button (Optional)
        if (actionContainer) {
          actionContainer.innerHTML = '';
          const hasLink = next.link && next.link.url;
          const showButton = settings.show_link_button === 'yes' || settings.show_link_button === true;
          if (hasLink && showButton) {
            const isExternal = next.link.is_external === true || next.link.is_external === 'yes' || next.link.is_external === '1' || next.link.is_external === 1;
            const target = isExternal ? '_blank' : '_self';
            const rel = isExternal ? ' rel="noopener noreferrer"' : '';
            const btnText = settings.link_button_text || 'Learn More';
            actionContainer.innerHTML = `<a href="${next.link.url}" target="${target}"${rel} class="dial-content__btn"><span class="sc-link_btn_typography">${btnText}</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>`;
            actionContainer.style.display = 'flex';
          } else {
            actionContainer.style.display = 'none';
          }
        }

        // 5. Counter Current
        if (counterCurrent) {
          counterCurrent.textContent = next.number || String(index + 1).padStart(2, '0');
        }
      }

      if (outgoing.length > 0) {
        gsap.to(outgoing, {
          y: -12,
          opacity: 0,
          duration: .16,
          stagger: .02,
          overwrite: true,
          onComplete: () => {
            renderStageContent();

            const incoming = [];
            if (title) incoming.push(title);
            if (body) incoming.push(body);
            if (tagsContainer && tagsContainer.children.length > 0) incoming.push(tagsContainer);
            if (actionContainer && actionContainer.children.length > 0) incoming.push(actionContainer);
            if (counterCurrent) incoming.push(counterCurrent);

            gsap.fromTo(incoming,
              { y: 16, opacity: 0 },
              { y: 0, opacity: 1, duration: .28, stagger: .035, ease: 'power2.out', overwrite: true }
            );
          }
        });
      } else {
        renderStageContent();
      }
    }

    updateDial(0);
    updateActive(0);

    const state = { stagePosition: 0 };
    const scrubDist = (settings.scrub_distance && typeof settings.scrub_distance.size !== 'undefined')
      ? settings.scrub_distance.size
      : (typeof settings.scrub_distance === 'number' ? settings.scrub_distance : 900);
    const totalScroll = stages.length * scrubDist;

    animationTimeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: `+=${totalScroll}`,
        scrub: 0.55,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        snap: stages.length > 1 ? {
          snapTo: 1 / (stages.length - 1),
          duration: { min: 0.12, max: 0.35 },
          delay: 0.05,
          ease: 'power1.inOut'
        } : false
      }
    })
    .to(state, {
      stagePosition: stages.length - 1,
      duration: 1,
      onUpdate: () => {
        updateDial(state.stagePosition);
        updateActive(state.stagePosition);
      }
    }, 0);

    scrollTriggerInstance = animationTimeline.scrollTrigger;
  }

  // Cleanup handler for live re-renders
  window.supercomponentCleanups = window.supercomponentCleanups || {};
  window.supercomponentCleanups[currentInstanceId] = function() {
    if (animationTimeline) {
      animationTimeline.kill();
    }
    if (scrollTriggerInstance) {
      scrollTriggerInstance.kill();
    }
  };

  // Listen for live Elementor editor setting updates
  window.addEventListener('supercomponent:update', function(e) {
    if (e.detail && (e.detail.instanceId === currentInstanceId || !currentInstanceId)) {
      if (window.supercomponentCleanups && window.supercomponentCleanups[currentInstanceId]) {
        window.supercomponentCleanups[currentInstanceId]();
      }
      loadGSAP(function() {
        init(e.detail.settings);
      });
    }
  });

  loadGSAP(init);
})();
