(function ($) {
    'use strict';

    var SuperComponentEditor = {

        init: function () {
            this.listenForSchemaChanges();
            this.listenForControlChanges();
            this.listenForRebuild();
            this.hookPanelOpen();
        },

        // Hook into the Elementor panel opening event for our widget
        hookPanelOpen: function () {
            var self = this;
            console.log('SuperComponent: Initializing hookPanelOpen...');
            elementor.hooks.addAction('panel/open_editor/widget/supercomponent', function (panel, model, view) {
                console.log('SuperComponent: Hook panel/open_editor/widget/supercomponent fired for model ID:', model.id);
                if (view && view.container && !view.container._controlsRebuilt) {
                    // Mark as rebuilt to prevent infinite loop
                    view.container._controlsRebuilt = true;
                    
                    // Rebuild the controls list in JS
                    self.rebuildContainerControls(view.container);
                    
                    // Force the panel to reload with the newly built controls
                    panel.setPage('editor', {
                        model: model,
                        container: view.container
                    });
                } else if (view && view.container) {
                    console.log('SuperComponent: Skipping rebuild (already rebuilt or second pass).');
                    // Reset the flag for the next time the panel opens
                    view.container._controlsRebuilt = false;
                }
            });
        },

        listenForRebuild: function (controlView) {
            var self = this;
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

                    // 2. Safely locate the widget model and container
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

                    // 3. Trigger save in the background
                    if (elementor.documents && elementor.documents.getCurrent()) {
                        var doc = elementor.documents.getCurrent();
                        if (typeof doc.save === 'function') {
                            doc.save();
                        }
                    }
                    
                    if (container) {
                        // 4. Dynamically rebuild the JS controls list from the new schema
                        self.rebuildContainerControls(container);

                        // 5. Immediately reload the widget preview (inline AJAX)
                        if (typeof container.render === 'function') {
                            container.render();
                        }
                    }
                    
                    // 6. Rebuild the panel inline (now 100% safe because controls are updated!)
                    if (widgetModel && container) {
                        panel.setPage('editor', {
                            model: widgetModel,
                            container: container
                        });
                        
                        // Auto-collapse the Developer section immediately
                        var devSection = $('.elementor-control-developer_settings, #elementor-panel-section-developer_settings');
                        if (devSection.length) {
                            console.log('SuperComponent: Collapsing developer section...');
                            devSection.find('.elementor-panel-heading, .elementor-section-title, .elementor-panel-heading-toggle').first().trigger('click');
                        }
                    }
                } catch (error) {
                    console.error('SuperComponent: Error during rebuild:', error);
                }
            });
        },

        // Dynamically parse the schema JSON and inject the controls into the JS container
        rebuildContainerControls: function (container) {
            if (!container) return;

            var schemaJson = container.settings.get('schema');
            console.log('SuperComponent: Rebuilding controls for container:', container.id, 'Schema:', schemaJson);

            // Start with the default developer controls
            var controls = {
                developer_settings: {
                    name: 'developer_settings',
                    type: 'section',
                    label: 'Developer',
                    tab: 'content'
                },
                schema: {
                    name: 'schema',
                    type: 'code',
                    label: 'Schema (JSON)',
                    tab: 'content',
                    section: 'developer_settings'
                },
                html: {
                    name: 'html',
                    type: 'code',
                    label: 'HTML Template',
                    tab: 'content',
                    section: 'developer_settings'
                },
                css: {
                    name: 'css',
                    type: 'code',
                    label: 'CSS',
                    tab: 'content',
                    section: 'developer_settings'
                },
                js: {
                    name: 'js',
                    type: 'code',
                    label: 'JavaScript',
                    tab: 'content',
                    section: 'developer_settings'
                },
                rebuild_button: {
                    name: 'rebuild_button',
                    type: 'button',
                    text: 'Apply & Rebuild',
                    tab: 'content',
                    section: 'developer_settings'
                },
                active_schema_id: {
                    name: 'active_schema_id',
                    type: 'text',
                    default: ''
                }
            };

            var schemaJson = container.settings.get('schema');
            if (schemaJson) {
                try {
                    var schema = JSON.parse(schemaJson);
                    if (schema && schema.id) {
                        var schemaIdClean = schema.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        
                        // Dynamically update the active_schema_id setting value on the model
                        if (container.settings.get('active_schema_id') !== schemaIdClean) {
                            container.settings.set('active_schema_id', schemaIdClean);
                        }

                        if (schema.settings && Array.isArray(schema.settings)) {
                            schema.settings.forEach(function (control) {
                                if (!control.id || !control.type || !control.label) {
                                    return;
                                }

                                var tab = control.tab || 'content';
                                var sectionLabel = control.section || 'Component Settings';
                                // Matches PHP's sanitize_title() exactly
                                var sectionId = 'sc_' + schemaIdClean + '_' + sectionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '_' + tab;

                                // Create section if not exists
                                if (!controls[sectionId]) {
                                    controls[sectionId] = {
                                        name: sectionId,
                                        type: 'section',
                                        label: sectionLabel,
                                        tab: tab
                                    };
                                }

                                // Map types to Elementor JS control types
                                var typeMap = {
                                    'text': 'text',
                                    'textarea': 'textarea',
                                    'richtext': 'wysiwyg',
                                    'image': 'media',
                                    'url': 'url',
                                    'color': 'color',
                                    'slider': 'slider',
                                    'number': 'number',
                                    'select': 'select',
                                    'switcher': 'switcher',
                                    'repeater': 'repeater',
                                    'dimensions': 'dimensions',
                                    'typography': 'typography'
                                };

                                var controlDef = {
                                    name: control.id,
                                    type: typeMap[control.type] || 'text',
                                    label: control.label,
                                    tab: tab,
                                    section: sectionId,
                                    'default': control['default'] !== undefined ? control['default'] : '',
                                    render_type: 'template' // Force all controls to re-render
                                };

                                if (control.description) controlDef.description = control.description;
                                
                                // Map select options
                                if (control.options) {
                                    if (Array.isArray(control.options)) {
                                        var opts = {};
                                        control.options.forEach(function (o) {
                                            opts[o.value] = o.label;
                                        });
                                        controlDef.options = opts;
                                    } else {
                                        controlDef.options = control.options;
                                    }
                                }

                                // Map slider/number bounds
                                if (control.min !== undefined) controlDef.min = control.min;
                                if (control.max !== undefined) controlDef.max = control.max;
                                if (control.step !== undefined) controlDef.step = control.step;

                                // Map repeater fields
                                if (control.type === 'repeater' && Array.isArray(control.fields)) {
                                    var fields = {};
                                    control.fields.forEach(function (f) {
                                        var fDef = {
                                            name: f.id,
                                            type: typeMap[f.type] || 'text',
                                            label: f.label,
                                            'default': f['default'] !== undefined ? f['default'] : ''
                                        };
                                        if (f.options) {
                                            if (Array.isArray(f.options)) {
                                                var fOpts = {};
                                                f.options.forEach(function (o) {
                                                    fOpts[o.value] = o.label;
                                                });
                                                fDef.options = fOpts;
                                            } else {
                                                fDef.options = f.options;
                                            }
                                        }
                                        fields[f.id] = fDef;
                                    });
                                    controlDef.fields = fields;
                                }

                                controls[control.id] = controlDef;
                            });
                        }
                    }
                } catch (err) {
                    console.error('SuperComponent: Error parsing schema for JS controls:', err);
                }
            }

            // 3. Apply the controls to the container
            container.controls = controls;

            // 4. Apply to the widget instance model
            if (container.model) {
                container.model.controls = controls;
            }

            // 5. Apply directly to the global widget type's Backbone Collection
            var widgetType = elementor.widgets.get('supercomponent');
            if (widgetType && widgetType.get('controls')) {
                var controlsArray = [];
                Object.keys(controls).forEach(function (key) {
                    controlsArray.push(controls[key]);
                });

                if (typeof widgetType.get('controls').reset === 'function') {
                    // Correctly reset the Backbone Collection with the new controls list!
                    widgetType.get('controls').reset(controlsArray);
                } else {
                    // Fallback
                    widgetType.set('controls', controls);
                    widgetType.attributes.controls = controls;
                }
            }
        },

        listenForSchemaChanges: function () {
            var self = this;
            elementor.channels.editor.on('change', function (model) {
                if (!model || !model.changed) {
                    return;
                }
                // Only reload if the schema control itself was modified
                if (model.changed.schema !== undefined) {
                    setTimeout(function () {
                        elementor.reloadPreview();
                        var panel = elementor.getPanelView();
                        if (panel && panel.currentPageView && panel.currentPageView.container) {
                            self.rebuildContainerControls(panel.currentPageView.container);
                            panel.setPage('editor', {
                                model: model,
                                container: panel.currentPageView.container
                            });
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
