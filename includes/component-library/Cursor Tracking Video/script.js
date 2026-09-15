// 1. Memory leak cleanup registration
var currentInstanceId = typeof instanceId !== 'undefined' ? instanceId : '{{instanceId}}';

if (window.supercomponentCleanups && window.supercomponentCleanups[currentInstanceId]) {
    window.supercomponentCleanups[currentInstanceId]();
}

var animationFrameId = null;
var activeEventListeners = [];

function init() {
    var wrapper = null;
    if (typeof currentInstanceId !== 'undefined' && currentInstanceId && currentInstanceId !== '{{instanceId}}') {
        wrapper = document.querySelector('[data-instance-id="' + currentInstanceId + '"]') ||
                  document.querySelector('.elementor-element-' + currentInstanceId);
    }
    if (!wrapper) {
        wrapper = document.querySelector('[data-instance-id="{{instanceId}}"]') ||
                  document.querySelector('.elementor-element-{{instanceId}}') ||
                  document.querySelector('.cursor-tracking-video-wrapper');
    }

    if (!wrapper) return;

    var video = wrapper.querySelector('.ctv-video');
    var card = wrapper.querySelector('.ctv-card') || wrapper;
    if (!video) return;

    // Read configuration dataset
    var scope = wrapper.getAttribute('data-scope') || 'container';
    var defaultPosPct = parseFloat(wrapper.getAttribute('data-default-pos')) || 50;
    var defaultPos = Math.max(0, Math.min(1, defaultPosPct / 100)); // Default 0.5 (middle)
    var invertDirection = wrapper.getAttribute('data-invert') === 'yes';
    
    // Smoothness and Return speeds
    var smoothVal = parseFloat(wrapper.getAttribute('data-smooth')) || 12;
    var returnVal = parseFloat(wrapper.getAttribute('data-return')) || 5;
    var smoothSpeed = Math.max(0.01, Math.min(0.5, smoothVal / 100));
    var returnSpeed = Math.max(0.005, Math.min(0.3, returnVal / 100));

    var enableTouch = wrapper.getAttribute('data-touch') !== 'no';
    var enableTilt = wrapper.getAttribute('data-tilt') === 'yes';
    var tiltStrength = parseFloat(wrapper.getAttribute('data-tilt-strength')) || 6;

    // State Tracking
    var targetProgress = defaultPos;
    var currentProgress = defaultPos;
    var isTracking = false;
    var pendingSeekTime = null;

    // 3D Tilt State
    var targetTiltX = 0;
    var targetTiltY = 0;
    var currentTiltX = 0;
    var currentTiltY = 0;

    // Helper: Register managed event listener
    function addManagedListener(target, event, handler, options) {
        target.addEventListener(event, handler, options);
        activeEventListeners.push({ target: target, event: event, handler: handler });
    }

    // --- VIDEO INITIALIZATION & PLAYBACK FIX ---
    // 1. Force muted properties (mandatory for browsers to allow preloading & scrubbing)
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    // 2. Resolve video source from attribute or child <source>
    var videoSrc = video.getAttribute('src') || video.getAttribute('data-src') || '';
    if (!videoSrc) {
        var sourceTag = video.querySelector('source');
        if (sourceTag) {
            videoSrc = sourceTag.getAttribute('src') || '';
        }
    }

    if (videoSrc && (!video.src || video.src === window.location.href || video.currentSrc === '')) {
        video.src = videoSrc;
    }

    // 3. Apply Rest Position (50% center)
    function setRestPosition() {
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
            var restTime = defaultPos * video.duration;
            try {
                video.currentTime = restTime;
            } catch (e) {}
        }
    }

    // 4. Prime the decoder pipeline: load and briefly kickstart playback muted
    if (video.readyState < 1) {
        try {
            video.load();
        } catch (e) {}
    }

    var primePromise = video.play();
    if (primePromise !== undefined) {
        primePromise.then(function() {
            video.pause();
            setRestPosition();
        }).catch(function() {
            setRestPosition();
        });
    } else {
        video.pause();
        setRestPosition();
    }

    addManagedListener(video, 'loadedmetadata', setRestPosition);
    addManagedListener(video, 'loadeddata', setRestPosition);
    addManagedListener(video, 'canplay', setRestPosition);

    // Handle seek queue so fast mouse movement never freezes playback
    addManagedListener(video, 'seeked', function() {
        if (pendingSeekTime !== null && video.duration && !isNaN(video.duration)) {
            var nextTime = pendingSeekTime;
            pendingSeekTime = null;
            try {
                video.currentTime = Math.max(0, Math.min(video.duration, nextTime));
            } catch (e) {}
        }
    });

    // Calculate progress from cursor position
    function calculateProgress(clientX, clientY) {
        var progress = defaultPos;
        var rect = card.getBoundingClientRect();

        if (scope === 'window') {
            var winW = window.innerWidth || document.documentElement.clientWidth;
            progress = clientX / (winW || 1);
        } else {
            progress = (clientX - rect.left) / (rect.width || 1);
        }

        // Clamp between 0.0 and 1.0
        progress = Math.max(0, Math.min(1, progress));

        if (invertDirection) {
            progress = 1 - progress;
        }

        if (enableTilt) {
            var relativeX = (clientX - rect.left) / (rect.width || 1) - 0.5;
            var relativeY = (clientY - rect.top) / (rect.height || 1) - 0.5;
            targetTiltY = relativeX * tiltStrength;
            targetTiltX = -relativeY * tiltStrength;
        }

        return progress;
    }

    // Mouse Tracking Handlers
    var onMouseMove = function(e) {
        if (scope === 'window') {
            isTracking = true;
            targetProgress = calculateProgress(e.clientX, e.clientY);
        } else {
            var rect = card.getBoundingClientRect();
            var inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                         e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (inside) {
                isTracking = true;
                targetProgress = calculateProgress(e.clientX, e.clientY);
            } else if (isTracking) {
                onMouseLeave();
            }
        }
    };

    var onMouseEnter = function() {
        isTracking = true;
    };

    var onMouseLeave = function() {
        isTracking = false;
        targetProgress = defaultPos; // Slowly revert to default 50%
        targetTiltX = 0;
        targetTiltY = 0;
    };

    if (scope === 'window') {
        addManagedListener(window, 'mousemove', onMouseMove, { passive: true });
        addManagedListener(document, 'mouseleave', onMouseLeave);
        addManagedListener(window, 'blur', onMouseLeave);
    } else {
        addManagedListener(card, 'mouseenter', onMouseEnter);
        addManagedListener(card, 'mousemove', onMouseMove, { passive: true });
        addManagedListener(card, 'mouseleave', onMouseLeave);
    }

    // Touch Support for Mobile
    if (enableTouch) {
        var onTouchMove = function(e) {
            if (!e.touches || !e.touches.length) return;
            var touch = e.touches[0];
            isTracking = true;
            targetProgress = calculateProgress(touch.clientX, touch.clientY);
        };

        addManagedListener(card, 'touchstart', onMouseEnter, { passive: true });
        addManagedListener(card, 'touchmove', onTouchMove, { passive: true });
        addManagedListener(card, 'touchend', onMouseLeave);
        addManagedListener(card, 'touchcancel', onMouseLeave);
    }

    // Animation Loop (Damped Lerp)
    function tick() {
        var ease = isTracking ? smoothSpeed : returnSpeed;
        var diff = targetProgress - currentProgress;

        if (Math.abs(diff) > 0.0002) {
            currentProgress += diff * ease;
        } else if (currentProgress !== targetProgress) {
            currentProgress = targetProgress;
        }

        // Apply time update to video
        if (video && video.duration && !isNaN(video.duration) && video.duration > 0) {
            var targetTime = currentProgress * video.duration;
            targetTime = Math.max(0, Math.min(video.duration, targetTime));

            if (!video.seeking) {
                if (Math.abs(video.currentTime - targetTime) > 0.01) {
                    try {
                        video.currentTime = targetTime;
                    } catch (e) {}
                }
            } else {
                pendingSeekTime = targetTime;
            }
        }

        // Apply smooth 3D tilt
        if (enableTilt && card) {
            currentTiltX += (targetTiltX - currentTiltX) * 0.1;
            currentTiltY += (targetTiltY - currentTiltY) * 0.1;
            card.style.transform = 'perspective(1000px) rotateX(' + currentTiltX.toFixed(2) + 'deg) rotateY(' + currentTiltY.toFixed(2) + 'deg)';
        }

        animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);
}

// 4. Register Cleanup Function
window.supercomponentCleanups = window.supercomponentCleanups || {};
window.supercomponentCleanups[currentInstanceId] = function() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    for (var i = 0; i < activeEventListeners.length; i++) {
        var item = activeEventListeners[i];
        try {
            item.target.removeEventListener(item.event, item.handler);
        } catch (e) {}
    }
    activeEventListeners = [];
};

// 5. Initialize Instance
init();
