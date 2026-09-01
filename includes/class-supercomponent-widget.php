<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SuperComponent_Widget extends \Elementor\Widget_Base {

	/**
	 * Track registered section IDs and control IDs across multiple register_dynamic_controls calls.
	 * Prevents duplicate registration errors when multiple schemas share section/control names.
	 */
	private static $registered_sections = [];
	private static $registered_controls = [];

	public function get_name() {
		return 'supercomponent';
	}

	public function get_title() {
		return esc_html__( 'SuperComponent', 'supercomponent-studio' );
	}

	public function get_icon() {
		return 'eicon-code';
	}

	public function get_categories() {
		return [ 'basic' ];
	}

	public function get_keywords() {
		return [ 'supercomponent', 'component', 'custom', 'code' ];
	}

	public function get_style_depends() {
		return [ 'elementor-icons-fa-solid', 'elementor-icons-fa-regular', 'elementor-icons-fa-brands' ];
	}

	// ponytail: Naive JSON decode + basic array check for schema validation
	// Ceiling: Does not validate nested property types or detect circular dependency conditions
	// Upgrade path: Replace with a full JSON Schema validator (e.g., justinrainbow/json-schema)
	// ponytail: Try multiple sources to get the schema JSON, in priority order.
	// 1. Direct instance data (works on frontend render with real instances)
	// 2. AJAX POST data (works when Elementor is saving/updating via AJAX)
	// 3. Database lookup via post ID + widget ID
	protected function register_controls() {
		$this->register_developer_controls();

		// Collect ALL schemas from ALL supercomponent instances on this page
		$all_schemas = $this->get_all_schemas_for_page();

		foreach ( $all_schemas as $schema_json ) {
			if ( empty( $schema_json ) ) {
				continue;
			}
			$schema = json_decode( $schema_json, true );
			if ( ! $schema || ! isset( $schema['settings'] ) || ! is_array( $schema['settings'] ) ) {
				continue;
			}
			$schema_id = isset( $schema['id'] ) ? $schema['id'] : 'default';
			$this->register_dynamic_controls( $schema['settings'], $schema_id );
		}
	}

	private function register_developer_controls() {
		$this->start_controls_section(
			'developer_settings',
			[
				'label' => esc_html__( 'Developer', 'supercomponent-studio' ),
				'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
			]
		);

		$this->add_control(
			'schema',
			[
				'label' => esc_html__( 'Schema (JSON)', 'supercomponent-studio' ),
				'type' => \Elementor\Controls_Manager::CODE,
				'language' => 'json',
				'rows' => 12,
				'placeholder' => '{"id": "my-component", "name": "My Component", "settings": [...]}',
				'description' => esc_html__( 'Define the component controls as JSON.', 'supercomponent-studio' ),
			]
		);

		$this->add_control(
			'html',
			[
				'label' => esc_html__( 'HTML Template', 'supercomponent-studio' ),
				'type' => \Elementor\Controls_Manager::CODE,
				'language' => 'html',
				'rows' => 15,
				'placeholder' => '<div class="my-component">{{title}}</div>',
				'description' => esc_html__( 'HTML with {{variable}} placeholders.', 'supercomponent-studio' ),
			]
		);

		$this->add_control(
			'css',
			[
				'label' => esc_html__( 'CSS', 'supercomponent-studio' ),
				'type' => \Elementor\Controls_Manager::CODE,
				'language' => 'css',
				'rows' => 12,
				'placeholder' => '.my-component { color: var(--color); }',
				'description' => esc_html__( 'CSS using var(--variable-name) tokens.', 'supercomponent-studio' ),
			]
		);

		$this->add_control(
			'js',
			[
				'label' => esc_html__( 'JavaScript', 'supercomponent-studio' ),
				'type' => \Elementor\Controls_Manager::CODE,
				'language' => 'javascript',
				'rows' => 10,
				'placeholder' => '// Custom JS (optional)',
				'description' => esc_html__( 'Optional JavaScript for the component.', 'supercomponent-studio' ),
			]
		);

		$this->add_control(
			'rebuild_button',
			[
				'type' => \Elementor\Controls_Manager::BUTTON,
				'button_type' => 'success',
				'text' => esc_html__( 'Apply & Rebuild', 'supercomponent-studio' ),
				'event' => 'supercomponent:editor:rebuild',
				'separator' => 'before',
			]
		);

		$this->add_control(
			'active_schema_id',
			[
				'type' => \Elementor\Controls_Manager::TEXT,
				'default' => '',
				'label_block' => true,
				'classes' => 'elementor-hidden-control', // Hides it from the panel UI
			]
		);

		$this->end_controls_section();
	}

	/**
	 * Collect schemas from ALL supercomponent widget instances on the current page.
	 * This ensures that when two widgets have different schemas, BOTH sets of controls
	 * are registered in PHP. The Elementor editor will display only the controls that
	 * have matching setting keys for the currently selected widget.
	 */
	private function get_all_schemas_for_page() {
		$schemas = [];

		// 1. Direct instance data
		if ( ! empty( $this->data ) && isset( $this->data['settings']['schema'] ) && ! empty( $this->data['settings']['schema'] ) ) {
			$schemas[] = $this->data['settings']['schema'];
		}

		// 2. AJAX request — collect schemas from the POST payload
		if ( wp_doing_ajax() ) {
			if ( isset( $_POST['actions'] ) ) {
				$actions = json_decode( wp_unslash( $_POST['actions'] ), true );
				if ( is_array( $actions ) ) {
					foreach ( $actions as $action ) {
						if ( isset( $action['data']['settings']['schema'] ) && ! empty( $action['data']['settings']['schema'] ) ) {
							$schemas[] = $action['data']['settings']['schema'];
						}
						if ( isset( $action['data']['model']['settings']['schema'] ) && ! empty( $action['data']['model']['settings']['schema'] ) ) {
							$schemas[] = $action['data']['model']['settings']['schema'];
						}
					}
				}
			}
			if ( isset( $_POST['data']['settings']['schema'] ) && ! empty( $_POST['data']['settings']['schema'] ) ) {
				$schemas[] = wp_unslash( $_POST['data']['settings']['schema'] );
			}
			if ( isset( $_POST['settings']['schema'] ) && ! empty( $_POST['settings']['schema'] ) ) {
				$schemas[] = wp_unslash( $_POST['settings']['schema'] );
			}
		}

		// 3. Database lookup — walk ALL elements on the page and collect every supercomponent's schema
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
		if ( ! $post_id && wp_doing_ajax() ) {
			if ( isset( $_POST['post_id'] ) ) {
				$post_id = absint( $_POST['post_id'] );
			} elseif ( isset( $_POST['editor_post_id'] ) ) {
				$post_id = absint( $_POST['editor_post_id'] );
			}
		}
		if ( ! $post_id ) {
			$post_id = get_the_ID();
		}

		if ( $post_id ) {
			$elementor_data = get_post_meta( $post_id, '_elementor_data', true );
			if ( ! empty( $elementor_data ) ) {
				$data = is_string( $elementor_data ) ? json_decode( $elementor_data, true ) : $elementor_data;
				if ( is_array( $data ) ) {
					$widgets = $this->find_all_supercomponent_widgets( $data );
					foreach ( $widgets as $widget ) {
						if ( isset( $widget['settings']['schema'] ) && ! empty( $widget['settings']['schema'] ) ) {
							$schemas[] = $widget['settings']['schema'];
						}
					}
				}
			}
		}

		return array_values( array_unique( array_filter( $schemas ) ) );
	}

	/**
	 * Recursively find ALL supercomponent widget instances in the Elementor data tree.
	 */
	private function find_all_supercomponent_widgets( $elements ) {
		$results = [];
		foreach ( $elements as $element ) {
			if ( isset( $element['widgetType'] ) && 'supercomponent' === $element['widgetType'] ) {
				$results[] = $element;
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$results = array_merge( $results, $this->find_all_supercomponent_widgets( $element['elements'] ) );
			}
		}
		return $results;
	}

	private function register_dynamic_controls( array $controls, $schema_id ) {
		$tab_map = [
			'content'  => \Elementor\Controls_Manager::TAB_CONTENT,
			'style'    => \Elementor\Controls_Manager::TAB_STYLE,
			'advanced' => \Elementor\Controls_Manager::TAB_ADVANCED,
		];

		$schema_id_clean = sanitize_title( $schema_id );
		$grouped_controls = [];

		foreach ( $controls as $control ) {
			if ( ! isset( $control['id'], $control['type'], $control['label'] ) ) {
				continue;
			}

			$elementor_type = $this->map_control_type( $control['type'] );
			if ( ! $elementor_type ) {
				continue;
			}

			$tab           = isset( $control['tab'] ) && isset( $tab_map[ $control['tab'] ] ) ? $tab_map[ $control['tab'] ] : \Elementor\Controls_Manager::TAB_CONTENT;
			$section_label = isset( $control['section'] ) ? $control['section'] : 'Component Settings';

			$group_key = $tab . '||' . $section_label;

			// Elementor's image, video, media, url, and dimensions controls require an array default value
			$array_types = [ 'image', 'video', 'media', 'url', 'dimensions' ];
			$default_fallback = in_array( $control['type'], $array_types, true ) ? [] : '';

			$scoped_control_id = 'sc_' . $schema_id_clean . '_' . $control['id'];

			$control_args = [
				'label'   => $control['label'],
				'type'    => $elementor_type,
				'default' => isset( $control['default'] ) ? $control['default'] : $default_fallback,
			];

			// Native Elementor real-time CSS variable injection
			if ( in_array( $control['type'], [ 'color', 'slider', 'number', 'dimensions', 'select' ], true ) ) {
				if ( 'slider' === $control['type'] ) {
					$control_args['selectors'] = [
						'{{WRAPPER}}' => "--{$control['id']}: {{SIZE}}{{UNIT}};",
					];
				} elseif ( 'dimensions' === $control['type'] ) {
					$control_args['selectors'] = [
						'{{WRAPPER}}' => "--{$control['id']}: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};",
					];
				} else {
					$control_args['selectors'] = [
						'{{WRAPPER}}' => "--{$control['id']}: {{VALUE}};",
					];
				}
			}

			if ( isset( $control['description'] ) ) {
				$control_args['description'] = $control['description'];
			}

			if ( isset( $control['condition'] ) && is_array( $control['condition'] ) ) {
				$scoped_condition = [];
				foreach ( $control['condition'] as $c_key => $c_val ) {
					$scoped_condition[ 'sc_' . $schema_id_clean . '_' . $c_key ] = $c_val;
				}
				$control_args['condition'] = $scoped_condition;
			}

			switch ( $control['type'] ) {
				case 'number':
					if ( isset( $control['min'] ) ) $control_args['min'] = $control['min'];
					if ( isset( $control['max'] ) ) $control_args['max'] = $control['max'];
					if ( isset( $control['step'] ) ) $control_args['step'] = $control['step'];
					break;

				case 'slider':
					$control_args['size_units'] = isset( $control['unit'] ) ? [ $control['unit'] ] : [ 'px' ];
					$unit = isset( $control['unit'] ) ? $control['unit'] : 'px';
					$control_args['range'] = [
						$unit => [
							'min'  => isset( $control['min'] ) ? $control['min'] : 0,
							'max'  => isset( $control['max'] ) ? $control['max'] : 100,
							'step' => isset( $control['step'] ) ? $control['step'] : 1,
						],
					];
					$control_args['default'] = isset( $control['default'] ) ? $control['default'] : [
						'size' => 0,
						'unit' => $unit,
					];
					break;

				case 'select':
					if ( isset( $control['options'] ) && is_array( $control['options'] ) ) {
						$options = [];
						foreach ( $control['options'] as $option ) {
							if ( isset( $option['value'], $option['label'] ) ) {
								$options[ $option['value'] ] = $option['label'];
							}
						}
						$control_args['options'] = $options;
					}
					break;

				case 'image':
				case 'video':
				case 'media':
					if ( 'video' === $control['type'] ) {
						$control_args['media_type'] = 'video';
					} elseif ( isset( $control['media_type'] ) ) {
						$control_args['media_type'] = $control['media_type'];
					}
					break;

				case 'url':
				case 'dimensions':
				case 'typography':
				case 'icons':
				case 'icon':
					break;

				case 'repeater':
					if ( isset( $control['fields'] ) && is_array( $control['fields'] ) ) {
						$repeater = new \Elementor\Repeater();
						foreach ( $control['fields'] as $field ) {
							if ( ! isset( $field['id'], $field['type'], $field['label'] ) ) {
								continue;
							}
							$field_type = $this->map_control_type( $field['type'] );
							if ( ! $field_type ) {
								continue;
							}
							
							$field_array_types = [ 'image', 'video', 'media', 'url', 'dimensions', 'icons', 'icon' ];
							$field_default_fallback = in_array( $field['type'], $field_array_types, true ) ? [] : '';

							$field_args = [
								'label'   => $field['label'],
								'type'    => $field_type,
								'default' => isset( $field['default'] ) ? $field['default'] : $field_default_fallback,
							];
							if ( 'video' === $field['type'] ) {
								$field_args['media_type'] = 'video';
							} elseif ( isset( $field['media_type'] ) ) {
								$field_args['media_type'] = $field['media_type'];
							}
							if ( isset( $field['description'] ) ) {
								$field_args['description'] = $field['description'];
							}
							if ( 'select' === $field['type'] && isset( $field['options'] ) && is_array( $field['options'] ) ) {
								$options = [];
								foreach ( $field['options'] as $option ) {
									if ( isset( $option['value'], $option['label'] ) ) {
										$options[ $option['value'] ] = $option['label'];
									}
								}
								$field_args['options'] = $options;
							}
							$repeater->add_control( $field['id'], $field_args );
						}
						$control_args['fields'] = $repeater->get_controls();
						$control_args['title_field'] = isset( $control['title_field'] ) ? $control['title_field'] : '{{{ ' . ( isset( $control['fields'][0]['id'] ) ? $control['fields'][0]['id'] : '' ) . ' }}}';
					}
					break;
			}

			// Set render_type to 'template' for all controls to guarantee real-time JS and HTML updates
			$grouped_controls[ $group_key ][] = [
				'id'       => $scoped_control_id,
				'raw_id'   => $control['id'],
				'args'     => array_merge( $control_args, [ 'render_type' => 'template' ] ),
				'is_group' => ( 'typography' === $control['type'] ),
			];

			if ( ! isset( $grouped_controls[ $group_key ]['_meta'] ) ) {
				$grouped_controls[ $group_key ]['_meta'] = [
					'tab'   => $tab,
					'label' => $section_label,
				];
			}
		}

		foreach ( $grouped_controls as $group_key => $group ) {
			$meta = $group['_meta'];
			$section_id = 'sc_' . $schema_id_clean . '_' . sanitize_title( $meta['label'] ) . '_' . sanitize_title( $meta['tab'] );

			$items_to_register = [];
			foreach ( $group as $item ) {
				if ( isset( $item['id'] ) && ! in_array( $item['id'], self::$registered_controls, true ) ) {
					$items_to_register[] = $item;
				}
			}

			if ( empty( $items_to_register ) ) {
				continue;
			}

			$this->start_controls_section( $section_id, [
				'label'     => $meta['label'],
				'tab'       => $meta['tab'],
				'condition' => [
					'active_schema_id' => $schema_id_clean,
				],
			] );

			foreach ( $items_to_register as $item ) {
				self::$registered_controls[] = $item['id'];
				if ( isset( $item['is_group'] ) && $item['is_group'] ) {
					$this->add_group_control(
						\Elementor\Group_Control_Typography::get_type(),
						[
							'name'     => $item['id'],
							'label'    => $item['args']['label'],
							'selector' => '{{WRAPPER}} .sc-' . $item['raw_id'],
							'fields_options' => [
								'font_family'     => [ 'render_type' => 'template' ],
								'font_size'       => [ 'render_type' => 'template' ],
								'font_weight'     => [ 'render_type' => 'template' ],
								'text_transform'  => [ 'render_type' => 'template' ],
								'font_style'      => [ 'render_type' => 'template' ],
								'text_decoration' => [ 'render_type' => 'template' ],
								'line_height'     => [ 'render_type' => 'template' ],
								'letter_spacing'  => [ 'render_type' => 'template' ],
								'word_spacing'    => [ 'render_type' => 'template' ],
							],
						]
					);
				} else {
					$this->add_control( $item['id'], $item['args'] );
				}
			}

			$this->end_controls_section();
		}
	}

	private function map_control_type( $type ) {
		$map = [
			'text'        => \Elementor\Controls_Manager::TEXT,
			'textarea'    => \Elementor\Controls_Manager::TEXTAREA,
			'richtext'    => \Elementor\Controls_Manager::WYSIWYG,
			'image'       => \Elementor\Controls_Manager::MEDIA,
			'video'       => \Elementor\Controls_Manager::MEDIA,
			'media'       => \Elementor\Controls_Manager::MEDIA,
			'url'         => \Elementor\Controls_Manager::URL,
			'color'       => \Elementor\Controls_Manager::COLOR,
			'slider'      => \Elementor\Controls_Manager::SLIDER,
			'number'      => \Elementor\Controls_Manager::NUMBER,
			'select'      => \Elementor\Controls_Manager::SELECT,
			'switcher'    => \Elementor\Controls_Manager::SWITCHER,
			'repeater'    => \Elementor\Controls_Manager::REPEATER,
			'dimensions'  => \Elementor\Controls_Manager::DIMENSIONS,
			'typography'  => 'group_typography',
			'icons'       => \Elementor\Controls_Manager::ICONS,
			'icon'        => \Elementor\Controls_Manager::ICONS,
		];

		return isset( $map[ $type ] ) ? $map[ $type ] : false;
	}

	/**
	 * Read the raw widget settings directly from the _elementor_data post meta.
	 * This bypasses Elementor's control-registration gate and ensures that
	 * dynamically-registered control values survive on the frontend.
	 */
	private function get_raw_widget_settings() {
		$widget_id = $this->get_id();
		if ( ! $widget_id ) {
			return [];
		}

		$post_id = get_the_ID();
		if ( ! $post_id ) {
			$post_id = get_queried_object_id();
		}
		if ( ! $post_id ) {
			return [];
		}

		$elementor_data = get_post_meta( $post_id, '_elementor_data', true );
		if ( empty( $elementor_data ) ) {
			return [];
		}

		$data = is_string( $elementor_data ) ? json_decode( $elementor_data, true ) : $elementor_data;
		if ( ! is_array( $data ) ) {
			return [];
		}

		$widget = $this->find_widget_by_id( $data, $widget_id );
		if ( $widget && isset( $widget['settings'] ) && is_array( $widget['settings'] ) ) {
			return $widget['settings'];
		}

		return [];
	}

	private function find_widget_by_id( array $elements, $id ) {
		foreach ( $elements as $element ) {
			if ( isset( $element['id'] ) && $element['id'] === $id ) {
				return $element;
			}
			if ( isset( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$found = $this->find_widget_by_id( $element['elements'], $id );
				if ( $found ) {
					return $found;
				}
			}
		}
		return null;
	}

	/**
	 * Resolve Elementor global color and typography references.
	 *
	 * When a user picks a global color (e.g. "Secondary") in the editor, Elementor stores:
	 *   __globals__['card_bg'] = 'globals/colors?id=secondary'
	 * When a user picks a global typography (e.g. "Primary") in the editor, Elementor stores:
	 *   __globals__['title_typo_typography'] = 'globals/typography?id=primary'
	 *
	 * This method resolves both to actual values using the active Elementor Kit.
	 *
	 * ponytail: Resolves globals/colors and globals/typography references from __globals__.
	 * Ceiling: Only resolves color and typography. Does not handle other global types.
	 * Upgrade path: Use Elementor's built-in global resolution if they expose a public API.
	 */
	private function resolve_globals( array $settings, array $globals ) {
		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
		if ( ! $kit ) {
			return $settings;
		}

		// Build lookup maps from the Kit
		$color_map = [];
		$typo_map  = [];

		// --- Colors ---
		foreach ( [ 'system_colors', 'custom_colors' ] as $color_group ) {
			$colors = $kit->get_settings_for_display( $color_group );
			if ( is_array( $colors ) ) {
				foreach ( $colors as $color ) {
					if ( isset( $color['_id'] ) && isset( $color['color'] ) ) {
						$color_map[ $color['_id'] ] = $color['color'];
					}
				}
			}
		}

		// --- Typography ---
		foreach ( [ 'system_typography', 'custom_typography' ] as $typo_group ) {
			$typographies = $kit->get_settings_for_display( $typo_group );
			if ( is_array( $typographies ) ) {
				foreach ( $typographies as $typo ) {
					if ( isset( $typo['_id'] ) ) {
						$typo_map[ $typo['_id'] ] = $typo;
					}
				}
			}
		}

		foreach ( $globals as $control_id => $global_ref ) {
			if ( ! is_string( $global_ref ) ) {
				continue;
			}

			// Resolve "globals/colors?id=secondary"
			if ( preg_match( '/globals\/colors\?id=(.+)/', $global_ref, $matches ) ) {
				$color_id = $matches[1];
				if ( isset( $color_map[ $color_id ] ) ) {
					$settings[ $control_id ] = $color_map[ $color_id ];
				}
			}

			// Resolve "globals/typography?id=primary"
			// The control_id for typography globals is "{name}_typography" (e.g. "title_typo_typography").
			// We extract the base name and map the Kit's typography properties to sub-keys.
			if ( preg_match( '/globals\/typography\?id=(.+)/', $global_ref, $matches ) ) {
				$typo_id = $matches[1];
				if ( isset( $typo_map[ $typo_id ] ) ) {
					$typo_data = $typo_map[ $typo_id ];
					// Extract the base name: "title_typo_typography" → "title_typo"
					$base_name = preg_replace( '/_typography$/', '', $control_id );

					// Map Kit typography properties to Elementor's sub-control keys
					$typo_props = [
						'font_family',
						'font_size',
						'font_weight',
						'text_transform',
						'font_style',
						'text_decoration',
						'line_height',
						'letter_spacing',
						'word_spacing',
					];

					foreach ( $typo_props as $prop ) {
						$kit_key = 'typography_' . $prop;
						if ( isset( $typo_data[ $kit_key ] ) && '' !== $typo_data[ $kit_key ] ) {
							$settings[ $base_name . '_' . $prop ] = $typo_data[ $kit_key ];
						}
					}
				}
			}
		}

		return $settings;
	}

	// ponytail: Naive JSON decode + array check for schema validation
	// Ceiling: Does not validate nested property types or detect circular dependency conditions
	// Upgrade path: Replace with a full JSON Schema validator (e.g., justinrainbow/json-schema)
	protected function render() {
		// ponytail: Use raw $this->data['settings'] as primary source, overlay with get_settings_for_display().
		// Raw data has the actual saved values for dynamic controls that may not be registered on the frontend.
		// The merge order ensures raw saved values override Elementor's defaults.
		$display_settings = $this->get_settings_for_display();
		$settings = $display_settings;
		
		// ponytail: On the frontend, Elementor strips settings for unregistered dynamic controls.
		// We must read the raw _elementor_data from the database to get saved values and resolve globals.
		// In the editor, controls are registered and AJAX provides current values, so this is unnecessary.
		$is_edit_mode = \Elementor\Plugin::$instance->editor->is_edit_mode();
		if ( ! $is_edit_mode ) {
			$raw_settings = $this->get_raw_widget_settings();
			$settings = array_merge( $display_settings, $raw_settings );

			// Resolve Elementor global color/typography references stored in __globals__
			if ( ! empty( $raw_settings['__globals__'] ) && is_array( $raw_settings['__globals__'] ) ) {
				$settings = $this->resolve_globals( $settings, $raw_settings['__globals__'] );
			}
		}
		
		$schema_json = isset( $settings['schema'] ) ? $settings['schema'] : '';

		$schema = json_decode( $schema_json, true );
		if ( ! $schema || ! isset( $schema['settings'] ) || ! is_array( $schema['settings'] ) ) {
			$schema = [ 'settings' => [] ];
		}

		$html_template = isset( $settings['html'] ) ? $settings['html'] : '';
		$css_code      = isset( $settings['css'] ) ? $settings['css'] : '';
		$js_code       = isset( $settings['js'] ) ? $settings['js'] : '';

		$id = 'supercomponent-' . $this->get_id();

		$schema_id_clean = sanitize_title( isset( $schema['id'] ) ? $schema['id'] : 'default' );

		$css_vars = [];
		$control_values = [];

		foreach ( $schema['settings'] as $control_def ) {
			if ( ! isset( $control_def['id'] ) ) {
				continue;
			}
			$var_id = $control_def['id'];
			$scoped_id = 'sc_' . $schema_id_clean . '_' . $var_id;

			$value = isset( $settings[ $scoped_id ] ) ? $settings[ $scoped_id ] : ( isset( $settings[ $var_id ] ) ? $settings[ $var_id ] : ( isset( $control_def['default'] ) ? $control_def['default'] : '' ) );

			$control_values[ $var_id ] = $value;

			$css_var_value = $this->get_css_var_value( $value, $control_def );
			if ( $css_var_value !== null ) {
				$css_vars[ $var_id ] = $css_var_value;
			}
		}

		$this->add_render_attribute( 'wrapper', 'id', $id );
		$this->add_render_attribute( 'wrapper', 'data-supercomponent', '' );
		$this->add_render_attribute( 'wrapper', 'data-instance-id', $this->get_id() );
		$this->add_render_attribute( 'wrapper', 'data-settings', htmlspecialchars( wp_json_encode( $control_values ), ENT_QUOTES, 'UTF-8' ) );

		$rendered_html = $this->render_template( $html_template, $control_values, $schema['settings'] );

		$css_vars_string = '';
		foreach ( $css_vars as $var => $val ) {
			$css_vars_string .= "\t--{$var}: {$val};\n";
		}

		$output = '';

		if ( ! empty( $css_code ) || ! empty( $css_vars_string ) ) {
			$output .= "<style>\n";
			$output .= ".elementor-element-{$this->get_id()} {\n";
			$output .= $css_vars_string;
			$output .= "}\n";
			$output .= "\n{$css_code}\n";

			// Generate typography CSS for resolved global typography
			foreach ( $schema['settings'] as $control_def ) {
				if ( ! isset( $control_def['type'] ) || 'typography' !== $control_def['type'] ) {
					continue;
				}
				$base = $control_def['id'];
				$scoped_base = 'sc_' . $schema_id_clean . '_' . $base;
				$typo_rules = '';

				$get_typo_val = function( $prop ) use ( $settings, $scoped_base, $base ) {
					if ( isset( $settings[ $scoped_base . '_' . $prop ] ) && '' !== $settings[ $scoped_base . '_' . $prop ] ) {
						return $settings[ $scoped_base . '_' . $prop ];
					}
					if ( isset( $settings[ $base . '_' . $prop ] ) && '' !== $settings[ $base . '_' . $prop ] ) {
						return $settings[ $base . '_' . $prop ];
					}
					return null;
				};

				// font-family
				$font = $get_typo_val( 'font_family' );
				if ( ! empty( $font ) ) {
					$typo_rules .= "\tfont-family: \"" . esc_attr( $font ) . "\", sans-serif;\n";
				}
				// font-size
				$fs = $get_typo_val( 'font_size' );
				if ( ! empty( $fs ) ) {
					if ( is_array( $fs ) && isset( $fs['size'] ) && '' !== $fs['size'] ) {
						$unit = isset( $fs['unit'] ) ? $fs['unit'] : 'px';
						$typo_rules .= "\tfont-size: {$fs['size']}{$unit};\n";
					}
				}
				// font-weight
				$fw = $get_typo_val( 'font_weight' );
				if ( ! empty( $fw ) ) {
					$typo_rules .= "\tfont-weight: " . esc_attr( $fw ) . ";\n";
				}
				// text-transform
				$tt = $get_typo_val( 'text_transform' );
				if ( ! empty( $tt ) ) {
					$typo_rules .= "\ttext-transform: " . esc_attr( $tt ) . ";\n";
				}
				// font-style
				$fst = $get_typo_val( 'font_style' );
				if ( ! empty( $fst ) ) {
					$typo_rules .= "\tfont-style: " . esc_attr( $fst ) . ";\n";
				}
				// text-decoration
				$td = $get_typo_val( 'text_decoration' );
				if ( ! empty( $td ) ) {
					$typo_rules .= "\ttext-decoration: " . esc_attr( $td ) . ";\n";
				}
				// line-height
				$lh = $get_typo_val( 'line_height' );
				if ( ! empty( $lh ) ) {
					if ( is_array( $lh ) && isset( $lh['size'] ) && '' !== $lh['size'] ) {
						$unit = isset( $lh['unit'] ) ? $lh['unit'] : '';
						$typo_rules .= "\tline-height: {$lh['size']}{$unit};\n";
					}
				}
				// letter-spacing
				$ls = $get_typo_val( 'letter_spacing' );
				if ( ! empty( $ls ) ) {
					if ( is_array( $ls ) && isset( $ls['size'] ) && '' !== $ls['size'] ) {
						$unit = isset( $ls['unit'] ) ? $ls['unit'] : 'px';
						$typo_rules .= "\tletter-spacing: {$ls['size']}{$unit};\n";
					}
				}

				if ( ! empty( $typo_rules ) ) {
					$output .= ".elementor-element-{$this->get_id()} .sc-{$base} {\n";
					$output .= $typo_rules;
					$output .= "}\n";
				}
			}

			$output .= "</style>\n";
		}

		$output .= '<div ' . $this->get_render_attribute_string( 'wrapper' ) . '>';
		$output .= $rendered_html;
		$output .= '</div>';

		// ponytail: Simple JS IIFE string wrapping — no safety checks on user-supplied JS
		// Ceiling: Malformed JavaScript can break the page; no sandboxing or error isolation
		// Upgrade path: Integrate a JS linter/validator (e.g., php-webdriver) or sanitize via a service-side JS sandbox
		if ( ! empty( $js_code ) ) {
			$js_payload = htmlspecialchars( wp_json_encode( $control_values ), ENT_QUOTES, 'UTF-8' );
			$output .= "<script>\n";
			$output .= "(function() {\n";
			$output .= "var instanceId = '{$this->get_id()}';\n";
			$output .= $js_code . "\n";
			$output .= "})();\n";
			$output .= "</script>\n";
		}

		echo $output;
	}

	private function get_css_var_value( $value, $control_def ) {
		$type = isset( $control_def['type'] ) ? $control_def['type'] : '';

		switch ( $type ) {
			case 'text':
			case 'textarea':
			case 'richtext':
				return $value;

			case 'color':
				return $value;

			case 'slider':
				if ( is_array( $value ) && isset( $value['size'], $value['unit'] ) ) {
					return $value['size'] . $value['unit'];
				}
				if ( is_array( $value ) && isset( $value['size'] ) ) {
					return $value['size'] . 'px';
				}
				return $value;

			case 'number':
				return $value;

			case 'dimensions':
				if ( is_array( $value ) ) {
					$parts = [];
					foreach ( [ 'top', 'right', 'bottom', 'left' ] as $side ) {
						$parts[] = isset( $value[ $side ] ) ? $value[ $side ] . ( isset( $value['unit'] ) ? $value['unit'] : 'px' ) : '0';
					}
					return implode( ' ', $parts );
				}
				return $value;

			case 'select':
			case 'switcher':
				return $value;

			default:
				if ( is_string( $value ) || is_numeric( $value ) ) {
					return $value;
				}
				return null;
		}
	}

	/**
	 * Render an Elementor icon control value to HTML (SVG, <i> tag, or image).
	 */
	private function render_icon_html( $icon_data ) {
		if ( empty( $icon_data ) ) {
			return '';
		}
		if ( is_string( $icon_data ) ) {
			return $icon_data;
		}
		if ( is_array( $icon_data ) ) {
			if ( class_exists( '\Elementor\Icons_Manager' ) ) {
				ob_start();
				\Elementor\Icons_Manager::render_icon( $icon_data, [ 'aria-hidden' => 'true' ] );
				$icon_html = ob_get_clean();
				if ( ! empty( $icon_html ) ) {
					return $icon_html;
				}
			}
			if ( isset( $icon_data['value'] ) && is_string( $icon_data['value'] ) && ! empty( $icon_data['value'] ) ) {
				if ( isset( $icon_data['library'] ) && 'svg' === $icon_data['library'] && isset( $icon_data['value']['url'] ) ) {
					return '<img src="' . esc_url( $icon_data['value']['url'] ) . '" alt="" aria-hidden="true" class="sc-icon-svg" />';
				}
				return '<i class="' . esc_attr( $icon_data['value'] ) . '" aria-hidden="true"></i>';
			}
		}
		return '';
	}

	// ponytail: Regex-based template engine instead of a full AST parser
	// Ceiling: Cannot handle deeply nested identical block tags or complex logic (e.g., {{#outer}}{{#outer}}...{{/outer}}{{/outer}})
	// Upgrade path: Integrate a lightweight template engine like Mustache PHP (mustache/mustache)
	private function render_template( $template, $values, $settings ) {
		if ( empty( $template ) ) {
			return '';
		}

		$output = $template;

		// Handle block constructs: {{#var}}...{{/var}} and {{^var}}...{{/var}}
		// - If var is a list of arrays -> repeater loop
		// - If var is scalar -> conditional block (positive or negative)
		$output = preg_replace_callback(
			'/\{\{([#^])([\w\.]+)\}\}(.*?)\{\{\/\2\}\}/s',
			function ( $matches ) use ( $values ) {
				$type = $matches[1]; // '#' (positive) or '^' (negative/inverted)
				$expression = $matches[2]; // e.g. 'center_image.url' or 'nodes'
				$inner = $matches[3];

				// Resolve the value (supporting dot-notation)
				$val = null;
				if ( strpos( $expression, '.' ) !== false ) {
					$parts = explode( '.', $expression );
					$var_id = $parts[0];
					$key = $parts[1];
					if ( isset( $values[ $var_id ] ) && is_array( $values[ $var_id ] ) && isset( $values[ $var_id ][ $key ] ) ) {
						$val = $values[ $var_id ][ $key ];
					}
				} else {
					$val = isset( $values[ $expression ] ) ? $values[ $expression ] : null;
				}

				// If it's a repeater loop (only for positive '#' and if value is a list of arrays)
				if ( '#' === $type && is_array( $val ) && ! empty( $val ) && isset( $val[0] ) && is_array( $val[0] ) ) {
					// Collect field defaults and row defaults for this repeater from schema settings
					$field_defaults = [];
					$repeater_defaults = [];
					if ( is_array( $settings ) ) {
						foreach ( $settings as $ctrl ) {
							if ( isset( $ctrl['id'] ) && $ctrl['id'] === $expression ) {
								if ( isset( $ctrl['fields'] ) && is_array( $ctrl['fields'] ) ) {
									foreach ( $ctrl['fields'] as $fld ) {
										if ( isset( $fld['id'], $fld['default'] ) ) {
											$field_defaults[ $fld['id'] ] = $fld['default'];
										}
									}
								}
								if ( isset( $ctrl['default'] ) && is_array( $ctrl['default'] ) ) {
									$repeater_defaults = $ctrl['default'];
								}
							}
						}
					}

					$result = '';
					foreach ( $val as $item_index => $item ) {
						// Fallback to schema defaults if saved repeater item has missing or empty field values
						foreach ( $field_defaults as $f_id => $f_def ) {
							$fallback = $f_def;
							if ( isset( $repeater_defaults[ $item_index ][ $f_id ] ) && ! empty( $repeater_defaults[ $item_index ][ $f_id ] ) ) {
								$fallback = $repeater_defaults[ $item_index ][ $f_id ];
							}
							if ( ! isset( $item[ $f_id ] ) || '' === $item[ $f_id ] ) {
								$item[ $f_id ] = $fallback;
							} elseif ( is_array( $item[ $f_id ] ) && isset( $item[ $f_id ]['value'] ) && empty( $item[ $f_id ]['value'] ) ) {
								$item[ $f_id ] = $fallback;
							}
						}

						$item_output = $inner;
						
						// 1. Process nested conditional/inverted blocks inside this repeater item
						$item_output = preg_replace_callback(
							'/\{\{([#^])([\w\.]+)\}\}(.*?)\{\{\/\2\}\}/s',
							// Use $item instead of $values for context inside the repeater item
							function ( $sub_matches ) use ( $item ) {
								$sub_type = $sub_matches[1];
								$sub_expr = $sub_matches[2];
								$sub_inner = $sub_matches[3];

								$sub_val = null;
								if ( strpos( $sub_expr, '.' ) !== false ) {
									$parts = explode( '.', $sub_expr );
									$var_id = $parts[0];
									$key = $parts[1];
									if ( isset( $item[ $var_id ] ) && is_array( $item[ $var_id ] ) && isset( $item[ $var_id ][ $key ] ) ) {
										$sub_val = $item[ $var_id ][ $key ];
									}
								} else {
									$sub_val = isset( $item[ $sub_expr ] ) ? $item[ $sub_expr ] : null;
								}

								$is_truthy = ! empty( $sub_val ) && 'false' !== $sub_val;
								if ( is_array( $sub_val ) && empty( $sub_val ) ) {
									$is_truthy = false;
								}

								$show = ( '#' === $sub_type ) ? $is_truthy : ! $is_truthy;
								return $show ? $sub_inner : '';
							},
							$item_output
						);

						// 2. Replace unescaped {{{variable}}} inside repeater item
						$item_output = preg_replace_callback(
							'/\{\{\{([\w\.]+)\}\}\}/',
							function ( $raw_matches ) use ( $item ) {
								$key = $raw_matches[1];
								if ( isset( $item[ $key ] ) ) {
									$val = $item[ $key ];
									if ( is_array( $val ) && ( isset( $val['value'] ) || isset( $val['library'] ) ) ) {
										return $this->render_icon_html( $val );
									}
									if ( is_string( $val ) || is_numeric( $val ) ) {
										return $val;
									}
								}
								return '';
							},
							$item_output
						);

						// 3. Replace simple variables
						foreach ( $item as $key => $item_val ) {
							if ( is_string( $item_val ) || is_numeric( $item_val ) ) {
								$item_output = str_replace( '{{' . $key . '}}', esc_html( $item_val ), $item_output );
							} elseif ( is_array( $item_val ) ) {
								if ( isset( $item_val['value'] ) || isset( $item_val['library'] ) ) {
									$icon_rendered = $this->render_icon_html( $item_val );
									$item_output = str_replace( '{{' . $key . '}}', $icon_rendered, $item_output );
									if ( isset( $item_val['value'] ) && is_string( $item_val['value'] ) ) {
										$item_output = str_replace( '{{' . $key . '.value}}', esc_attr( $item_val['value'] ), $item_output );
									}
									if ( isset( $item_val['library'] ) && is_string( $item_val['library'] ) ) {
										$item_output = str_replace( '{{' . $key . '.library}}', esc_attr( $item_val['library'] ), $item_output );
									}
								}
								if ( isset( $item_val['url'] ) ) {
									$item_output = str_replace( '{{' . $key . '.url}}', esc_url( $item_val['url'] ), $item_output );
								}
								if ( isset( $item_val['alt'] ) ) {
									$item_output = str_replace( '{{' . $key . '.alt}}', esc_attr( $item_val['alt'] ), $item_output );
								}
							}
						}
						$result .= $item_output;
					}
					return $result;
				}

				// For standard conditionals (empty arrays are considered falsy)
				$is_truthy = ! empty( $val ) && 'false' !== $val;
				if ( is_array( $val ) && empty( $val ) ) {
					$is_truthy = false;
				}

				$show = ( '#' === $type ) ? $is_truthy : ! $is_truthy;
				return $show ? $inner : '';
			},
			$output
		);

		// Handle unescaped {{{variable}}} replacements at root level
		$output = preg_replace_callback(
			'/\{\{\{([\w\.]+)\}\}\}/',
			function ( $matches ) use ( $values ) {
				$expression = $matches[1];
				if ( strpos( $expression, '.' ) !== false ) {
					$parts = explode( '.', $expression );
					$var_id = $parts[0];
					$key = $parts[1];
					if ( isset( $values[ $var_id ] ) && is_array( $values[ $var_id ] ) && isset( $values[ $var_id ][ $key ] ) ) {
						$val = $values[ $var_id ][ $key ];
						return ( is_string( $val ) || is_numeric( $val ) ) ? $val : '';
					}
					return '';
				}
				if ( isset( $values[ $expression ] ) ) {
					$val = $values[ $expression ];
					if ( is_array( $val ) && ( isset( $val['value'] ) || isset( $val['library'] ) ) ) {
						return $this->render_icon_html( $val );
					}
					if ( is_string( $val ) || is_numeric( $val ) ) {
						return $val;
					}
				}
				return '';
			},
			$output
		);

		// Handle simple {{variable}} replacements
		$output = preg_replace_callback(
			'/\{\{(\w+(?:\.\w+)?(?:\s*\?\s*\'[^\']*\'\s*:\s*\'[^\']*\')?)\}\}/',
			function ( $matches ) use ( $values ) {
				$expression = $matches[1];

				// Handle ternary expressions: variable ? 'val_true' : 'val_false'
				if ( preg_match( '/^(\w+)\s*\?\s*\'([^\']*)\'\s*:\s*\'([^\']*)\'$/', $expression, $ternary ) ) {
					$var_id = $ternary[1];
					$val = isset( $values[ $var_id ] ) ? $values[ $var_id ] : '';
					return ! empty( $val ) ? $ternary[2] : $ternary[3];
				}

				// Handle dot notation: variable.key
				if ( strpos( $expression, '.' ) !== false ) {
					$parts = explode( '.', $expression );
					$var_id = $parts[0];
					$key = $parts[1];

					if ( isset( $values[ $var_id ] ) && is_array( $values[ $var_id ] ) && isset( $values[ $var_id ][ $key ] ) ) {
						$val = $values[ $var_id ][ $key ];
						if ( is_string( $val ) ) {
							if ( 'url' === $key ) {
								return esc_url( $val );
							}
							return esc_html( $val );
						}
						return esc_html( $val );
					}
					return '';
				}

				// Simple variable
				if ( isset( $values[ $expression ] ) ) {
					$val = $values[ $expression ];
					if ( is_array( $val ) && ( isset( $val['value'] ) || isset( $val['library'] ) ) ) {
						return $this->render_icon_html( $val );
					}
					if ( is_string( $val ) || is_numeric( $val ) ) {
						return esc_html( $val );
					}
					if ( is_array( $val ) && isset( $val['url'] ) ) {
						return esc_url( $val['url'] );
					}
					return '';
				}

				return '';
			},
			$output
		);

		return $output;
	}
}
