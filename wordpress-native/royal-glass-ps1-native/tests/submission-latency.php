<?php
/**
 * Verifies that a slow WordPress cron transport cannot delay submission acknowledgement.
 */

function rg_ps1_latency_fail( string $message ): never {
	throw new RuntimeException( "FAIL: {$message}" );
}

error_reporting( E_ALL );
ini_set( 'display_errors', '1' );
define( 'WP_DISABLE_FATAL_ERROR_HANDLER', true );
define( 'RG_PS1_RATE_LIMIT_SECRET', str_repeat( 'l', 32 ) );
define( 'RG_PS1_PRIVATE_UPLOAD_DIR', '/tmp/rg-ps1-latency-uploads' );
define( 'RG_PS1_SERVICEM8_EMAIL', 'review@example.test' );

require_once '/wordpress/wp-load.php';

global $wpdb;
$database = new RG_PS1_Database( $wpdb );
$storage  = new RG_PS1_Storage();
$mailer   = new RG_PS1_Mailer( $database, $storage );
$service  = new RG_PS1_Service( $database, new RG_PS1_Validator(), $storage, $mailer );

$created = $service->create_draft( '192.0.2.41' );
if ( is_wp_error( $created ) ) {
	rg_ps1_latency_fail( 'Draft creation failed: ' . $created->get_error_message() );
}

$submission = array(
	'need'      => 'ps1',
	'applicant' => array(
		'name'   => 'Latency Tester',
		'mobile' => '021 123 4567',
		'email'  => 'latency@example.test',
		'role'   => 'homeowner',
	),
	'project'   => array(
		'address'               => '12 Queen Street, Auckland',
		'buildingConsentNumber' => '',
		'resourceConsentNumber' => '',
		'estimatedInstallation' => '3_months',
		'stage'                 => 'preparing_consent',
	),
	'design'    => array( 'family' => 'balustrade', 'system' => 'double-disc' ),
	'site'      => array(
		'substrate' => 'concrete',
		'locations' => array( array( 'types' => array( 'deck' ), 'environment' => 'external', 'other' => '' ) ),
	),
	'acknowledgement' => array( 'accepted' => true ),
);

delete_transient( 'doing_cron' );
$cron_request_started = false;
$slow_cron_transport = static function ( $preempt, array $arguments, string $url ) use ( &$cron_request_started ) {
	if ( str_contains( $url, 'wp-cron.php' ) ) {
		$cron_request_started = true;
		usleep( 400000 );
		return new WP_Error( 'TEST_SLOW_CRON', 'Simulated slow cron transport.' );
	}
	return $preempt;
};
add_filter( 'pre_http_request', $slow_cron_transport, 10, 3 );

$started = microtime( true );
$result  = $service->submit( $created['id'], $created['resumeToken'], $submission );
$submit_elapsed = microtime( true ) - $started;

if ( is_wp_error( $result ) ) {
	rg_ps1_latency_fail( 'Submission failed: ' . $result->get_error_message() );
}
if ( $cron_request_started || $submit_elapsed >= 0.2 ) {
	rg_ps1_latency_fail( sprintf( 'Submission waited for cron transport (%.3f seconds).', $submit_elapsed ) );
}
if ( false === has_action( 'shutdown', array( $mailer, 'spawn_scheduled_dispatch' ) ) ) {
	rg_ps1_latency_fail( 'Submission did not defer cron spawning until shutdown.' );
}

$started = microtime( true );
$mailer->spawn_scheduled_dispatch();
$dispatch_elapsed = microtime( true ) - $started;

remove_action( 'shutdown', array( $mailer, 'spawn_scheduled_dispatch' ), PHP_INT_MAX );
remove_filter( 'pre_http_request', $slow_cron_transport, 10 );
wp_clear_scheduled_hook( 'rg_ps1_native_mail_outbox_immediate' );

if ( ! $cron_request_started || $dispatch_elapsed < 0.35 ) {
	rg_ps1_latency_fail( 'The slow cron transport was not isolated behind the deferred callback.' );
}

echo "PASS: submission acknowledgement precedes slow cron transport\n";
