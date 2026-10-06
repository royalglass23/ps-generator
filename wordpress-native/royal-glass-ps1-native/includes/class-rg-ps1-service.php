<?php
/**
 * Application module. Callers use this small interface; persistence, storage and mail stay internal.
 *
 * @package RoyalGlassPS1Native
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RG_PS1_Service {
	private RG_PS1_Database $database;
	private RG_PS1_Validator $validator;
	private RG_PS1_Storage $storage;
	private RG_PS1_Mailer $mailer;

	public function __construct( RG_PS1_Database $database, RG_PS1_Validator $validator, RG_PS1_Storage $storage, RG_PS1_Mailer $mailer ) {
		$this->database  = $database;
		$this->validator = $validator;
		$this->storage   = $storage;
		$this->mailer    = $mailer;
	}

	public function create_draft( string $client_ip ): array|WP_Error {
		$limited = $this->consume_limit( 'draft', $client_ip, 5 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$id      = wp_generate_uuid4();
		$token   = $this->token();
		$expires = time() + DAY_IN_SECONDS;
		$created = $this->database->create_application(
			array(
				'id'                => $id,
				'resume_token_hash' => hash( 'sha256', $token ),
				'draft_expires_at'  => gmdate( 'Y-m-d H:i:s', $expires ),
				'created_at'        => gmdate( 'Y-m-d H:i:s' ),
			)
		);
		if ( ! $created ) {
			return new WP_Error( 'PERSISTENCE_FAILED', 'The application could not be started.', array( 'status' => 500 ) );
		}
		return array(
			'id'          => $id,
			'resumeToken' => $token,
			'expiresAt'   => gmdate( DATE_ATOM, $expires ),
			'resumeUrl'   => $this->resume_url( $id, $token ),
		);
	}

	public function get_draft( string $id, string $token ): array|WP_Error {
		$application = $this->authorize_draft( $id, $token );
		if ( is_wp_error( $application ) ) {
			return $application;
		}
		return array(
			'id'        => $application['id'],
			'status'    => $application['status'],
			'payload'   => $this->decode_payload( $application ),
			'uploads'   => array_map(
				static fn( array $upload ): array => array(
					'id'        => (string) $upload['id'],
					'name'      => (string) $upload['original_name'],
					'sizeBytes' => (int) $upload['size_bytes'],
					'status'    => 'uploaded',
				),
				$this->database->uploads_for_application( $id )
			),
			'expiresAt' => $application['draft_expires_at'] ? gmdate( DATE_ATOM, strtotime( $application['draft_expires_at'] . ' UTC' ) ) : null,
		);
	}

	public function save_draft( string $id, string $token, mixed $payload ): array|WP_Error {
		$application = $this->authorize_draft( $id, $token );
		if ( is_wp_error( $application ) ) {
			return $application;
		}
		$validated = $this->validator->draft( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}
		$expires = time() + DAY_IN_SECONDS;
		if ( ! $this->database->save_draft( $id, $validated, gmdate( 'Y-m-d H:i:s', $expires ), gmdate( 'Y-m-d H:i:s' ) ) ) {
			return new WP_Error( 'APPLICATION_LOCKED', 'The submitted application is locked.', array( 'status' => 409 ) );
		}
		return array( 'expiresAt' => gmdate( DATE_ATOM, $expires ) );
	}

	public function send_resume_link( string $id, string $token ): array|WP_Error {
		$application = $this->authorize_draft( $id, $token );
		if ( is_wp_error( $application ) ) {
			return $application;
		}
		$payload = $this->decode_payload( $application );
		$name    = trim( (string) ( $payload['applicant']['name'] ?? '' ) );
		$email   = sanitize_email( (string) ( $payload['applicant']['email'] ?? '' ) );
		if ( '' === $name || ! is_email( $email ) ) {
			return new WP_Error( 'VALIDATION_FAILED', 'Enter your full name and a valid email address before saving for later.', array( 'status' => 422 ) );
		}
		$limited = $this->consume_limit( 'resume_email', $id . '|' . strtolower( $email ), 2 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$url = $this->resume_url( $id, $token );
		if ( ! $this->mailer->enqueue_resume( $id, $name, $email, $url ) ) {
			return new WP_Error( 'PERSISTENCE_FAILED', 'The resume email could not be queued.', array( 'status' => 500 ) );
		}
		$this->mailer->dispatch_due();
		return array( 'email' => $email, 'resumeUrl' => $url );
	}

	public function upload( string $id, string $token, array $file ): array|WP_Error {
		$application = $this->authorize_draft( $id, $token );
		if ( is_wp_error( $application ) ) {
			return $application;
		}
		$limited = $this->consume_limit( 'upload', $id, 10 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		return $this->database->transaction(
			function () use ( $id, $file ) {
				$usage = $this->database->upload_capacity_for_update( $id );
				if ( is_wp_error( $usage ) ) {
					return $usage;
				}
				if ( $usage['file_count'] >= RG_PS1_Storage::MAX_FILES ) {
					return new WP_Error( 'UPLOAD_LIMIT_REACHED', 'A maximum of five files can be attached.', array( 'status' => 409 ) );
				}
				if ( $usage['total_bytes'] + (int) ( $file['size'] ?? 0 ) > RG_PS1_Storage::MAX_TOTAL_BYTES ) {
					return new WP_Error( 'UPLOAD_TOO_LARGE', 'The combined upload limit is 25 MB.', array( 'status' => 413 ) );
				}
				$stored = $this->storage->store( $file );
				if ( is_wp_error( $stored ) ) {
					return $stored;
				}
				$upload_id = wp_generate_uuid4();
				$record    = array(
					'id'             => $upload_id,
					'application_id' => $id,
					'original_name'  => $stored['original_name'],
					'stored_name'    => $stored['stored_name'],
					'content_type'   => $stored['content_type'],
					'size_bytes'     => $stored['size_bytes'],
					'status'         => 'ready',
					'created_at'     => gmdate( 'Y-m-d H:i:s' ),
				);
				if ( ! $this->database->create_upload( $record ) ) {
					$this->storage->delete( $stored['stored_name'] );
					return new WP_Error( 'PERSISTENCE_FAILED', 'The upload could not be recorded.', array( 'status' => 500 ) );
				}
				return array( 'id' => $upload_id, 'name' => $stored['original_name'], 'sizeBytes' => $stored['size_bytes'] );
			}
		);
	}

	public function remove_upload( string $id, string $token, string $upload_id ): array|WP_Error {
		$application = $this->authorize_draft( $id, $token );
		if ( is_wp_error( $application ) ) {
			return $application;
		}
		$upload = $this->database->find_upload( $id, $upload_id );
		if ( ! $upload ) {
			return new WP_Error( 'UPLOAD_NOT_FOUND', 'The upload was not found.', array( 'status' => 404 ) );
		}
		if ( ! $this->storage->delete( (string) $upload['stored_name'] ) ) {
			return new WP_Error( 'UPLOAD_DELETE_FAILED', 'The upload could not be removed.', array( 'status' => 500 ) );
		}
		$this->database->delete_upload( $id, $upload_id );
		return array( 'removed' => true );
	}

	public function submit( string $id, string $token, mixed $payload ): array|WP_Error {
		$application = $this->authorize_draft( $id, $token );
		if ( is_wp_error( $application ) ) {
			return $application;
		}
		$validated = $this->validator->submission( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}
		$uploads   = $this->database->uploads_for_application( $id );
		$reference = sprintf( 'PS1-%s-%s', gmdate( 'Y' ), strtoupper( substr( str_replace( '-', '', $id ), 0, 8 ) ) );
		$now       = gmdate( 'Y-m-d H:i:s' );
		$result    = $this->database->transaction(
			function () use ( $id, $validated, $reference, $now, $uploads ) {
				if ( ! $this->database->submit_application( $id, $validated, $reference, $now ) ) {
					return new WP_Error( 'APPLICATION_LOCKED', 'The submitted application is locked.', array( 'status' => 409 ) );
				}
				if ( ! $this->mailer->enqueue_submission( $id, $reference, $validated, $uploads ) ) {
					return new WP_Error( 'EMAIL_CONFIGURATION_REQUIRED', 'Application email delivery is not configured.', array( 'status' => 503 ) );
				}
				return true;
			}
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$this->mailer->dispatch_due();
		return array( 'reference' => $reference, 'submittedAt' => gmdate( DATE_ATOM, strtotime( $now . ' UTC' ) ) );
	}

	public function cleanup(): void {
		foreach ( $this->database->expired_drafts() as $record ) {
			$id      = (string) $record['id'];
			$uploads = $this->database->uploads_for_application( $id );
			$all_deleted = true;
			foreach ( $uploads as $upload ) {
				if ( ! $this->storage->delete( (string) $upload['stored_name'] ) ) {
					$all_deleted = false;
					continue;
				}
				$this->database->delete_upload( $id, (string) $upload['id'] );
			}
			if ( $all_deleted ) {
				$this->database->transaction(
					function () use ( $id ) {
						if ( ! $this->database->delete_draft_resume_emails( $id ) ) {
							return false;
						}
						return $this->database->expire_draft( $id );
					}
				);
			}
		}
		$this->database->delete_expired_rate_limits();
		$this->database->delete_expired_outbox();
	}

	private function authorize_draft( string $id, string $token ): array|WP_Error {
		if ( 1 !== preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id ) || '' === $token ) {
			return $this->not_available();
		}
		$application = $this->database->find_application( $id );
		if ( ! $application || ! hash_equals( (string) $application['resume_token_hash'], hash( 'sha256', $token ) ) ) {
			return $this->not_available();
		}
		if ( 'draft' !== $application['status'] ) {
			return new WP_Error( 'APPLICATION_LOCKED', 'The submitted application is locked.', array( 'status' => 409 ) );
		}
		if ( empty( $application['draft_expires_at'] ) || strtotime( $application['draft_expires_at'] . ' UTC' ) <= time() ) {
			return $this->not_available();
		}
		return $application;
	}

	private function decode_payload( array $application ): array {
		$payload = json_decode( (string) $application['payload'], true );
		return is_array( $payload ) ? $payload : array();
	}

	private function token(): string {
		return rtrim( strtr( base64_encode( random_bytes( 32 ) ), '+/', '-_' ), '=' );
	}

	private function resume_url( string $id, string $token ): string {
		$base = defined( 'RG_PS1_PUBLIC_URL' ) ? (string) RG_PS1_PUBLIC_URL : home_url( '/ps1/' );
		return add_query_arg( 'application', rawurlencode( $id ), trailingslashit( $base ) ) . '#token=' . rawurlencode( $token );
	}

	private function consume_limit( string $scope, string $key, int $maximum ): bool|WP_Error {
		if ( ! defined( 'RG_PS1_RATE_LIMIT_SECRET' ) || strlen( (string) RG_PS1_RATE_LIMIT_SECRET ) < 32 ) {
			return new WP_Error( 'RATE_LIMIT_CONFIGURATION_REQUIRED', 'Application security is not configured.', array( 'status' => 503 ) );
		}
		$key_hash = hash_hmac( 'sha256', $key, (string) RG_PS1_RATE_LIMIT_SECRET );
		$result = $this->database->consume_rate_limit( $scope, $key_hash, $maximum, HOUR_IN_SECONDS );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $result ? true : new WP_Error( 'RATE_LIMITED', 'Too many attempts were made. Wait a little and try again.', array( 'status' => 429 ) );
	}

	private function not_available(): WP_Error {
		return new WP_Error( 'APPLICATION_NOT_AVAILABLE', 'This application link is no longer available.', array( 'status' => 404 ) );
	}
}
