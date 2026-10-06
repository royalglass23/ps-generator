<?php
/**
 * Plugin Name: Royal Glass PS1 Application (Native)
 * Description: Runs the Royal Glass PS1 application directly in WordPress without an iframe or external application host.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: Royal Glass
 * Text Domain: royal-glass-ps1-native
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'RG_PS1_NATIVE_VERSION', '0.1.0' );
define( 'RG_PS1_NATIVE_FILE', __FILE__ );
define( 'RG_PS1_NATIVE_DIR', plugin_dir_path( __FILE__ ) );
define( 'RG_PS1_NATIVE_URL', plugin_dir_url( __FILE__ ) );

require_once RG_PS1_NATIVE_DIR . 'includes/class-rg-ps1-database.php';
require_once RG_PS1_NATIVE_DIR . 'includes/class-rg-ps1-storage.php';
require_once RG_PS1_NATIVE_DIR . 'includes/class-rg-ps1-validator.php';
require_once RG_PS1_NATIVE_DIR . 'includes/class-rg-ps1-mailer.php';
require_once RG_PS1_NATIVE_DIR . 'includes/class-rg-ps1-service.php';
require_once RG_PS1_NATIVE_DIR . 'includes/class-rg-ps1-rest-controller.php';

final class RG_PS1_Native_Plugin {
	private static ?self $instance = null;
	private RG_PS1_Database $database;
	private RG_PS1_Storage $storage;
	private RG_PS1_Mailer $mailer;
	private RG_PS1_Service $service;
	private RG_PS1_REST_Controller $rest;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		global $wpdb;
		$this->database = new RG_PS1_Database( $wpdb );
		$this->storage  = new RG_PS1_Storage();
		$this->mailer   = new RG_PS1_Mailer( $this->database, $this->storage );
		$this->service  = new RG_PS1_Service( $this->database, new RG_PS1_Validator(), $this->storage, $this->mailer );
		$this->rest     = new RG_PS1_REST_Controller( $this->service, $this->storage );

		add_action( 'rest_api_init', array( $this->rest, 'register_routes' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_page_assets' ), 1 );
		add_filter( 'script_loader_tag', array( $this, 'module_script_tag' ), 10, 3 );
		add_shortcode( 'royal_glass_ps1', array( $this, 'shortcode' ) );
		add_action( 'rg_ps1_native_cleanup', array( $this->service, 'cleanup' ) );
		add_action( 'rg_ps1_native_mail_outbox', array( $this->mailer, 'dispatch_due' ) );
		add_action( 'admin_notices', array( $this, 'configuration_notice' ) );
	}

	public static function activate(): void {
		global $wpdb;
		( new RG_PS1_Database( $wpdb ) )->install();
		if ( ! wp_next_scheduled( 'rg_ps1_native_cleanup' ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'rg_ps1_native_cleanup' );
		}
		if ( ! wp_next_scheduled( 'rg_ps1_native_mail_outbox' ) ) {
			wp_schedule_event( time() + 5 * MINUTE_IN_SECONDS, 'hourly', 'rg_ps1_native_mail_outbox' );
		}
	}

	public static function deactivate(): void {
		wp_clear_scheduled_hook( 'rg_ps1_native_cleanup' );
		wp_clear_scheduled_hook( 'rg_ps1_native_mail_outbox' );
	}

	public function enqueue_page_assets(): void {
		global $post;
		if ( $post instanceof WP_Post && has_shortcode( $post->post_content, 'royal_glass_ps1' ) ) {
			$this->enqueue_assets();
		}
	}

	private function enqueue_assets(): void {
		static $enqueued = false;
		if ( $enqueued ) {
			return;
		}
		$enqueued = true;
		wp_enqueue_style( 'royal-glass-ps1-native', RG_PS1_NATIVE_URL . 'assets/app.css', array(), RG_PS1_NATIVE_VERSION );
		wp_enqueue_script( 'royal-glass-ps1-native', RG_PS1_NATIVE_URL . 'assets/app.js', array(), RG_PS1_NATIVE_VERSION, true );
		wp_script_add_data( 'royal-glass-ps1-native', 'type', 'module' );
		$config = array(
			'restUrl'          => esc_url_raw( rest_url( 'royal-glass-ps1/v1' ) ),
			'assetUrl'         => esc_url_raw( RG_PS1_NATIVE_URL . 'assets/' ),
			'homeUrl'          => esc_url_raw( home_url( '/' ) ),
			'turnstileSiteKey' => defined( 'RG_PS1_TURNSTILE_SITE_KEY' ) ? (string) RG_PS1_TURNSTILE_SITE_KEY : '',
			'draftId'          => isset( $_GET['application'] ) ? sanitize_text_field( wp_unslash( $_GET['application'] ) ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'uploadsEnabled'   => $this->storage->is_configured(),
		);
		wp_add_inline_script( 'royal-glass-ps1-native', 'window.RoyalGlassPS1=' . wp_json_encode( $config ) . ';', 'before' );
	}

	public function module_script_tag( string $tag, string $handle, string $source ): string {
		if ( 'royal-glass-ps1-native' !== $handle || str_contains( $tag, 'type="module"' ) ) {
			return $tag;
		}
		return str_replace( '<script ', '<script type="module" ', $tag );
	}

	public function shortcode(): string {
		$this->enqueue_assets();
		return '<div class="rg-ps1-native-root" data-rg-ps1-native><noscript><p>JavaScript is required to complete this application.</p></noscript></div>';
	}

	public function configuration_notice(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$missing = array();
		foreach ( array( 'RG_PS1_RATE_LIMIT_SECRET', 'RG_PS1_TURNSTILE_SITE_KEY', 'RG_PS1_TURNSTILE_SECRET_KEY', 'RG_PS1_SERVICEM8_EMAIL' ) as $constant ) {
			if ( ! defined( $constant ) || '' === (string) constant( $constant ) ) {
				$missing[] = $constant;
			}
		}
		if ( ! $this->storage->is_configured() ) {
			$missing[] = 'RG_PS1_PRIVATE_UPLOAD_DIR';
		}
		if ( $missing ) {
			printf(
				'<div class="notice notice-warning"><p><strong>Royal Glass PS1 Native:</strong> Keep the PS1 page unpublished. Configure these wp-config.php constants first: <code>%s</code>.</p></div>',
				esc_html( implode( ', ', $missing ) )
			);
		}
	}
}

register_activation_hook( __FILE__, array( 'RG_PS1_Native_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'RG_PS1_Native_Plugin', 'deactivate' ) );
add_action( 'plugins_loaded', array( 'RG_PS1_Native_Plugin', 'instance' ) );
