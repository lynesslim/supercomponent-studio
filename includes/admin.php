<?php
if ( ! defined( 'ABSPHT' ) && ! defined( 'ABSPATH' ) ) {
	exit;
}

function supercomponent_admin_notice() {
	$status = get_option( 'supercomponent_validation_status', 'not_set' );
	if ( $status === 'invalid' ) {
		echo '<div class="notice notice-warning is-dismissible">
            <p><strong>SuperComponent Studio:</strong> Embed code is invalid. Custom widgets are disabled. <a href="' . admin_url( 'admin.php?page=supercomponent-studio' ) . '">Enter a valid embed code</a>.</p>
        </div>';
	}
}
add_action( 'admin_notices', 'supercomponent_admin_notice' );

function supercomponent_render_admin_page() {
	$status         = get_option( 'supercomponent_validation_status', 'not_set' );
	$embed_code     = get_option( 'supercomponent_embed_code', '' );
	$last_validated = get_option( 'supercomponent_last_validated', '' );
	$is_master_active = has_filter( 'supercraft_is_plugin_validated' );

	?>
	<div class="wrap">
		<h1>SuperComponent Studio Settings</h1>
		
		<?php if ( isset( $_GET['updated'] ) ) : ?>
			<div class="notice notice-success is-dismissible">
				<p>Settings saved.</p>
			</div>
		<?php endif; ?>

		<?php if ( $is_master_active ) : ?>
			<div class="notice notice-info">
				<p>License validation is managed globally by the <strong>Supercraft Master Plugin</strong>.</p>
			</div>
		<?php endif; ?>

		<form method="post" action="<?php echo admin_url( 'admin-post.php' ); ?>">
			<?php wp_nonce_field( 'supercomponent_save_settings' ); ?>
			<input type="hidden" name="action" value="supercomponent_save_embed_code">

			<table class="form-table">
				<?php if ( ! $is_master_active ) : ?>
					<tr>
						<th scope="row">
							<label for="supercomponent_embed_code">Embed Code</label>
						</th>
						<td>
							<input type="text" 
								   id="supercomponent_embed_code" 
								   name="supercomponent_embed_code" 
								   class="regular-text" 
								   value="<?php echo esc_attr( $embed_code ); ?>"
								   placeholder="Enter your embed code"
								   <?php echo ( $status === 'valid' ) ? 'readonly' : ''; ?>>
						</td>
					</tr>
					<tr>
						<th scope="row">Status</th>
						<td>
							<?php if ( $status === 'valid' ) : ?>
								<span style="color: green; font-weight: bold;">Valid</span>
							<?php elseif ( $status === 'invalid' ) : ?>
								<span style="color: red; font-weight: bold;">Invalid</span>
							<?php else : ?>
								<span style="color: gray;">Not Set</span>
							<?php endif; ?>
							<?php if ( $last_validated ) : ?>
								<p class="description">Last validated: <?php echo esc_html( $last_validated ); ?></p>
							<?php endif; ?>
						</td>
					</tr>
				<?php endif; ?>
				<tr>
					<th scope="row">Integration Active</th>
					<td>
						<?php if ( $is_master_active ) : ?>
							<span style="color: green; font-weight: bold;">Yes (Connected to Supercraft Master Plugin)</span>
						<?php else : ?>
							<span style="color: orange;">No (Running in Standalone mode)</span>
						<?php endif; ?>
					</td>
				</tr>
			</table>

			<?php if ( ! $is_master_active && $status === 'valid' ) : ?>
				<input type="hidden" name="supercomponent_embed_code" value="<?php echo esc_attr( $embed_code ); ?>">
			<?php endif; ?>
			<input type="submit" name="submit" class="button button-primary" value="Save Settings" onclick="this.form.action.value='supercomponent_save_settings'">
			<?php if ( ! $is_master_active && $status !== 'valid' ) : ?>
				<?php submit_button( 'Save & Validate' ); ?>
			<?php endif; ?>
		</form>

		<?php if ( ! $is_master_active && $status === 'valid' ) : ?>
			<form method="post" action="<?php echo admin_url( 'admin-post.php' ); ?>" style="margin-top: 12px;">
				<?php wp_nonce_field( 'supercomponent_unlink' ); ?>
				<input type="hidden" name="action" value="supercomponent_unlink">
				<?php submit_button( 'Unlink Embed Code', 'delete', 'submit', false, [ 'onclick' => 'return confirm("Are you sure you want to unlink this embed code?");' ] ); ?>
			</form>
		<?php endif; ?>
	</div>
	<?php
}

function supercomponent_admin_menu() {
	global $menu;

	$supercraft_parent_slug = '';
	foreach ( $menu as $item ) {
		if ( isset( $item[0] ) && strpos( $item[0], 'Supercraft' ) !== false ) {
			$supercraft_parent_slug = isset( $item[2] ) ? $item[2] : '';
			break;
		}
	}

	if ( $supercraft_parent_slug ) {
		add_submenu_page(
			$supercraft_parent_slug,
			'SuperComponent Studio Settings',
			'Widget Studio',
			'manage_options',
			'supercomponent-studio',
			'supercomponent_render_admin_page'
		);
	} else {
		add_menu_page(
			'SuperComponent Studio',
			'Supercraft',
			'manage_options',
			'supercomponent-studio',
			'supercomponent_render_admin_page',
			'dashicons-controls-play',
			80
		);
		add_submenu_page(
			'supercomponent-studio',
			'SuperComponent Studio Settings',
			'Widget Studio',
			'manage_options',
			'supercomponent-studio',
			'supercomponent_render_admin_page'
		);
	}
}
add_action( 'admin_menu', 'supercomponent_admin_menu' );
