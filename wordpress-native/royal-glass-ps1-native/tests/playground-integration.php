<?php
/**
 * Isolated WordPress Playground integration assertions.
 */

function rg_ps1_test_fail( string $message ): never {
	throw new RuntimeException( "FAIL: {$message}" );
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
define( 'RG_PS1_SERVICEM8_EMAIL', 'review@example.test' );
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
		'/royal-glass-ps1/v1/applications/(?P<id>[0-9a-fA-F-]{36})/outcome',
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

echo "STAGE: staff outcome authorization\n";
$outcome_request = static function (): WP_REST_Response {
	$request = new WP_REST_Request( 'POST', '/royal-glass-ps1/v1/applications/00000000-0000-4000-8000-000000000000/outcome' );
	$request->set_header( 'content-type', 'application/json' );
	$request->set_body( wp_json_encode( array( 'outcome' => 'accepted', 'serviceM8Reference' => 'SM8-AUTH-PROBE' ) ) );
	return rest_do_request( $request );
};
wp_set_current_user( 0 );
$anonymous_outcome = $outcome_request();
if ( ! in_array( $anonymous_outcome->get_status(), array( 401, 403 ), true ) ) {
	rg_ps1_test_fail( 'Anonymous user reached the staff outcome endpoint.' );
}
$subscriber_id = wp_create_user( 'rg_ps1_subscriber', wp_generate_password( 24 ), 'subscriber@example.test' );
if ( is_wp_error( $subscriber_id ) ) {
	rg_ps1_test_fail( 'Could not create the subscriber authorization fixture.' );
}
( new WP_User( $subscriber_id ) )->set_role( 'subscriber' );
wp_set_current_user( $subscriber_id );
$subscriber_outcome = $outcome_request();
if ( 403 !== $subscriber_outcome->get_status() ) {
	rg_ps1_test_fail( 'Subscriber reached the staff outcome endpoint.' );
}
$administrator_id = wp_create_user( 'rg_ps1_administrator', wp_generate_password( 24 ), 'administrator@example.test' );
if ( is_wp_error( $administrator_id ) ) {
	rg_ps1_test_fail( 'Could not create the administrator authorization fixture.' );
}
( new WP_User( $administrator_id ) )->set_role( 'administrator' );
wp_set_current_user( $administrator_id );
$administrator_outcome = $outcome_request();
if ( 409 !== $administrator_outcome->get_status() ) {
	rg_ps1_test_fail( 'Administrator did not reach the outcome application-state check.' );
}
wp_set_current_user( 0 );

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

echo "STAGE: direct staff attachment boundary\n";
$mail_id = wp_generate_uuid4();
$mail_created = gmdate( 'Y-m-d H:i:s' );
$database->create_application(
	array(
		'id' => $mail_id, 'resume_token_hash' => str_repeat( 'c', 64 ),
		'draft_expires_at' => gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS ), 'created_at' => $mail_created,
	)
);
$ready_upload_id = wp_generate_uuid4();
$ready_name = wp_generate_uuid4() . '.pdf';
file_put_contents( RG_PS1_PRIVATE_UPLOAD_DIR . '/' . $ready_name, '%PDF-1.7 structurally-valid' );
$upload_record = array(
	'id' => $ready_upload_id, 'application_id' => $mail_id, 'original_name' => 'Council plans (rev 2).pdf',
	'stored_name' => $ready_name, 'content_type' => 'application/pdf', 'size_bytes' => 27,
	'status' => 'ready', 'created_at' => $mail_created,
);
$database->create_upload( $upload_record );
$mail_payload = array(
	'need' => 'ps1',
	'applicant' => array( 'name' => 'Mail Applicant', 'email' => 'applicant@example.test', 'mobile' => '0210000000', 'role' => 'homeowner' ),
	'project' => array( 'address' => '1 Test Street', 'buildingConsentNumber' => '', 'resourceConsentNumber' => '', 'estimatedInstallation' => 'asap', 'stage' => 'concept' ),
	'design' => array( 'family' => 'balustrade', 'system' => 'frameless' ),
	'site' => array( 'substrate' => 'concrete', 'locations' => array() ),
);
if ( ! $mailer->enqueue_submission( $mail_id, 'PS1-TEST-MAIL', $mail_payload, array( $upload_record ) ) ) {
	rg_ps1_test_fail( 'Submission emails were not queued.' );
}
$queued_messages = $wpdb->get_results(
	$wpdb->prepare( 'SELECT kind, attachment_ids FROM ' . $database->table( 'email_outbox' ) . ' WHERE application_id = %s ORDER BY kind ASC', $mail_id ),
	ARRAY_A
);
$attachments_by_kind = array_column( $queued_messages, 'attachment_ids', 'kind' );
if ( wp_json_encode( array( $ready_upload_id ) ) !== ( $attachments_by_kind['submission_internal'] ?? null ) || '[]' !== ( $attachments_by_kind['submission_applicant'] ?? null ) ) {
	rg_ps1_test_fail( 'Staff and applicant attachment boundaries are incorrect.' );
}
$database->enqueue_email(
	array(
		'id' => wp_generate_uuid4(), 'application_id' => $mail_id, 'kind' => 'test_direct_attachment',
		'to_addresses' => wp_json_encode( array( 'review@example.test' ) ), 'reply_to' => null,
		'subject' => 'Direct attachment', 'text_body' => 'Direct attachment', 'html_body' => 'Direct attachment',
		'attachment_ids' => wp_json_encode( array( $ready_upload_id ) ), 'attempts' => 0,
		'available_at' => $mail_created, 'created_at' => $mail_created,
	)
);
$captured_mail = null;
$attachment_exists_during_send = false;
$mail_filter = static function ( $return, array $attributes ) use ( &$captured_mail, &$attachment_exists_during_send ) {
	if ( ! empty( $attributes['attachments'] ) ) {
		$captured_mail = $attributes;
		$attachment_exists_during_send = is_file( $attributes['attachments'][0] );
	}
	return true;
};
add_filter( 'pre_wp_mail', $mail_filter, 10, 2 );
$mailer->dispatch_due();
remove_filter( 'pre_wp_mail', $mail_filter, 10 );
if ( ! is_array( $captured_mail ) || 1 !== count( $captured_mail['attachments'] ) || 'Council plans (rev 2).pdf' !== basename( $captured_mail['attachments'][0] ) || ! $attachment_exists_during_send ) {
	rg_ps1_test_fail( 'Structurally valid upload did not keep its original filename in staff mail.' );
}
if ( file_exists( $captured_mail['attachments'][0] ) ) {
	rg_ps1_test_fail( 'Temporary staff-mail attachment was not deleted after sending.' );
}

echo "STAGE: reviewed outcome retention\n";
$outcome_id = wp_generate_uuid4();
$outcome_token = str_repeat( 'a', 64 );
$created_at = gmdate( 'Y-m-d H:i:s' );
$database->create_application(
	array(
		'id' => $outcome_id,
		'resume_token_hash' => $outcome_token,
		'draft_expires_at' => gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS ),
		'created_at' => $created_at,
	)
);
$database->submit_application( $outcome_id, array( 'applicant' => array() ), 'PS1-TEST-OUTCOME', $created_at );
$outcome = $service->record_outcome( $outcome_id, 'accepted', 'SM8-TEST-1', false );
$outcome_record = $database->find_application( $outcome_id );
if ( is_wp_error( $outcome ) || 'accepted' !== $outcome_record['status'] ) {
	rg_ps1_test_fail( 'Accepted outcome was not recorded.' );
}
$retention_seconds = strtotime( $outcome_record['retention_expires_at'] . ' UTC' ) - time();
if ( $retention_seconds < 7 * DAY_IN_SECONDS - 10 || $retention_seconds > 7 * DAY_IN_SECONDS + 10 ) {
	rg_ps1_test_fail( 'Reviewed intake did not receive a seven-day recovery window.' );
}

echo "STAGE: review escalation\n";
$escalation_id = wp_generate_uuid4();
$old_review = gmdate( 'Y-m-d H:i:s', time() - 15 * DAY_IN_SECONDS );
$database->create_application(
	array(
		'id' => $escalation_id, 'resume_token_hash' => str_repeat( 'd', 64 ),
		'draft_expires_at' => gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS ), 'created_at' => $old_review,
	)
);
$database->submit_application( $escalation_id, array( 'applicant' => array() ), 'PS1-TEST-ESCALATE', $old_review );
$mail_filter = static fn() => true;
add_filter( 'pre_wp_mail', $mail_filter );
$service->cleanup();
remove_filter( 'pre_wp_mail', $mail_filter );
$escalated_record = $database->find_application( $escalation_id );
if ( empty( $escalated_record['review_escalated_at'] ) || 'submitted' !== $escalated_record['status'] ) {
	rg_ps1_test_fail( 'Fourteen-day review escalation was not recorded.' );
}

echo "STAGE: reviewed intake expiry\n";
$wpdb->update(
	$database->table( 'applications' ),
	array( 'retention_expires_at' => gmdate( 'Y-m-d H:i:s', time() - MINUTE_IN_SECONDS ) ),
	array( 'id' => $outcome_id )
);
$service->cleanup();
$outcome_record = $database->find_application( $outcome_id );
if ( 'expired_intake' !== $outcome_record['status'] || '{}' !== $outcome_record['payload'] ) {
	rg_ps1_test_fail( 'Reviewed intake was not scrubbed after its recovery window.' );
}

echo "STAGE: submitted intake retention\n";
$expired_id = wp_generate_uuid4();
$expired_token = str_repeat( 'b', 64 );
$old_submission = gmdate( 'Y-m-d H:i:s', time() - 31 * DAY_IN_SECONDS );
$database->create_application(
	array(
		'id' => $expired_id,
		'resume_token_hash' => $expired_token,
		'draft_expires_at' => gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS ),
		'created_at' => $old_submission,
	)
);
$database->submit_application( $expired_id, array( 'applicant' => array( 'name' => 'Delete Me' ) ), 'PS1-TEST-EXPIRED', $old_submission );
$expired_name = wp_generate_uuid4() . '.pdf';
file_put_contents( RG_PS1_PRIVATE_UPLOAD_DIR . '/' . $expired_name, '%PDF-1.7 retention fixture' );
$database->create_upload(
	array(
		'id' => wp_generate_uuid4(), 'application_id' => $expired_id, 'original_name' => 'private.pdf',
		'stored_name' => $expired_name, 'content_type' => 'application/pdf', 'size_bytes' => 26,
		'status' => 'ready', 'created_at' => $old_submission,
	)
);
$service->cleanup();
$expired_record = $database->find_application( $expired_id );
if ( 'expired_intake' !== $expired_record['status'] || '{}' !== $expired_record['payload'] ) {
	rg_ps1_test_fail( 'Thirty-day intake was not scrubbed.' );
}
if ( file_exists( RG_PS1_PRIVATE_UPLOAD_DIR . '/' . $expired_name ) || array() !== $database->all_uploads_for_application( $expired_id ) ) {
	rg_ps1_test_fail( 'Expired intake upload was not deleted.' );
}

echo "PASS: activation, schema, routes, direct staff attachments, retention, and authorization\n";
