<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function supercomponent_is_validated() {
	if ( defined( 'SUPERCOMPONENT_ALLOW_UNVALIDATED' ) && SUPERCOMPONENT_ALLOW_UNVALIDATED ) {
		return true;
	}

	$local_status = get_option( 'supercomponent_validation_status', 'not_set' ) === 'valid';
	return apply_filters( 'supercraft_is_plugin_validated', $local_status, 'supercraft-widget-studio' );
}

function supercomponent_get_validation_status() {
	return get_option( 'supercomponent_validation_status', 'not_set' );
}

function supercomponent_get_embed_code() {
	return get_option( 'supercomponent_embed_code', '' );
}

function supercomponent_get_last_validated() {
	return get_option( 'supercomponent_last_validated', '' );
}

function supercomponent_validate_embed_code_standalone( $embed_code ) {
	if ( empty( $embed_code ) ) {
		return false;
	}

	$endpoint    = 'https://superapp.supercraft.my/api/public/validate-embed';
	$plugin_name = 'supercraft-widget-studio';

	$response = wp_remote_post( $endpoint, [
		'headers' => [
			'Content-Type' => 'application/json',
		],
		'body'    => wp_json_encode( [
			'embed_code'  => $embed_code,
			'plugin_name' => $plugin_name,
			'domain'      => get_site_url(),
		] ),
		'timeout' => 15,
	] );

	if ( is_wp_error( $response ) ) {
		return false;
	}

	$status_code = wp_remote_retrieve_response_code( $response );
	if ( $status_code < 200 || $status_code >= 400 ) {
		return false;
	}

	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	return is_array( $body ) && ! empty( $body['valid'] );
}

function supercomponent_delete_plugin_registration( $embed_code ) {
	if ( empty( $embed_code ) ) {
		return false;
	}

	$endpoint    = 'https://superapp.supercraft.my/api/public/validate-embed/delete-registration';
	$plugin_name = 'supercraft-widget-studio';

	$response = wp_remote_request( $endpoint, [
		'method'  => 'DELETE',
		'headers' => [
			'Content-Type' => 'application/json',
		],
		'body'    => wp_json_encode( [
			'embed_code'  => $embed_code,
			'plugin_name' => $plugin_name,
		] ),
		'timeout' => 15,
	] );

	if ( is_wp_error( $response ) ) {
		return false;
	}

	$status_code = wp_remote_retrieve_response_code( $response );
	return $status_code >= 200 && $status_code < 400;
}

add_action( 'admin_post_supercomponent_save_embed_code', function() {
	check_admin_referer( 'supercomponent_save_settings' );
	$code = isset( $_POST['supercomponent_embed_code'] ) ? sanitize_text_field( $_POST['supercomponent_embed_code'] ) : '';
	update_option( 'supercomponent_embed_code', $code );
	if ( ! empty( $code ) ) {
		$valid = supercomponent_validate_embed_code_standalone( $code );
		update_option( 'supercomponent_validation_status', $valid ? 'valid' : 'invalid' );
	} else {
		update_option( 'supercomponent_validation_status', 'not_set' );
	}
	update_option( 'supercomponent_last_validated', current_time( 'mysql' ) );
	wp_redirect( add_query_arg( 'updated', 'true', wp_get_referer() ) );
	exit;
} );

add_action( 'admin_post_supercomponent_save_settings', function() {
	check_admin_referer( 'supercomponent_save_settings' );
	wp_redirect( add_query_arg( 'updated', 'true', wp_get_referer() ) );
	exit;
} );

add_action( 'admin_post_supercomponent_validate_now', function() {
	check_admin_referer( 'supercomponent_validate' );
	$code = get_option( 'supercomponent_embed_code', '' );
	if ( ! empty( $code ) ) {
		$valid = supercomponent_validate_embed_code_standalone( $code );
		update_option( 'supercomponent_validation_status', $valid ? 'valid' : 'invalid' );
		update_option( 'supercomponent_last_validated', current_time( 'mysql' ) );
	}
	wp_redirect( add_query_arg( 'updated', 'true', wp_get_referer() ) );
	exit;
} );

add_action( 'admin_post_supercomponent_unlink', function() {
	check_admin_referer( 'supercomponent_unlink' );
	$code = get_option( 'supercomponent_embed_code', '' );
	if ( ! empty( $code ) ) {
		supercomponent_delete_plugin_registration( $code );
	}
	update_option( 'supercomponent_embed_code', '' );
	update_option( 'supercomponent_validation_status', 'not_set' );
	update_option( 'supercomponent_last_validated', '' );
	wp_redirect( add_query_arg( 'updated', 'true', wp_get_referer() ) );
	exit;
} );
