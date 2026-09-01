<?php
/**
 * Plugin Name: SuperComponent Studio
 * Description: Real-time, schema-driven custom component runtime for Elementor. Paste HTML, CSS, JS, and JSON schemas to build widgets instantly.
 * Version: 1.0.7
 * Author: Supercraft
 * Text Domain: supercomponent-studio
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Main SuperComponent Studio Class
 */
final class SuperComponent_Studio {

	const VERSION = '1.0.7';
	const MINIMUM_ELEMENTOR_VERSION = '3.0.0';
	const MINIMUM_PHP_VERSION = '7.4';

	private static $_instance = null;

	public static function instance() {
		if ( is_null( self::$_instance ) ) {
			self::$_instance = new self();
		}
		return self::$_instance;
	}

	public function __construct() {
		require_once( __DIR__ . '/includes/validation.php' );
		require_once( __DIR__ . '/includes/admin.php' );
		add_action( 'plugins_loaded', [ $this, 'init' ] );
		$this->init_update_checker();
	}

	/**
	 * Initialize the auto-update checker from GitHub.
	 */
	private function init_update_checker() {
		$puc_file = __DIR__ . '/includes/vendor/plugin-update-checker/plugin-update-checker.php';
		if ( file_exists( $puc_file ) ) {
			require_once $puc_file;
			
			// Replace 'your-github-username' with your actual GitHub username/organization.
			// The update checker will look for releases and tags in this repository.
			\YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
				'https://github.com/lynesslim/supercomponent-studio/',
				__FILE__,
				'supercomponent-studio'
			);
		}
	}

	public function init() {
		// Check if Elementor is installed and active
		if ( ! did_action( 'elementor/loaded' ) ) {
			add_action( 'admin_notices', [ $this, 'admin_notice_missing_main_plugin' ] );
			return;
		}

		// Check version requirements
		if ( ! version_compare( ELEMENTOR_VERSION, self::MINIMUM_ELEMENTOR_VERSION, '>=' ) ) {
			add_action( 'admin_notices', [ $this, 'admin_notice_minimum_elementor_version' ] );
			return;
		}

		if ( version_compare( PHP_VERSION, self::MINIMUM_PHP_VERSION, '<' ) ) {
			add_action( 'admin_notices', [ $this, 'admin_notice_minimum_php_version' ] );
			return;
		}

		// Register Widget
		add_action( 'elementor/widgets/register', [ $this, 'register_widgets' ] );

		// Register Assets
		add_action( 'elementor/editor/before_enqueue_scripts', [ $this, 'enqueue_editor_scripts' ] );
		add_action( 'elementor/editor/after_enqueue_styles', [ $this, 'enqueue_editor_styles' ] );
	}

	public function admin_notice_missing_main_plugin() {
		if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
		$message = sprintf(
			/* translators: 1: Plugin name 2: Elementor */
			esc_html__( '"%1$s" requires "%2$s" to be installed and activated.', 'supercomponent-studio' ),
			'<strong>' . esc_html__( 'SuperComponent Studio', 'supercomponent-studio' ) . '</strong>',
			'<strong>' . esc_html__( 'Elementor', 'supercomponent-studio' ) . '</strong>'
		);
		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
	}

	public function admin_notice_minimum_elementor_version() {
		if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
		$message = sprintf(
			/* translators: 1: Plugin name 2: Elementor 3: Required Elementor version */
			esc_html__( '"%1$s" requires "%2$s" version %3$s or greater.', 'supercomponent-studio' ),
			'<strong>' . esc_html__( 'SuperComponent Studio', 'supercomponent-studio' ) . '</strong>',
			'<strong>' . esc_html__( 'Elementor', 'supercomponent-studio' ) . '</strong>',
			self::MINIMUM_ELEMENTOR_VERSION
		);
		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
	}

	public function admin_notice_minimum_php_version() {
		if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
		$message = sprintf(
			/* translators: 1: Plugin name 2: PHP 3: Required PHP version */
			esc_html__( '"%1$s" requires "%2$s" version %3$s or greater.', 'supercomponent-studio' ),
			'<strong>' . esc_html__( 'SuperComponent Studio', 'supercomponent-studio' ) . '</strong>',
			'<strong>' . esc_html__( 'PHP', 'supercomponent-studio' ) . '</strong>',
			self::MINIMUM_PHP_VERSION
		);
		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
	}

	public function register_widgets( $widgets_manager ) {
		if ( ! supercomponent_is_validated() ) {
			return;
		}
		require_once( __DIR__ . '/includes/class-supercomponent-widget.php' );
		$widgets_manager->register( new \SuperComponent_Widget() );
	}

	public function enqueue_editor_scripts() {
		if ( ! supercomponent_is_validated() ) {
			return;
		}
		wp_enqueue_script(
			'supercomponent-editor-helper',
			plugins_url( '/assets/js/editor-helper.js', __FILE__ ),
			[ 'jquery' ],
			time(), // Cache bust during development
			true
		);
	}

	public function enqueue_editor_styles() {
		if ( ! supercomponent_is_validated() ) {
			return;
		}
		wp_enqueue_style(
			'supercomponent-editor-styles',
			plugins_url( '/assets/css/editor.css', __FILE__ ),
			[],
			time()
		);
	}
}

SuperComponent_Studio::instance();
