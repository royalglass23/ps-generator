<?php
/**
 * Anonymous REST adapter for the public application module.
 *
 * @package RoyalGlassPS1Native
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RG_PS1_REST_Controller {
	private const NAMESPACE = 'royal-glass-ps1/v1';

	private RG_PS1_Service $service;
	private RG_PS1_Storage $storage;

	public function __construct( RG_PS1_Service $service, RG_PS1_Storage $storage ) {
		$this->service = $service;
		$this->storage = $storage;
	}

	public function register_routes(): void {
		$public = static fn() => true;
		register_rest_route(
			self::NAMESPACE,
			'/applications/drafts',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'create_draft' ),
				'permission_callback' => $public,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/applications/drafts/(?P<id>[0-9a-fA-F-]{36})',
			array(
				array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'get_draft' ), 'permission_callback' => $public ),
				array( 'methods' => WP_REST_Server::EDITABLE, 'callback' => array( $this, 'save_draft' ), 'permission_callback' => $public ),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/applications/drafts/(?P<id>[0-9a-fA-F-]{36})/resume-link',
			array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'send_resume_link' ), 'permission_callback' => $public )
		);
		register_rest_route(
			self::NAMESPACE,
			'/applications/drafts/(?P<id>[0-9a-fA-F-]{36})/uploads',
			array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'upload' ), 'permission_callback' => $public )
		);
		register_rest_route(
			self::NAMESPACE,
			'/applications/drafts/(?P<id>[0-9a-fA-F-]{36})/uploads/(?P<upload_id>[0-9a-fA-F-]{36})',
			array( 'methods' => WP_REST_Server::DELETABLE, 'callback' => array( $this, 'remove_upload' ), 'permission_callback' => $public )
		);
		register_rest_route(
			self::NAMESPACE,
			'/applications/drafts/(?P<id>[0-9a-fA-F-]{36})/submit',
			array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'submit' ), 'permission_callback' => $public )
		);
		register_rest_route(
			self::NAMESPACE,
			'/applications/(?P<id>[0-9a-fA-F-]{36})/outcome',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'record_outcome' ),
				'permission_callback' => static fn(): bool => current_user_can( 'manage_options' ),
			)
		);
	}

	public function create_draft( WP_REST_Request $request ): array|WP_Error {
		$params = (array) $request->get_json_params();
		$check  = $this->verify_turnstile( (string) ( $params['turnstileToken'] ?? '' ), $this->client_ip() );
		if ( is_wp_error( $check ) ) {
			return $check;
		}
		return $this->service->create_draft( $this->client_ip() );
	}

	public function get_draft( WP_REST_Request $request ): array|WP_Error {
		return $this->service->get_draft( (string) $request['id'], $this->bearer( $request ) );
	}

	public function save_draft( WP_REST_Request $request ): array|WP_Error {
		return $this->service->save_draft( (string) $request['id'], $this->bearer( $request ), $request->get_json_params() );
	}

	public function send_resume_link( WP_REST_Request $request ): array|WP_Error {
		return $this->service->send_resume_link( (string) $request['id'], $this->bearer( $request ) );
	}

	public function upload( WP_REST_Request $request ): array|WP_Error {
		$files = $request->get_file_params();
		if ( ! $this->storage->is_configured() ) {
			return new WP_Error( 'UPLOAD_STORAGE_UNAVAILABLE', 'Private upload storage is not configured.', array( 'status' => 503 ) );
		}
		if ( ! isset( $files['file'] ) || ! is_array( $files['file'] ) ) {
			return new WP_Error( 'UPLOAD_FAILED', 'Select a file to upload.', array( 'status' => 400 ) );
		}
		return $this->service->upload( (string) $request['id'], $this->bearer( $request ), $files['file'] );
	}

	public function remove_upload( WP_REST_Request $request ): array|WP_Error {
		return $this->service->remove_upload( (string) $request['id'], $this->bearer( $request ), (string) $request['upload_id'] );
	}

	public function submit( WP_REST_Request $request ): array|WP_Error {
		return $this->service->submit( (string) $request['id'], $this->bearer( $request ), $request->get_json_params() );
	}

	public function record_outcome( WP_REST_Request $request ): array|WP_Error {
		$params = (array) $request->get_json_params();
		return $this->service->record_outcome(
			(string) $request['id'],
			(string) ( $params['outcome'] ?? '' ),
			(string) ( $params['serviceM8Reference'] ?? '' ),
			true === ( $params['applicantContacted'] ?? false )
		);
	}

	private function bearer( WP_REST_Request $request ): string {
		$header = (string) $request->get_header( 'authorization' );
		return 1 === preg_match( '/^Bearer\s+([^\s]+)$/i', $header, $matches ) ? $matches[1] : '';
	}

	private function client_ip(): string {
		return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
	}

	private function verify_turnstile( string $token, string $remote_ip ): bool|WP_Error {
		if ( ! defined( 'RG_PS1_TURNSTILE_SECRET_KEY' ) || '' === (string) RG_PS1_TURNSTILE_SECRET_KEY ) {
			return new WP_Error( 'ABUSE_CHECK_CONFIGURATION_REQUIRED', 'The security check is not configured.', array( 'status' => 503 ) );
		}
		if ( '' === $token ) {
			return new WP_Error( 'ABUSE_CHECK_FAILED', 'Complete the security check and try again.', array( 'status' => 403 ) );
		}
		$response = wp_remote_post(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			array(
				'timeout' => 10,
				'body'    => array( 'secret' => (string) RG_PS1_TURNSTILE_SECRET_KEY, 'response' => $token, 'remoteip' => $remote_ip ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'ABUSE_CHECK_UNAVAILABLE', 'The security check is temporarily unavailable.', array( 'status' => 503 ) );
		}
		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		return true === ( $body['success'] ?? false )
			? true
			: new WP_Error( 'ABUSE_CHECK_FAILED', 'Complete the security check and try again.', array( 'status' => 403 ) );
	}
}
