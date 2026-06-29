(function ($) {
    'use strict';

    var SuperComponentEditor = {

        init: function () {
            this.listenForSchemaChanges();
            this.listenForControlChanges();
            this.listenForRebuild();
        },

        listenForRebuild: function (controlView) {
            elementor.channels.editor.on('supercomponent:editor:rebuild', function (view) {
                // 1. Manually revert the button state immediately so it never gets stuck
                if (view && view.$el) {
                    view.$el.find('.elementor-button').removeClass('elementor-loading');
                    view.$el.find('.elementor-button-spinner').remove();
                }

                try {
                    var panel = elementor.getPanelView();
                    if (!panel) {
                        return;
                    }

                    // 2. Safely locate the widget model and container using multiple fallback paths
                    var widgetModel = null;
                    var container = null;
                    
                    if (view && view.container) {
                        container = view.container;
                        widgetModel = container.model;
                    } else if (panel.currentPageView) {
                        container = panel.currentPageView.container;
                        widgetModel = panel.currentPageView.model;
                    } else if (panel.content && panel.content.currentView) {
                        container = panel.content.currentView.container;
                        widgetModel = panel.content.currentView.model;
                    }

                    // 3. Trigger save in the background (non-blocking, using modern Document API)
                    if (elementor.documents && elementor.documents.getCurrent()) {
                        var doc = elementor.documents.getCurrent();
                        if (typeof doc.save === 'function') {
                            doc.save();
                        }
                    }
                    
                    // 4. Immediately reload the widget preview (inline AJAX, no page/iframe reload!)
                    if (container && typeof container.render === 'function') {
                        container.render();
                    }
                    
                    // 5. Auto-collapse the Developer section immediately
                    var devSection = $('.elementor-control-developer_settings, #elementor-panel-section-developer_settings');
                    if (devSection.length) {
                        console.log('SuperComponent: Collapsing developer section...');
                        devSection.find('.elementor-panel-heading, .elementor-section-title, .elementor-panel-heading-toggle').first().trigger('click');
                    }
                } catch (error) {
                    console.error('SuperComponent: Error during rebuild:', error);
                }
            });
        },

        listenForSchemaChanges: function () {
            elementor.channels.editor.on('change', function (model) {
                if (!model || !model.changed) {
                    return;
                }
                // Only reload if the schema control itself was modified
                if (model.changed.schema !== undefined) {
                    setTimeout(function () {
                        elementor.reloadPreview();
                        var panel = elementor.getPanelView();
                        if (panel) {
                            panel.setPage('editor', model);
                        }
                    }, 500);
                }
            });
        },

        listenForControlChanges: function () {
            elementor.channels.editor.on('change', function (model) {
                if (!model || !model.get) {
                    return;
                }
                var changed = model.changed || {};
                var hasSuperComponentChange = Object.keys(changed).some(function (key) {
                    return key !== 'schema' && key !== 'html' && key !== 'css' && key !== 'js';
                });
                if (hasSuperComponentChange) {
                    var instanceId = model.get('id');
                    if (instanceId) {
                        var settings = model.toJSON();
                        var event = new CustomEvent('supercomponent:update', {
                            detail: {
                                instanceId: instanceId,
                                settings: settings
                            }
                        });
                        window.dispatchEvent(event);
                    }
                }
            });
        }
    };

    $(window).on('elementor:init', function () {
        SuperComponentEditor.init();
    });

})(jQuery);
