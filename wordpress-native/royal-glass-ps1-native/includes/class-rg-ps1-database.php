<?php
/**
 * Dedicated persistence for PS1 applications.
 *
 * @package RoyalGlassPS1Native
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RG_PS1_Database {
	public const SCHEMA_VERSION      = '3';
	public const MAX_EMAIL_ATTEMPTS  = 5;

	private wpdb $wpdb;

	public function __construct( wpdb $wpdb ) {
		$this->wpdb = $wpdb;
	}

	public function table( string $name ): string {
		$tables = array(
			'applications'   => 'rg_ps1_applications',
			'uploads'        => 'rg_ps1_uploads',
			'email_outbox'   => 'rg_ps1_email_outbox',
			'rate_limits'    => 'rg_ps1_rate_limits',
			'status_history' => 'rg_ps1_status_history',
		);
		if ( ! isset( $tables[ $name ] ) ) {
			throw new InvalidArgumentException( 'Unknown PS1 table.' );
		}
		return $this->wpdb->prefix . $tables[ $name ];
	}

	public function install(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $this->wpdb->get_charset_collate();

		$applications = $this->table( 'applications' );
		$uploads      = $this->table( 'uploads' );
		$outbox       = $this->table( 'email_outbox' );
		$rate_limits  = $this->table( 'rate_limits' );
		$history      = $this->table( 'status_history' );

		dbDelta( "CREATE TABLE {$applications} (
			id char(36) NOT NULL,
			reference varchar(32) NULL,
			status varchar(40) NOT NULL DEFAULT 'draft',
			resume_token_hash char(64) NOT NULL,
			payload longtext NOT NULL,
			draft_expires_at datetime NULL,
			submitted_at datetime NULL,
			review_escalated_at datetime NULL,
			outcome_confirmed_at datetime NULL,
			retention_expires_at datetime NULL,
			servicem8_reference varchar(100) NULL,
			locked_at datetime NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY reference (reference),
			KEY status (status),
			KEY draft_expires_at (draft_expires_at),
			KEY review_escalated_at (review_escalated_at),
			KEY retention_expires_at (retention_expires_at)
		) {$charset};" );

		dbDelta( "CREATE TABLE {$uploads} (
			id char(36) NOT NULL,
			application_id char(36) NOT NULL,
			original_name varchar(255) NOT NULL,
			stored_name varchar(255) NOT NULL,
			content_type varchar(100) NOT NULL,
			size_bytes bigint unsigned NOT NULL,
			status varchar(30) NOT NULL DEFAULT 'ready',
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY stored_name (stored_name),
			KEY application_id (application_id)
		) {$charset};" );

		dbDelta( "CREATE TABLE {$outbox} (
			id char(36) NOT NULL,
			application_id char(36) NOT NULL,
			kind varchar(50) NOT NULL,
			to_addresses longtext NOT NULL,
			reply_to varchar(320) NULL,
			subject varchar(255) NOT NULL,
			text_body longtext NOT NULL,
			html_body longtext NOT NULL,
			attachment_ids longtext NOT NULL,
			attempts int unsigned NOT NULL DEFAULT 0,
			available_at datetime NOT NULL,
			sent_at datetime NULL,
			cancelled_at datetime NULL,
			last_error text NULL,
			claim_token char(36) NULL,
			claimed_at datetime NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY application_id (application_id),
			KEY pending (sent_at, available_at)
		) {$charset};" );

		dbDelta( "CREATE TABLE {$rate_limits} (
			scope varchar(40) NOT NULL,
			key_hash char(64) NOT NULL,
			window_started_at datetime NOT NULL,
			request_count int unsigned NOT NULL DEFAULT 1,
			expires_at datetime NOT NULL,
			PRIMARY KEY  (scope, key_hash, window_started_at),
			KEY expires_at (expires_at)
		) {$charset};" );

		dbDelta( "CREATE TABLE {$history} (
			id char(36) NOT NULL,
			application_id char(36) NOT NULL,
			from_status varchar(40) NULL,
			to_status varchar(40) NOT NULL,
			actor_type varchar(20) NOT NULL,
			actor_id varchar(100) NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY application_id (application_id)
		) {$charset};" );

		update_option( 'rg_ps1_native_schema_version', self::SCHEMA_VERSION, false );
	}

	public function transaction( callable $operation ): mixed {
		$this->wpdb->query( 'START TRANSACTION' );
		try {
			$result = $operation();
			if ( is_wp_error( $result ) || false === $result ) {
				$this->wpdb->query( 'ROLLBACK' );
				return $result;
			}
			$this->wpdb->query( 'COMMIT' );
			return $result;
		} catch ( Throwable $error ) {
			$this->wpdb->query( 'ROLLBACK' );
			throw $error;
		}
	}

	public function create_application( array $record ): bool {
		return false !== $this->wpdb->insert(
			$this->table( 'applications' ),
			array(
				'id'                => $record['id'],
				'reference'         => null,
				'status'            => 'draft',
				'resume_token_hash' => $record['resume_token_hash'],
				'payload'           => '{}',
				'draft_expires_at'  => $record['draft_expires_at'],
				'created_at'        => $record['created_at'],
				'updated_at'        => $record['created_at'],
			),
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' )
		);
	}

	public function find_application( string $id ): ?array {
		$sql = $this->wpdb->prepare( 'SELECT * FROM ' . $this->table( 'applications' ) . ' WHERE id = %s LIMIT 1', $id );
		$row = $this->wpdb->get_row( $sql, ARRAY_A );
		return is_array( $row ) ? $row : null;
	}

	public function save_draft( string $id, array $payload, string $expires_at, string $updated_at ): bool {
		$updated = $this->wpdb->query(
			$this->wpdb->prepare(
				'UPDATE ' . $this->table( 'applications' ) . ' SET payload = %s, draft_expires_at = %s, updated_at = %s WHERE id = %s AND status = %s',
				wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
				$expires_at,
				$updated_at,
				$id,
				'draft'
			)
		);
		if ( false === $updated ) {
			return false;
		}
		if ( 1 === $updated ) {
			return true;
		}
		$current = $this->find_application( $id );
		return is_array( $current ) && 'draft' === $current['status'];
	}

	public function submit_application( string $id, array $payload, string $reference, string $now ): bool {
		$updated = $this->wpdb->query(
			$this->wpdb->prepare(
				'UPDATE ' . $this->table( 'applications' ) . ' SET payload = %s, reference = %s, status = %s, submitted_at = %s, locked_at = %s, draft_expires_at = NULL, updated_at = %s WHERE id = %s AND status = %s',
				wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
				$reference,
				'submitted',
				$now,
				$now,
				$now,
				$id,
				'draft'
			)
		);
		return 1 === $updated;
	}

	public function create_upload( array $record ): bool {
		return false !== $this->wpdb->insert( $this->table( 'uploads' ), $record );
	}

	public function upload_capacity_for_update( string $application_id ): array|WP_Error {
		$application = $this->wpdb->get_row(
			$this->wpdb->prepare(
				'SELECT status FROM ' . $this->table( 'applications' ) . ' WHERE id = %s LIMIT 1 FOR UPDATE',
				$application_id
			),
			ARRAY_A
		);
		if ( ! is_array( $application ) || 'draft' !== $application['status'] ) {
			return new WP_Error( 'APPLICATION_LOCKED', 'The submitted application is locked.', array( 'status' => 409 ) );
		}
		$usage = $this->wpdb->get_row(
			$this->wpdb->prepare(
				'SELECT COUNT(*) AS file_count, COALESCE(SUM(size_bytes), 0) AS total_bytes FROM ' . $this->table( 'uploads' ) . ' WHERE application_id = %s AND status = %s',
				$application_id,
				'ready'
			),
			ARRAY_A
		);
		if ( ! is_array( $usage ) ) {
			return new WP_Error( 'PERSISTENCE_FAILED', 'Upload capacity could not be checked.', array( 'status' => 503 ) );
		}
		return array( 'file_count' => (int) $usage['file_count'], 'total_bytes' => (int) $usage['total_bytes'] );
	}

	public function find_upload( string $application_id, string $upload_id ): ?array {
		$sql = $this->wpdb->prepare(
			'SELECT * FROM ' . $this->table( 'uploads' ) . ' WHERE id = %s AND application_id = %s LIMIT 1',
			$upload_id,
			$application_id
		);
		$row = $this->wpdb->get_row( $sql, ARRAY_A );
		return is_array( $row ) ? $row : null;
	}

	public function uploads_for_application( string $application_id ): array {
		$sql = $this->wpdb->prepare(
			'SELECT * FROM ' . $this->table( 'uploads' ) . ' WHERE application_id = %s AND status = %s ORDER BY created_at ASC',
			$application_id,
			'ready'
		);
		return $this->wpdb->get_results( $sql, ARRAY_A );
	}

	public function all_uploads_for_application( string $application_id ): array {
		return $this->wpdb->get_results(
			$this->wpdb->prepare(
				'SELECT * FROM ' . $this->table( 'uploads' ) . ' WHERE application_id = %s ORDER BY created_at ASC',
				$application_id
			),
			ARRAY_A
		);
	}

	public function delete_upload( string $application_id, string $upload_id ): bool {
		return false !== $this->wpdb->delete(
			$this->table( 'uploads' ),
			array( 'id' => $upload_id, 'application_id' => $application_id ),
			array( '%s', '%s' )
		);
	}

	public function enqueue_email( array $record ): bool {
		return false !== $this->wpdb->insert( $this->table( 'email_outbox' ), $record );
	}

	public function claim_due_emails( int $limit = 10 ): array {
		$token = wp_generate_uuid4();
		$now   = gmdate( 'Y-m-d H:i:s' );
		$stale = gmdate( 'Y-m-d H:i:s', time() - 15 * MINUTE_IN_SECONDS );
		$outbox = $this->table( 'email_outbox' );
		$applications = $this->table( 'applications' );
		$this->wpdb->query( 'START TRANSACTION' );
		try {
			$sql = $this->wpdb->prepare(
				"SELECT outbox.id FROM {$outbox} outbox LEFT JOIN {$applications} application ON application.id = outbox.application_id
				WHERE outbox.sent_at IS NULL AND outbox.cancelled_at IS NULL AND outbox.attempts < %d AND outbox.available_at <= %s
				AND (outbox.claimed_at IS NULL OR outbox.claimed_at < %s)
				AND (outbox.kind <> 'draft_resume' OR (application.status = 'draft' AND application.draft_expires_at >= %s))
				ORDER BY outbox.created_at ASC LIMIT %d FOR UPDATE",
				self::MAX_EMAIL_ATTEMPTS,
				$now,
				$stale,
				$now,
				$limit
			);
			$ids = $this->wpdb->get_col( $sql );
			if ( $ids ) {
				$placeholders = implode( ',', array_fill( 0, count( $ids ), '%s' ) );
				$params       = array_merge( array( $token, $now ), $ids );
				$this->wpdb->query(
					$this->wpdb->prepare(
						"UPDATE {$outbox} SET claim_token = %s, claimed_at = %s WHERE id IN ({$placeholders})",
						...$params
					)
				);
			}
			$this->wpdb->query( 'COMMIT' );
		} catch ( Throwable $error ) {
			$this->wpdb->query( 'ROLLBACK' );
			throw $error;
		}
		if ( ! $ids ) {
			return array();
		}
		return $this->wpdb->get_results(
			$this->wpdb->prepare( 'SELECT * FROM ' . $this->table( 'email_outbox' ) . ' WHERE claim_token = %s', $token ),
			ARRAY_A
		);
	}

	public function mark_email_sent( string $id ): void {
		$this->wpdb->update(
			$this->table( 'email_outbox' ),
			array( 'sent_at' => gmdate( 'Y-m-d H:i:s' ), 'claim_token' => null, 'claimed_at' => null, 'last_error' => null ),
			array( 'id' => $id )
		);
	}

	public function mark_email_failed( string $id, int $attempts, string $message ): void {
		if ( $attempts >= self::MAX_EMAIL_ATTEMPTS ) {
			$this->wpdb->update(
				$this->table( 'email_outbox' ),
				array(
					'to_addresses'  => '[]',
					'reply_to'      => null,
					'subject'       => 'Delivery cancelled',
					'text_body'     => '',
					'html_body'     => '',
					'attachment_ids'=> '[]',
					'attempts'      => $attempts,
					'cancelled_at'  => gmdate( 'Y-m-d H:i:s' ),
					'last_error'    => mb_substr( $message, 0, 1000 ),
					'claim_token'   => null,
					'claimed_at'    => null,
				),
				array( 'id' => $id )
			);
			return;
		}
		$delay = min( DAY_IN_SECONDS, (int) pow( 2, min( $attempts, 10 ) ) * 60 );
		$this->wpdb->update(
			$this->table( 'email_outbox' ),
			array(
				'attempts'     => $attempts,
				'available_at' => gmdate( 'Y-m-d H:i:s', time() + $delay ),
				'last_error'   => mb_substr( $message, 0, 1000 ),
				'claim_token'  => null,
				'claimed_at'   => null,
			),
			array( 'id' => $id )
		);
	}

	public function consume_rate_limit( string $scope, string $key_hash, int $maximum, int $window_seconds ): bool|WP_Error {
		$now          = time();
		$window_start = $now - ( $now % $window_seconds );
		$started_at   = gmdate( 'Y-m-d H:i:s', $window_start );
		$expires_at   = gmdate( 'Y-m-d H:i:s', $window_start + $window_seconds );
		$table        = $this->table( 'rate_limits' );

		$written = $this->wpdb->query(
			$this->wpdb->prepare(
				"INSERT INTO {$table} (scope, key_hash, window_started_at, request_count, expires_at)
				VALUES (%s, %s, %s, 1, %s)
				ON DUPLICATE KEY UPDATE request_count = request_count + 1",
				$scope,
				$key_hash,
				$started_at,
				$expires_at
			)
		);
		if ( false === $written ) {
			return new WP_Error( 'RATE_LIMIT_PERSISTENCE_FAILED', 'Request safety could not be verified.', array( 'status' => 503 ) );
		}
		$count = $this->wpdb->get_var(
			$this->wpdb->prepare(
				"SELECT request_count FROM {$table} WHERE scope = %s AND key_hash = %s AND window_started_at = %s",
				$scope,
				$key_hash,
				$started_at
			)
		);
		if ( null === $count ) {
			return new WP_Error( 'RATE_LIMIT_PERSISTENCE_FAILED', 'Request safety could not be verified.', array( 'status' => 503 ) );
		}
		return (int) $count <= $maximum;
	}

	public function expired_drafts( int $limit = 25 ): array {
		return $this->wpdb->get_results(
			$this->wpdb->prepare(
				'SELECT id FROM ' . $this->table( 'applications' ) . ' WHERE status = %s AND draft_expires_at < %s LIMIT %d',
				'draft',
				gmdate( 'Y-m-d H:i:s' ),
				$limit
			),
			ARRAY_A
		);
	}

	public function applications_due_review_escalation( string $cutoff, int $limit = 25 ): array {
		return $this->wpdb->get_results(
			$this->wpdb->prepare(
				'SELECT id, reference FROM ' . $this->table( 'applications' ) . ' WHERE status = %s AND submitted_at <= %s AND review_escalated_at IS NULL ORDER BY submitted_at ASC LIMIT %d',
				'submitted',
				$cutoff,
				$limit
			),
			ARRAY_A
		);
	}

	public function mark_review_escalated( string $id, string $now ): bool {
		$updated = $this->wpdb->query(
			$this->wpdb->prepare(
				'UPDATE ' . $this->table( 'applications' ) . ' SET review_escalated_at = %s, updated_at = %s WHERE id = %s AND status = %s AND review_escalated_at IS NULL',
				$now,
				$now,
				$id,
				'submitted'
			)
		);
		return 1 === $updated;
	}

	public function record_outcome( string $id, string $outcome, string $servicem8_reference, string $confirmed_at, string $retention_expires_at ): bool {
		$updated = $this->wpdb->query(
			$this->wpdb->prepare(
				'UPDATE ' . $this->table( 'applications' ) . ' SET status = %s, servicem8_reference = %s, outcome_confirmed_at = %s, retention_expires_at = %s, updated_at = %s WHERE id = %s AND status = %s',
				$outcome,
				$servicem8_reference,
				$confirmed_at,
				$retention_expires_at,
				$confirmed_at,
				$id,
				'submitted'
			)
		);
		if ( 1 !== $updated ) {
			return false;
		}
		return false !== $this->wpdb->insert(
			$this->table( 'status_history' ),
			array(
				'id'             => wp_generate_uuid4(),
				'application_id' => $id,
				'from_status'    => 'submitted',
				'to_status'      => $outcome,
				'actor_type'     => 'staff',
				'actor_id'       => (string) get_current_user_id(),
				'created_at'     => $confirmed_at,
			)
		);
	}

	public function applications_due_intake_expiry( string $pending_cutoff, string $now, int $limit = 25 ): array {
		return $this->wpdb->get_results(
			$this->wpdb->prepare(
				"SELECT id, status FROM " . $this->table( 'applications' ) . " WHERE (status = 'submitted' AND submitted_at <= %s) OR (status IN ('accepted', 'unaccepted') AND retention_expires_at <= %s) ORDER BY updated_at ASC LIMIT %d",
				$pending_cutoff,
				$now,
				$limit
			),
			ARRAY_A
		);
	}

	public function delete_application_outbox( string $application_id ): bool {
		return false !== $this->wpdb->delete(
			$this->table( 'email_outbox' ),
			array( 'application_id' => $application_id ),
			array( '%s' )
		);
	}

	public function delete_application_upload_records( string $application_id ): bool {
		return false !== $this->wpdb->delete(
			$this->table( 'uploads' ),
			array( 'application_id' => $application_id ),
			array( '%s' )
		);
	}

	public function expire_intake( string $id, string $expected_status, string $now ): bool {
		$updated = $this->wpdb->query(
			$this->wpdb->prepare(
				'UPDATE ' . $this->table( 'applications' ) . ' SET status = %s, payload = %s, resume_token_hash = %s, servicem8_reference = NULL, updated_at = %s WHERE id = %s AND status = %s',
				'expired_intake',
				'{}',
				str_repeat( '0', 64 ),
				$now,
				$id,
				$expected_status
			)
		);
		return 1 === $updated;
	}

	public function expire_draft( string $id ): bool {
		$updated = $this->wpdb->query(
			$this->wpdb->prepare(
				'UPDATE ' . $this->table( 'applications' ) . ' SET status = %s, payload = %s, resume_token_hash = %s, updated_at = %s WHERE id = %s AND status = %s',
				'expired_draft',
				'{}',
				str_repeat( '0', 64 ),
				gmdate( 'Y-m-d H:i:s' ),
				$id,
				'draft'
			)
		);
		return 1 === $updated;
	}

	public function delete_draft_resume_emails( string $application_id ): bool {
		return false !== $this->wpdb->delete(
			$this->table( 'email_outbox' ),
			array( 'application_id' => $application_id, 'kind' => 'draft_resume' ),
			array( '%s', '%s' )
		);
	}

	public function delete_expired_outbox(): void {
		$this->wpdb->query(
			$this->wpdb->prepare(
				'DELETE FROM ' . $this->table( 'email_outbox' ) . ' WHERE (sent_at IS NOT NULL AND sent_at < %s) OR (cancelled_at IS NOT NULL AND cancelled_at < %s)',
				gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS ),
				gmdate( 'Y-m-d H:i:s', time() - 7 * DAY_IN_SECONDS )
			)
		);
	}

	public function delete_expired_rate_limits(): void {
		$this->wpdb->query(
			$this->wpdb->prepare( 'DELETE FROM ' . $this->table( 'rate_limits' ) . ' WHERE expires_at < %s', gmdate( 'Y-m-d H:i:s' ) )
		);
	}
}
