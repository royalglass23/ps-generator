<?php
/**
 * Private file storage. Uploads are disabled until RG_PS1_PRIVATE_UPLOAD_DIR is configured.
 *
 * @package RoyalGlassPS1Native
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RG_PS1_Storage {
	public const MAX_FILE_BYTES  = 10485760;
	public const MAX_TOTAL_BYTES = 26214400;
	public const MAX_FILES       = 5;

	private string $directory;

	public function __construct() {
		$this->directory = defined( 'RG_PS1_PRIVATE_UPLOAD_DIR' )
			? rtrim( (string) RG_PS1_PRIVATE_UPLOAD_DIR, '/\\' )
			: '';
	}

	public function is_configured(): bool {
		return '' !== $this->directory && $this->ensure_directory();
	}

	public function directory(): string {
		return $this->directory;
	}

	private function ensure_directory(): bool {
		if ( '' === $this->directory ) {
			return false;
		}
		$configured = wp_normalize_path( $this->directory );
		if ( 1 !== preg_match( '~^(?:[A-Za-z]:/|/)~', $configured ) || str_contains( $configured, "\0" ) ) {
			return false;
		}
		foreach ( array( ABSPATH, WP_CONTENT_DIR ) as $public_root ) {
			if ( $this->is_within( $configured, wp_normalize_path( (string) $public_root ) ) ) {
				return false;
			}
		}
		if ( ! is_dir( $this->directory ) && ! wp_mkdir_p( $this->directory ) ) {
			return false;
		}
		$resolved = realpath( $this->directory );
		if ( false === $resolved ) {
			return false;
		}
		$this->directory = rtrim( $resolved, '/\\' );
		foreach ( array( ABSPATH, WP_CONTENT_DIR ) as $public_root ) {
			$resolved_root = realpath( (string) $public_root );
			if ( false !== $resolved_root && $this->is_within( wp_normalize_path( $this->directory ), wp_normalize_path( $resolved_root ) ) ) {
				return false;
			}
		}
		if ( ! is_writable( $this->directory ) ) {
			return false;
		}

		// Defence in depth if an operator chooses a web-accessible directory.
		$deny = "Options -Indexes\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\ndeny from all\n</IfModule>\n";
		$index = "<?php\nhttp_response_code( 404 );\nexit;\n";
		if ( ! file_exists( $this->directory . '/.htaccess' ) && false === file_put_contents( $this->directory . '/.htaccess', $deny, LOCK_EX ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			return false;
		}
		if ( ! file_exists( $this->directory . '/index.php' ) && false === file_put_contents( $this->directory . '/index.php', $index, LOCK_EX ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			return false;
		}
		return hash_equals( $deny, (string) file_get_contents( $this->directory . '/.htaccess' ) )
			&& hash_equals( $index, (string) file_get_contents( $this->directory . '/index.php' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	}

	private function is_within( string $path, string $root ): bool {
		$path = strtolower( rtrim( wp_normalize_path( $path ), '/' ) );
		$root = strtolower( rtrim( wp_normalize_path( $root ), '/' ) );
		return $path === $root || str_starts_with( $path . '/', $root . '/' );
	}

	public function store( array $file ): array|WP_Error {
		if ( ! $this->is_configured() ) {
			return new WP_Error( 'UPLOAD_STORAGE_UNAVAILABLE', 'Private upload storage is not configured.', array( 'status' => 503 ) );
		}
		if ( ! isset( $file['error'], $file['size'], $file['name'], $file['tmp_name'] ) || UPLOAD_ERR_OK !== (int) $file['error'] ) {
			return new WP_Error( 'UPLOAD_FAILED', 'The file upload did not complete.', array( 'status' => 400 ) );
		}
		$size = (int) $file['size'];
		if ( $size < 1 || $size > self::MAX_FILE_BYTES ) {
			return new WP_Error( 'UPLOAD_TOO_LARGE', 'This file is too large. The maximum file size is 10 MB.', array( 'status' => 413 ) );
		}

		$submitted_name = (string) $file['name'];
		$original_name  = wp_basename( str_replace( '\\', '/', $submitted_name ) );
		if (
			'' === $original_name
			|| $original_name !== $submitted_name
			|| strlen( $original_name ) > 255
			|| 1 === preg_match( '/[\x00-\x1F\x7F]/', $original_name )
		) {
			return new WP_Error( 'UPLOAD_FAILED', 'The filename is not valid.', array( 'status' => 400 ) );
		}
		$extension     = strtolower( pathinfo( $original_name, PATHINFO_EXTENSION ) );
		$allowed       = array(
			'pdf'  => array( 'application/pdf' ),
			'jpg'  => array( 'image/jpeg' ),
			'jpeg' => array( 'image/jpeg' ),
			'png'  => array( 'image/png' ),
			'dwg'  => array( 'application/acad', 'application/dwg', 'application/octet-stream', 'application/x-acad', 'image/vnd.dwg' ),
		);
		if ( ! isset( $allowed[ $extension ] ) ) {
			return new WP_Error( 'UNSUPPORTED_UPLOAD_TYPE', 'Use a PDF, JPG, PNG or DWG file.', array( 'status' => 415 ) );
		}

		$finfo = new finfo( FILEINFO_MIME_TYPE );
		$mime  = strtolower( (string) $finfo->file( (string) $file['tmp_name'] ) );
		if ( ! in_array( $mime, $allowed[ $extension ], true ) || ! $this->signature_matches( (string) $file['tmp_name'], $extension ) ) {
			return new WP_Error( 'UNSUPPORTED_UPLOAD_TYPE', 'The file contents do not match the selected file type.', array( 'status' => 415 ) );
		}

		$stored_name = wp_generate_uuid4() . '.' . $extension;
		$destination = $this->directory . DIRECTORY_SEPARATOR . $stored_name;
		if ( ! move_uploaded_file( (string) $file['tmp_name'], $destination ) ) {
			return new WP_Error( 'UPLOAD_FAILED', 'The file could not be stored.', array( 'status' => 500 ) );
		}
		@chmod( $destination, 0600 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		return array(
			'original_name' => $original_name,
			'stored_name'   => $stored_name,
			'content_type'  => $mime,
			'size_bytes'    => $size,
			'path'          => $destination,
		);
	}

	private function signature_matches( string $path, string $extension ): bool {
		$handle = fopen( $path, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		if ( false === $handle ) {
			return false;
		}
		$prefix = (string) fread( $handle, 8 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		if ( 'pdf' === $extension ) {
			return str_starts_with( $prefix, '%PDF-' );
		}
		if ( 'png' === $extension ) {
			return "\x89PNG\r\n\x1a\n" === $prefix;
		}
		if ( 'jpg' === $extension || 'jpeg' === $extension ) {
			return str_starts_with( $prefix, "\xff\xd8\xff" );
		}
		if ( 'dwg' === $extension ) {
			return 1 === preg_match( '/^AC10\d{2}/', $prefix );
		}
		return false;
	}

	public function path_for( string $stored_name ): ?string {
		if ( '' === $this->directory || wp_basename( $stored_name ) !== $stored_name ) {
			return null;
		}
		$path = $this->directory . DIRECTORY_SEPARATOR . $stored_name;
		return is_file( $path ) ? $path : null;
	}

	public function delete( string $stored_name ): bool {
		$path = $this->path_for( $stored_name );
		if ( null === $path ) {
			return true;
		}
		wp_delete_file( $path );
		return ! file_exists( $path );
	}
}
