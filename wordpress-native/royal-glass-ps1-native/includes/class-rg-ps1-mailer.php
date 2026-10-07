<?php
/**
 * Durable WordPress mail outbox.
 *
 * @package RoyalGlassPS1Native
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RG_PS1_Mailer {
	private RG_PS1_Database $database;
	private RG_PS1_Storage $storage;

	public function __construct( RG_PS1_Database $database, RG_PS1_Storage $storage ) {
		$this->database = $database;
		$this->storage  = $storage;
	}

	public function enqueue_submission( string $application_id, string $reference, array $payload, array $uploads ): bool {
		$applicant = $payload['applicant'];
		$summary   = $this->summary( $reference, $payload );
		$now       = gmdate( 'Y-m-d H:i:s' );
		$ids       = array_column( $uploads, 'id' );
		$internal  = defined( 'RG_PS1_SERVICEM8_EMAIL' ) ? (string) RG_PS1_SERVICEM8_EMAIL : '';
		$support   = defined( 'RG_PS1_SUPPORT_EMAIL' ) ? (string) RG_PS1_SUPPORT_EMAIL : (string) get_option( 'admin_email' );

		if ( '' === $internal || ! is_email( $internal ) || ! is_email( $support ) ) {
			return false;
		}
		$queued_internal = $this->database->enqueue_email(
			array(
				'id'             => wp_generate_uuid4(),
				'application_id' => $application_id,
				'kind'           => 'submission_internal',
				'to_addresses'   => wp_json_encode( array( $internal, $support ) ),
				'reply_to'       => $applicant['email'],
				'subject'        => sprintf( 'PS1 Application %s - %s', $reference, $payload['project']['address'] ),
				'text_body'      => $summary,
				'html_body'      => nl2br( esc_html( $summary ) ),
				'attachment_ids' => wp_json_encode( $ids ),
				'attempts'       => 0,
				'available_at'   => $now,
				'created_at'     => $now,
			)
		);
		$confirmation = "Kia ora {$applicant['name']},\n\nWe have received your PS1 application.\n\nApplication reference: {$reference}\n\nRoyal Glass will review the information and contact you if anything else is needed. Submission does not automatically confirm that a PS1 will be issued.\n\nRoyal Glass";
		$queued_applicant = $this->database->enqueue_email(
			array(
				'id'             => wp_generate_uuid4(),
				'application_id' => $application_id,
				'kind'           => 'submission_applicant',
				'to_addresses'   => wp_json_encode( array( $applicant['email'] ) ),
				'reply_to'       => $support,
				'subject'        => sprintf( 'We received your Royal Glass application - %s', $reference ),
				'text_body'      => $confirmation,
				'html_body'      => nl2br( esc_html( $confirmation ) ),
				'attachment_ids' => '[]',
				'attempts'       => 0,
				'available_at'   => $now,
				'created_at'     => $now,
			)
		);
		return $queued_internal && $queued_applicant;
	}

	public function enqueue_resume( string $application_id, string $applicant_name, string $applicant_email, string $resume_url ): bool {
		$support = defined( 'RG_PS1_SUPPORT_EMAIL' ) ? (string) RG_PS1_SUPPORT_EMAIL : (string) get_option( 'admin_email' );
		$body    = "Kia ora {$applicant_name},\n\nContinue your Royal Glass PS1 application using this private link:\n{$resume_url}\n\nDo not forward this link. It provides access to your saved application and expires with the draft.\n\nRoyal Glass";
		$now     = gmdate( 'Y-m-d H:i:s' );
		return $this->database->enqueue_email(
			array(
				'id'             => wp_generate_uuid4(),
				'application_id' => $application_id,
				'kind'           => 'draft_resume',
				'to_addresses'   => wp_json_encode( array( $applicant_email ) ),
				'reply_to'       => $support,
				'subject'        => 'Continue your Royal Glass PS1 application',
				'text_body'      => $body,
				'html_body'      => nl2br( esc_html( $body ) ),
				'attachment_ids' => '[]',
				'attempts'       => 0,
				'available_at'   => $now,
				'created_at'     => $now,
			)
		);
	}

	public function dispatch_due(): void {
		foreach ( $this->database->claim_due_emails() as $message ) {
			$attachments = array();
			foreach ( (array) json_decode( (string) $message['attachment_ids'], true ) as $upload_id ) {
				$upload = $this->database->find_upload( (string) $message['application_id'], (string) $upload_id );
				if ( $upload ) {
					$path = $this->storage->path_for( (string) $upload['stored_name'] );
					if ( $path ) {
						$attachments[] = $path;
					}
				}
			}
			$headers = array( 'Content-Type: text/html; charset=UTF-8' );
			if ( ! empty( $message['reply_to'] ) ) {
				$headers[] = 'Reply-To: ' . sanitize_email( (string) $message['reply_to'] );
			}
			$sender_name_filter = array( $this, 'sender_name' );
			add_filter( 'wp_mail_from_name', $sender_name_filter, 999 );
			try {
				$sent = wp_mail(
					(array) json_decode( (string) $message['to_addresses'], true ),
					(string) $message['subject'],
					(string) $message['html_body'],
					$headers,
					$attachments
				);
			} finally {
				remove_filter( 'wp_mail_from_name', $sender_name_filter, 999 );
			}
			if ( $sent ) {
				$this->database->mark_email_sent( (string) $message['id'] );
			} else {
				$this->database->mark_email_failed( (string) $message['id'], (int) $message['attempts'] + 1, 'wp_mail returned false.' );
			}
		}
	}

	public function sender_name( string $current_name ): string {
		return 'PS1 Application';
	}

	private function summary( string $reference, array $payload ): string {
		$labels = array(
			'ps1' => 'PS1 application', 'quote' => 'Quotation first', 'unsure' => 'Not sure',
			'architect' => 'Architect / Designer', 'builder' => 'Builder', 'developer' => 'Developer', 'homeowner' => 'Homeowner', 'other' => 'Other',
		);
		$lines = array(
			'Royal Glass PS1 Application',
			'Reference: ' . $reference,
			'Need: ' . ( $labels[ $payload['need'] ] ?? $payload['need'] ),
			'',
			'Applicant',
			'Name: ' . $payload['applicant']['name'],
			'Phone: ' . $payload['applicant']['mobile'],
			'Email: ' . $payload['applicant']['email'],
			'Role: ' . ( $labels[ $payload['applicant']['role'] ] ?? $payload['applicant']['role'] ),
		);
		if ( isset( $payload['applicant']['decisionMaker'] ) ) {
			$decision = $payload['applicant']['decisionMaker'];
			$lines[]  = 'Decision-maker: ' . $decision['name'] . ' | ' . $decision['mobile'] . ' | ' . $decision['email'];
		}
		$lines = array_merge(
			$lines,
			array(
				'',
				'Project',
				'Address: ' . $payload['project']['address'],
				'BC: ' . ( $payload['project']['buildingConsentNumber'] ?: 'Not supplied' ),
				'RC: ' . ( $payload['project']['resourceConsentNumber'] ?: 'Not supplied' ),
				'Installation: ' . $payload['project']['estimatedInstallation'],
				'Stage: ' . ( $payload['project']['stage'] ?? 'Not supplied' ),
				'Design: ' . $payload['design']['family'] . ' / ' . $payload['design']['system'],
				'Substrate: ' . $payload['site']['substrate'],
			)
		);
		foreach ( $payload['site']['locations'] as $index => $location ) {
			$lines[] = sprintf( 'Area %d: %s; %s%s', $index + 1, implode( ', ', $location['types'] ), $location['environment'], empty( $location['other'] ) ? '' : '; ' . $location['other'] );
		}
		return implode( "\n", $lines );
	}
}
