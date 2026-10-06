<?php
/**
 * Isolated WordPress Playground integration assertions.
 */

function rg_ps1_test_fail( string $message ): never {
	fwrite( STDERR, "FAIL: {$message}\n" );
	exit( 1 );
}

error_reporting( E_ALL );
ini_set( 'display_errors', '1' );
echo "STAGE: syntax\n";

$php_files = array_merge(
	glob( '/wordpress/wp-content/plugins/royal-glass-ps1-native/*.php' ),
	glob( '/wordpress/wp-content/plugins/royal-glass-ps1-native/includes/*.php' )
);
foreach ( $php_files as $php_file ) {
	try {
		token_get_all( (string) file_get_contents( $php_file ), TOKEN_PARSE );
	} catch ( ParseError $error ) {
		rg_ps1_test_fail( basename( $php_file ) . ': ' . $error->getMessage() );
	}
}

define( 'RG_PS1_RATE_LIMIT_SECRET', str_repeat( 'p', 32 ) );
define( 'RG_PS1_PRIVATE_UPLOAD_DIR', '/tmp/rg-ps1-private-uploads' );
define( 'RG_PS1_SERVICEM8_EMAIL', 'servicem8@example.test' );
define( 'RG_PS1_TURNSTILE_SITE_KEY', 'test-site-key' );
define( 'RG_PS1_TURNSTILE_SECRET_KEY', 'test-secret-key' );

echo "STAGE: WordPress boot\n";
require_once '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';

echo "STAGE: activation\n";
$plugin = 'royal-glass-ps1-native/royal-glass-ps1-native.php';
$validation = validate_plugin( $plugin );
if ( is_wp_error( $validation ) ) {
	rg_ps1_test_fail( 'Plugin validation failed: ' . $validation->get_error_message() );
}
echo "STAGE: plugin validated\n";
require_once WP_PLUGIN_DIR . '/' . $plugin;
echo "STAGE: plugin loaded\n";
RG_PS1_Native_Plugin::activate();
echo "STAGE: activation hook complete\n";
RG_PS1_Native_Plugin::instance();

global $wpdb;
echo "STAGE: schema\n";
foreach ( array( 'applications', 'uploads', 'email_outbox', 'rate_limits', 'status_history' ) as $suffix ) {
	$table = $wpdb->prefix . 'rg_ps1_' . $suffix;
	if ( $table !== $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) ) {
		rg_ps1_test_fail( "Missing database table {$table}." );
	}
}

do_action( 'rest_api_init' );
echo "STAGE: routes and shortcode\n";
$routes = rest_get_server()->get_routes();
foreach (
	array(
		'/royal-glass-ps1/v1/applications/drafts',
		'/royal-glass-ps1/v1/applications/drafts/(?P<id>[0-9a-fA-F-]{36})',
		'/royal-glass-ps1/v1/applications/drafts/(?P<id>[0-9a-fA-F-]{36})/submit',
	) as $route
) {
	if ( ! isset( $routes[ $route ] ) ) {
		rg_ps1_test_fail( "Missing REST route {$route}." );
	}
}

$shortcode = do_shortcode( '[royal_glass_ps1]' );
if ( ! str_contains( $shortcode, 'data-rg-ps1-native' ) || str_contains( strtolower( $shortcode ), '<iframe' ) ) {
	rg_ps1_test_fail( 'Shortcode is not a direct native mount.' );
}
$module_tag = apply_filters( 'script_loader_tag', '<script src="app.js"></script>', 'royal-glass-ps1-native', 'app.js' );
if ( ! str_contains( $module_tag, 'type="module"' ) ) {
	rg_ps1_test_fail( 'Frontend script is not emitted as an ES module.' );
}

$database  = new RG_PS1_Database( $wpdb );
$storage   = new RG_PS1_Storage();
$mailer    = new RG_PS1_Mailer( $database, $storage );
$service   = new RG_PS1_Service( $database, new RG_PS1_Validator(), $storage, $mailer );
echo "STAGE: draft authorization\n";
$created   = $service->create_draft( '192.0.2.10' );
if ( is_wp_error( $created ) ) {
	rg_ps1_test_fail( 'Draft creation failed: ' . $created->get_error_message() );
}
$restored = $service->get_draft( $created['id'], $created['resumeToken'] );
if ( is_wp_error( $restored ) || $created['id'] !== $restored['id'] || array() !== $restored['uploads'] ) {
	rg_ps1_test_fail( 'Draft token round-trip failed.' );
}
$draft_payload = array(
	'need'      => 'ps1',
	'applicant' => array( 'name' => 'Test Applicant', 'email' => 'applicant@example.test' ),
	'project'   => array(),
	'design'    => array(),
	'site'      => array( 'locations' => array() ),
);
$saved_once = $service->save_draft( $created['id'], $created['resumeToken'], $draft_payload );
$saved_twice = $service->save_draft( $created['id'], $created['resumeToken'], $draft_payload );
if ( is_wp_error( $saved_once ) || is_wp_error( $saved_twice ) ) {
	rg_ps1_test_fail( 'Idempotent draft save failed.' );
}
$resume_one = $service->send_resume_link( $created['id'], $created['resumeToken'] );
$resume_two = $service->send_resume_link( $created['id'], $created['resumeToken'] );
$resume_three = $service->send_resume_link( $created['id'], $created['resumeToken'] );
if ( is_wp_error( $resume_one ) || is_wp_error( $resume_two ) || ! is_wp_error( $resume_three ) || 429 !== $resume_three->get_error_data()['status'] ) {
	rg_ps1_test_fail( 'Resume-email cooldown failed.' );
}
$rejected = $service->get_draft( $created['id'], 'incorrect-token' );
if ( ! is_wp_error( $rejected ) || 404 !== $rejected->get_error_data()['status'] ) {
	rg_ps1_test_fail( 'Invalid bearer token was not rejected.' );
}

echo "PASS: activation, schema, routes, shortcode, module loading, and draft authorization\n";
