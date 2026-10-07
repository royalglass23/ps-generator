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
		$internal  = $this->review_address();
		$support   = defined( 'RG_PS1_SUPPORT_EMAIL' ) ? (string) RG_PS1_SUPPORT_EMAIL : (string) get_option( 'admin_email' );

		if ( '' === $internal || ! is_email( $internal ) || ! is_email( $support ) ) {
			return false;
		}
		$queued_internal = $this->database->enqueue_email(
			array(
				'id'             => wp_generate_uuid4(),
				'application_id' => $application_id,
				'kind'           => 'submission_internal',
				'to_addresses'   => wp_json_encode( array_values( array_unique( array( $internal, $support ) ) ) ),
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
		$confirmation = "Hi {$applicant['name']},\n\nThank you for submitting your PS1 application to Royal Glass.\n\nWe have received your application for {$payload['project']['address']}. A summary of the information you provided is included below.\n\n{$summary}\n\nWhat happens next\nOur team will review the information and supporting documents you provided. We will contact you if anything further is needed and advise you of the appropriate next step.\n\nSubmitting this application does not automatically confirm that a PS1 will be issued. Royal Glass will review the project first.\n\nApplication reference: {$reference}\n\nQuestions? Reply to this email or contact us at {$support}.\n\nKind regards,\nRoyal Glass";
		$applicant_html = $this->applicant_confirmation_html( $reference, $payload, $uploads, $support );
		$queued_applicant = $this->database->enqueue_email(
			array(
				'id'             => wp_generate_uuid4(),
				'application_id' => $application_id,
				'kind'           => 'submission_applicant',
				'to_addresses'   => wp_json_encode( array( $applicant['email'] ) ),
				'reply_to'       => $support,
				'subject'        => sprintf( 'We received your Royal Glass application - %s', $reference ),
				'text_body'      => $confirmation,
				'html_body'      => $applicant_html,
				'attachment_ids' => '[]',
				'attempts'       => 0,
				'available_at'   => $now,
				'created_at'     => $now,
			)
		);
		return $queued_internal && $queued_applicant;
	}

	public function enqueue_review_escalation( string $application_id, string $reference ): bool {
		$review = $this->review_address();
		if ( ! is_email( $review ) ) {
			return false;
		}
		$body = "PS1 application {$reference} has remained under review for 14 days. Record the staff outcome after the ServiceM8 Job Card or Non-job Outcome Record is confirmed.";
		return $this->enqueue_internal_notice( $application_id, 'review_escalation', $review, "PS1 review overdue - {$reference}", $body, array() );
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
				if ( ! $upload || 'ready' !== $upload['status'] ) {
					continue;
				}
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
			$sender_address_filter = array( $this, 'sender_address' );
			$sender_identity_action = array( $this, 'apply_sender_identity' );
			add_filter( 'wp_mail_from_name', $sender_name_filter, 999 );
			add_filter( 'wp_mail_from', $sender_address_filter, 999 );
			add_action( 'phpmailer_init', $sender_identity_action, PHP_INT_MAX );
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
				remove_filter( 'wp_mail_from', $sender_address_filter, 999 );
				remove_action( 'phpmailer_init', $sender_identity_action, PHP_INT_MAX );
			}
			if ( $sent ) {
				$this->database->mark_email_sent( (string) $message['id'] );
			} else {
				$this->database->mark_email_failed( (string) $message['id'], (int) $message['attempts'] + 1, 'wp_mail returned false.' );
			}
		}
	}

	private function review_address(): string {
		return defined( 'RG_PS1_SERVICEM8_EMAIL' ) ? sanitize_email( (string) RG_PS1_SERVICEM8_EMAIL ) : '';
	}

	private function enqueue_internal_notice( string $application_id, string $kind, string $to, string $subject, string $body, array $attachment_ids ): bool {
		$now = gmdate( 'Y-m-d H:i:s' );
		return $this->database->enqueue_email(
			array(
				'id'             => wp_generate_uuid4(),
				'application_id' => $application_id,
				'kind'           => $kind,
				'to_addresses'   => wp_json_encode( array( $to ) ),
				'reply_to'       => null,
				'subject'        => $subject,
				'text_body'      => $body,
				'html_body'      => nl2br( esc_html( $body ) ),
				'attachment_ids' => wp_json_encode( $attachment_ids ),
				'attempts'       => 0,
				'available_at'   => $now,
				'created_at'     => $now,
			)
		);
	}

	public function sender_name( string $current_name ): string {
		return 'PS1 Generator';
	}

	public function sender_address( string $current_address ): string {
		$support = defined( 'RG_PS1_SUPPORT_EMAIL' ) ? (string) RG_PS1_SUPPORT_EMAIL : (string) get_option( 'admin_email' );
		return is_email( $support ) ? $support : $current_address;
	}

	public function apply_sender_identity( $phpmailer ): void {
		$sender_address = $this->sender_address( (string) $phpmailer->From );
		$phpmailer->setFrom( $sender_address, 'PS1 Generator', false );
	}

	private function applicant_confirmation_html( string $reference, array $payload, array $uploads, string $support ): string {
		$applicant_name = esc_html( (string) $payload['applicant']['name'] );
		$address        = esc_html( (string) $payload['project']['address'] );
		$reference      = esc_html( $reference );
		$support        = esc_html( $support );
		$summary_rows   = $this->applicant_summary_html( $payload, $uploads );
		$logo_url       = 'https://royalglass.co.nz/wp-content/uploads/2024/01/Royal-Glass-Logo-White-150x72.png';
		$hero_url       = 'https://royalglass.co.nz/wp-content/uploads/2026/01/Auckland-Remuera-1-scaled.jpg';

		return '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>Royal Glass</title></head>'
			. '<body style="margin:0;padding:0;background:#fafafb;color:#3d3d3d;font-family:\'Kumbh Sans\',Arial,sans-serif">'
			. '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Royal Glass has received your PS1 application for ' . $address . '.</div>'
			. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#fafafb"><tr><td align="center" style="padding:24px 12px">'
			. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dfe4e5;border-radius:4px;overflow:hidden">'
			. '<tr><td background="' . $hero_url . '" bgcolor="#3d3d3d" style="padding:26px 32px 34px;background-color:#3d3d3d;background-image:linear-gradient(rgba(28,39,40,.72),rgba(28,39,40,.72)),url(\'' . $hero_url . '\');background-position:center;background-size:cover">'
			. '<img src="' . $logo_url . '" width="150" alt="Royal Glass logo" style="display:block;width:150px;max-width:100%;height:auto;margin:0 0 38px;border:0">'
			. '<p style="margin:0 0 8px;color:#b2dcdf;font-size:12px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase">PS1 application</p>'
			. '<h1 style="max-width:520px;margin:0;color:#ffffff;font-size:32px;font-weight:600;letter-spacing:-.5px;line-height:1.18">We&#039;ve received your application</h1></td></tr>'
			. '<tr><td style="padding:34px 32px 30px">'
			. '<p style="margin:0 0 14px;color:#3d3d3d;font-size:16px;line-height:1.65">Hi ' . $applicant_name . ', thank you for submitting your PS1 application to Royal Glass.</p>'
			. '<p style="margin:0 0 24px;color:#3d3d3d;font-size:16px;line-height:1.65">We have received the details for <strong>' . $address . '</strong>.</p>'
			. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 30px;border-collapse:separate;border-spacing:0;background:#edf7f7;border-left:4px solid #78b3b7"><tr><td style="padding:17px 18px"><p style="margin:0 0 4px;color:#1a848b;font-size:13px;font-weight:700">Application received</p><p style="margin:0;color:#3d3d3d;font-size:14px;line-height:1.55">Our team will now review your details and supporting documents.</p></td></tr></table>'
			. '<h2 style="margin:0 0 14px;color:#3d3d3d;font-size:21px;font-weight:600;line-height:1.3">Your application summary</h2>' . $summary_rows
			. '<h2 style="margin:32px 0 16px;color:#3d3d3d;font-size:21px;font-weight:600;line-height:1.3">What happens next</h2>'
			. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="width:34px;padding:0 10px 17px 0;color:#1a848b;font-size:12px;font-weight:700;vertical-align:top">01</td><td style="padding:0 0 17px;color:#3d3d3d;font-size:14px;line-height:1.55"><strong style="display:block">We review the application</strong>We check the information and supporting documents you provided.</td></tr><tr><td style="width:34px;padding:0 10px 17px 0;color:#1a848b;font-size:12px;font-weight:700;vertical-align:top">02</td><td style="padding:0 0 17px;color:#3d3d3d;font-size:14px;line-height:1.55"><strong style="display:block">We contact you if needed</strong>If anything is missing or needs clarification, our team will get in touch.</td></tr><tr><td style="width:34px;padding:0 10px 0 0;color:#1a848b;font-size:12px;font-weight:700;vertical-align:top">03</td><td style="padding:0;color:#3d3d3d;font-size:14px;line-height:1.55"><strong style="display:block">We confirm the next step</strong>We will advise you once the initial review is complete.</td></tr></table>'
			. '<p style="margin:26px 0;padding:14px 16px;background:#fafafb;border:1px solid #dfe4e5;color:#5c6668;font-size:13px;line-height:1.55">Submitting an application does not automatically confirm that a PS1 will be issued. Royal Glass will review the project first.</p>'
			. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse"><tr><td style="padding:15px 17px;border-radius:4px;background:#1a848b;color:#ffffff"><span style="display:block;margin-bottom:3px;color:#b2dcdf;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">Application reference</span><strong style="font-size:17px;letter-spacing:.3px">' . $reference . '</strong></td></tr></table>'
			. '<p style="margin:0;color:#3d3d3d;font-size:14px;line-height:1.65">Questions? Reply to this email or contact us at <a href="mailto:' . $support . '" style="color:#1a848b;font-weight:700;text-decoration:underline">' . $support . '</a>.</p><p style="margin:22px 0 0;color:#3d3d3d;font-size:14px;line-height:1.55">Kind regards,<br><strong>Royal Glass</strong></p></td></tr>'
			. '<tr><td style="padding:28px 32px;background:#3d3d3d;color:#ffffff;font-size:12px;line-height:1.65"><p style="margin:0 0 5px;color:#ffffff;font-size:14px;font-weight:700">Royal Glass</p><p style="margin:0 0 2px"><a href="https://royalglass.co.nz/contact-us/" style="color:#dfe4e5;text-decoration:none">13E Paul Matthews Road, Rosedale, Auckland 0632</a></p><p style="margin:0 0 18px"><a href="tel:+64800769254" style="color:#dfe4e5;text-decoration:none">0800 769 254</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="mailto:' . $support . '" style="color:#dfe4e5;text-decoration:none">' . $support . '</a></p><p style="margin:0 0 9px;color:#b2dcdf;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">Follow Royal Glass</p><p style="margin:0 0 20px"><a href="https://www.facebook.com/royalglassnz" style="color:#ffffff;font-weight:600;text-decoration:none">Facebook</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="https://www.instagram.com/royalglassanz/" style="color:#ffffff;font-weight:600;text-decoration:none">Instagram</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="https://www.linkedin.com/company/royalglassnz" style="color:#ffffff;font-weight:600;text-decoration:none">LinkedIn</a><span style="color:#78b3b7"> &nbsp;&middot;&nbsp; </span><a href="https://www.youtube.com/@RoyalGlassNZ/" style="color:#ffffff;font-weight:600;text-decoration:none">YouTube</a></p><p style="margin:0"><a href="https://www.royalglass.co.nz/" style="display:inline-block;padding:10px 16px;border-radius:4px;background:#78b3b7;color:#ffffff;font-weight:700;text-decoration:none">See Royal Glass projects and services &rarr;</a></p></td></tr>'
			. '</table></td></tr></table></body></html>';
	}

	private function applicant_summary_html( array $payload, array $uploads ): string {
		$labels = array(
			'architect' => 'Architect / Designer', 'builder' => 'Builder', 'developer' => 'Developer', 'homeowner' => 'Homeowner', 'other' => 'Other',
			'ps1' => 'I need a PS1', 'quote' => 'I need a quotation first', 'unsure' => 'I’m not sure whether I need a PS1',
			'balustrade' => 'Glass balustrade', 'pool' => 'Pool fence', 'aluminium' => 'Aluminium balustrade', 'canopy' => 'Canopy', 'not_sure' => 'Not sure', 'not-sure' => 'Not sure',
			'asap' => 'ASAP', '3_months' => 'Within 3 months', '6_months' => 'Within 6 months', '1_year' => 'Within 1 year', '2_years' => 'Within 2 years',
			'concept' => 'Concept / Early Design', 'developed' => 'Developed Design', 'preparing_consent' => 'Preparing Building Consent', 'consent_lodged' => 'Building Consent lodged', 'council_rfi' => 'Council RFI received', 'consent_approved' => 'Building Consent approved', 'construction' => 'Construction underway', 'existing' => 'Existing building / alteration',
			'timber' => 'Timber', 'concrete' => 'Concrete', 'steel' => 'Steel', 'tile-concrete' => 'Tile over concrete', 'internal' => 'Internal', 'external' => 'External',
			'deck' => 'Deck', 'balcony' => 'Balcony', 'stair' => 'Stair', 'landing' => 'Landing', 'juliet-window' => 'Juliet window', 'entrance-facade' => 'Entrance facade', 'pool-area' => 'Pool area',
		);
		$label = static function ( mixed $value ) use ( $labels ): string {
			$value = (string) $value;
			return $labels[ $value ] ?? ucwords( str_replace( array( '-', '_' ), ' ', $value ) );
		};
		$rows = array(
			'Applicant'               => $payload['applicant']['name'],
			'Email'                   => $payload['applicant']['email'],
			'Mobile'                  => $payload['applicant']['mobile'],
			'Role'                    => $label( $payload['applicant']['role'] ),
			'Project address'         => $payload['project']['address'],
			'Building Consent number' => $payload['project']['buildingConsentNumber'] ?: 'Not provided',
			'Resource Consent number' => $payload['project']['resourceConsentNumber'] ?: 'Not provided',
			'Estimated installation'  => $label( $payload['project']['estimatedInstallation'] ),
			'Project stage'           => empty( $payload['project']['stage'] ) ? 'Not provided' : $label( $payload['project']['stage'] ),
			'Request'                 => $label( $payload['need'] ),
			'Barrier type'            => $label( $payload['design']['family'] ),
			'System'                  => $label( $payload['design']['system'] ),
			'Fixing substrate'        => $label( $payload['site']['substrate'] ),
		);
		if ( isset( $payload['applicant']['decisionMaker'] ) ) {
			$decision = $payload['applicant']['decisionMaker'];
			$rows = array_slice( $rows, 0, 4, true ) + array(
				'Homeowner / decision maker'       => $decision['name'],
				'Homeowner / decision-maker email' => $decision['email'],
				'Homeowner / decision-maker phone' => $decision['mobile'],
			) + array_slice( $rows, 4, null, true );
		}
		foreach ( $payload['site']['locations'] as $index => $location ) {
			$types = array_map( $label, $location['types'] );
			$value = implode( ', ', $types ) . ' (' . $label( $location['environment'] ) . ')';
			if ( ! empty( $location['other'] ) ) {
				$value .= ' - ' . $location['other'];
			}
			$rows[ 'Area ' . ( $index + 1 ) ] = $value;
		}
		$upload_names = array_filter( array_map( static fn( array $upload ): string => (string) ( $upload['original_name'] ?? '' ), $uploads ) );
		$rows['Uploaded files'] = $upload_names ? implode( ', ', $upload_names ) : 'None';
		$rows['Application acknowledgement'] = 'Confirmed by ' . $payload['applicant']['name'];

		$html = '';
		foreach ( $rows as $heading => $value ) {
			$html .= '<tr><th scope="row" style="width:36%;padding:11px 14px;border-bottom:1px solid #dfe4e5;color:#687376;font-size:12px;font-weight:600;line-height:1.45;text-align:left;vertical-align:top">' . esc_html( (string) $heading ) . '</th><td style="padding:11px 14px;border-bottom:1px solid #dfe4e5;color:#3d3d3d;font-size:14px;line-height:1.45;vertical-align:top">' . esc_html( (string) $value ) . '</td></tr>';
		}
		return '<table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dfe4e5;border-radius:4px;border-collapse:separate;border-spacing:0;overflow:hidden;background:#ffffff">' . $html . '</table>';
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
