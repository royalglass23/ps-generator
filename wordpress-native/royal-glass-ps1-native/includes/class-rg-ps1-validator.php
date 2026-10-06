<?php
/**
 * Server-side validation for the public application contract.
 *
 * @package RoyalGlassPS1Native
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RG_PS1_Validator {
	private const NEEDS        = array( 'ps1', 'quote', 'unsure' );
	private const ROLES        = array( 'architect', 'builder', 'developer', 'homeowner', 'other' );
	private const STAGES       = array( 'concept', 'developed', 'preparing_consent', 'consent_lodged', 'council_rfi', 'consent_approved', 'construction', 'existing', 'other' );
	private const WINDOWS      = array( 'asap', '3_months', '6_months', '1_year', '2_years', 'not_sure' );
	private const FAMILIES     = array( 'balustrade', 'pool', 'aluminium', 'canopy', 'not_sure' );
	private const SYSTEMS      = array( 'double-disc', 'hidden', 'jh-clamp', 'juralco-canopy', 'lugano', 'mini-post', 'mp-sp14', 'side-channel', 'top-channel', 'unex-ascot', 'unex-metropolis', 'viking-aluminium', 'viking-glass', 'vista', 'not-sure' );
	private const SUBSTRATES   = array( 'timber', 'concrete', 'steel', 'tile-concrete', 'not_sure' );
	private const ENVIRONMENTS = array( 'internal', 'external' );
	private const LOCATIONS    = array( 'deck', 'balcony', 'stair', 'landing', 'juliet-window', 'entrance-facade', 'pool-area', 'other' );

	public function draft( mixed $input ): array|WP_Error {
		if ( ! is_array( $input ) ) {
			return $this->error( 'The draft data is invalid.' );
		}
		return $this->normalize( $input, false );
	}

	public function submission( mixed $input ): array|WP_Error {
		if ( ! is_array( $input ) ) {
			return $this->error( 'The application is incomplete or invalid.' );
		}
		return $this->normalize( $input, true );
	}

	private function normalize( array $input, bool $required ): array|WP_Error {
		$need      = $this->enum( $input['need'] ?? '', self::NEEDS, $required );
		$applicant = is_array( $input['applicant'] ?? null ) ? $input['applicant'] : array();
		$project   = is_array( $input['project'] ?? null ) ? $input['project'] : array();
		$design    = is_array( $input['design'] ?? null ) ? $input['design'] : array();
		$site      = is_array( $input['site'] ?? null ) ? $input['site'] : array();

		$name    = $this->text( $applicant['name'] ?? '', 100 );
		$mobile  = $this->text( $applicant['mobile'] ?? '', 25 );
		$email   = sanitize_email( $this->text( $applicant['email'] ?? '', 320 ) );
		$role    = $this->enum( $applicant['role'] ?? '', self::ROLES, $required );
		$address = $this->text( $project['address'] ?? '', 250 );

		if ( $required ) {
			if ( ! $need || ! $role || ! $this->valid_name( $name ) || ! $this->valid_phone( $mobile ) || ! is_email( $email ) || ! $this->valid_address( $address ) ) {
				return $this->error( 'The application is incomplete or invalid.' );
			}
		} elseif ( ( $name && ! $this->valid_name( $name ) ) || ( $mobile && ! $this->valid_phone( $mobile ) ) || ( $email && ! is_email( $email ) ) || ( $address && ! $this->valid_address( $address ) ) ) {
			return $this->error( 'The draft data is invalid.' );
		}

		$decision_maker = null;
		if ( in_array( $role, array( 'architect', 'builder' ), true ) ) {
			$source = is_array( $applicant['decisionMaker'] ?? null ) ? $applicant['decisionMaker'] : array();
			$decision_maker = array(
				'name'   => $this->text( $source['name'] ?? '', 100 ),
				'mobile' => $this->text( $source['mobile'] ?? '', 25 ),
				'email'  => sanitize_email( $this->text( $source['email'] ?? '', 320 ) ),
			);
			if ( $required && ( ! $this->valid_name( $decision_maker['name'] ) || ! $this->valid_phone( $decision_maker['mobile'] ) || ! is_email( $decision_maker['email'] ) ) ) {
				return $this->error( 'Enter valid homeowner or decision-maker contact details.' );
			}
		} elseif ( isset( $applicant['decisionMaker'] ) ) {
			return $this->error( 'Decision-maker details are only accepted for architects and builders.' );
		}

		$building_consent = strtoupper( $this->text( $project['buildingConsentNumber'] ?? '', 50 ) );
		$resource_consent = strtoupper( $this->text( $project['resourceConsentNumber'] ?? '', 50 ) );
		if ( ! $this->valid_consent( $building_consent ) || ! $this->valid_consent( $resource_consent ) ) {
			return $this->error( 'A consent number contains unsupported characters.' );
		}

		$estimated = $this->enum( $project['estimatedInstallation'] ?? '', self::WINDOWS, $required );
		$stage     = $this->enum( $project['stage'] ?? '', self::STAGES, false );
		$family    = $this->enum( $design['family'] ?? '', self::FAMILIES, $required );
		$system    = $this->enum( $design['system'] ?? '', self::SYSTEMS, $required );
		$substrate = $this->enum( $site['substrate'] ?? '', self::SUBSTRATES, $required );
		if ( $required && ( ! $estimated || ! $family || ! $system || ! $substrate ) ) {
			return $this->error( 'The application is incomplete or invalid.' );
		}

		$locations = $this->locations( $site['locations'] ?? array(), $required );
		if ( is_wp_error( $locations ) ) {
			return $locations;
		}

		if ( $required && true !== ( $input['acknowledgement']['accepted'] ?? false ) ) {
			return $this->error( 'Confirm the application before submitting it.' );
		}

		$result = array(
			'need'      => $need ?: null,
			'applicant' => array_filter(
				array(
					'name'          => $name,
					'mobile'        => $mobile,
					'email'         => $email,
					'role'          => $role ?: null,
					'decisionMaker' => $decision_maker,
				),
				static fn( $value ) => null !== $value
			),
			'project'   => array_filter(
				array(
					'address'               => $address,
					'buildingConsentNumber' => $building_consent,
					'resourceConsentNumber' => $resource_consent,
					'estimatedInstallation' => $estimated ?: null,
					'stage'                 => $stage ?: null,
				),
				static fn( $value ) => null !== $value
			),
			'design'    => array_filter( array( 'family' => $family ?: null, 'system' => $system ?: null ), static fn( $value ) => null !== $value ),
			'site'      => array( 'substrate' => $substrate ?: null, 'locations' => $locations ),
		);
		if ( $required ) {
			$result['acknowledgement'] = array( 'accepted' => true );
		}
		return $result;
	}

	private function locations( mixed $input, bool $required ): array|WP_Error {
		if ( ! is_array( $input ) || count( $input ) > 3 ) {
			return $this->error( 'Add no more than three locations.' );
		}
		$output    = array();
		$pool_area = false;
		foreach ( $input as $location ) {
			if ( ! is_array( $location ) ) {
				return $this->error( 'A location is invalid.' );
			}
			$types = array_values( array_unique( array_filter( (array) ( $location['types'] ?? array() ), static fn( $type ) => in_array( $type, self::LOCATIONS, true ) ) ) );
			if ( count( $types ) > 3 || ( $required && empty( $types ) ) ) {
				return $this->error( 'Choose one to three location types.' );
			}
			$environment = $this->enum( $location['environment'] ?? '', self::ENVIRONMENTS, $required );
			$other       = $this->text( $location['other'] ?? '', 200 );
			if ( in_array( 'other', $types, true ) && '' === $other ) {
				return $this->error( 'Describe the location when Other is selected.' );
			}
			if ( in_array( 'pool-area', $types, true ) ) {
				$pool_area = true;
				if ( 1 !== count( $types ) ) {
					return $this->error( 'Pool Area must be the only location type.' );
				}
			}
			$output[] = array_filter( array( 'types' => $types, 'environment' => $environment ?: null, 'other' => $other ), static fn( $value ) => null !== $value );
		}
		if ( $pool_area && count( $output ) > 1 ) {
			return $this->error( 'Pool Area must be the only area.' );
		}
		return $output;
	}

	private function enum( mixed $value, array $allowed, bool $required ): string {
		$value = is_string( $value ) ? $value : '';
		if ( '' === $value && ! $required ) {
			return '';
		}
		return in_array( $value, $allowed, true ) ? $value : '';
	}

	private function text( mixed $value, int $maximum ): string {
		$value = is_string( $value ) ? trim( wp_check_invalid_utf8( $value ) ) : '';
		return mb_substr( $value, 0, $maximum );
	}

	private function valid_name( string $value ): bool {
		return 1 === preg_match( "/^[\\p{L}\\p{M}][\\p{L}\\p{M} .'’\\-]*$/u", $value );
	}

	private function valid_phone( string $value ): bool {
		if ( 1 !== preg_match( '/^[+0-9 ()-]+$/', $value ) ) {
			return false;
		}
		$compact  = str_replace( array( ' ', '(', ')', '-' ), '', $value );
		$national = str_starts_with( $compact, '+64' ) ? substr( $compact, 3 ) : substr( $compact, 1 );
		return 1 === preg_match( '/^(?:2\d{7,9}|[34679]\d{7})$/', $national );
	}

	private function valid_address( string $value ): bool {
		return 1 === preg_match( "/^[\\p{L}\\p{M}\\p{N}][\\p{L}\\p{M}\\p{N} ,.'’\\-\\/#&()]*$/u", $value );
	}

	private function valid_consent( string $value ): bool {
		return '' === $value || 1 === preg_match( '/^[A-Za-z0-9][A-Za-z0-9 .\/-]*$/', $value );
	}

	private function error( string $message ): WP_Error {
		return new WP_Error( 'VALIDATION_FAILED', $message, array( 'status' => 422 ) );
	}
}
