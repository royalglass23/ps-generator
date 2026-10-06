<?php
/**
 * Plugin Name: Royal Glass PS1 Application
 * Description: Adds the [royal_glass_ps1] shortcode for the Royal Glass PS1 application.
 * Version: 0.1.0
 * Author: Royal Glass
 */

if (!defined('ABSPATH')) {
    exit;
}

define('RG_PS1_VERSION', '0.1.0');

function rg_ps1_application_url() {
    $configured = defined('RG_PS1_APP_URL') ? RG_PS1_APP_URL : '';
    $url = apply_filters('rg_ps1_app_url', $configured);
    $url = esc_url_raw(trim((string) $url));
    $parts = $url ? wp_parse_url($url) : false;

    if (!$parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
        return '';
    }

    return untrailingslashit($url) . '/';
}

function rg_ps1_enqueue_assets() {
    static $enqueued = false;
    if ($enqueued) {
        return;
    }
    $enqueued = true;

    $asset_url = plugin_dir_url(__FILE__) . 'assets/';
    wp_enqueue_style('royal-glass-ps1', $asset_url . 'royal-glass-ps1.css', array(), RG_PS1_VERSION);
    wp_enqueue_script('royal-glass-ps1', $asset_url . 'royal-glass-ps1.js', array(), RG_PS1_VERSION, false);
}

function rg_ps1_enqueue_page_assets() {
    global $post;
    if ($post instanceof WP_Post && has_shortcode($post->post_content, 'royal_glass_ps1')) {
        rg_ps1_enqueue_assets();
    }
}
add_action('wp_enqueue_scripts', 'rg_ps1_enqueue_page_assets', 1);

function rg_ps1_shortcode() {
    rg_ps1_enqueue_assets();
    $application_url = rg_ps1_application_url();
    if (!$application_url) {
        if (current_user_can('manage_options')) {
            return '<div class="rg-ps1-configuration-notice"><strong>Royal Glass PS1:</strong> Add <code>RG_PS1_APP_URL</code> to <code>wp-config.php</code> before publishing this page.</div>';
        }
        return '<p>The PS1 application is temporarily unavailable. Please contact Royal Glass.</p>';
    }

    return sprintf(
        '<div class="rg-ps1-embed"><iframe class="rg-ps1-frame" data-app-url="%1$s" src="about:blank" title="Royal Glass PS1 application" loading="eager" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-forms allow-scripts allow-same-origin allow-popups"></iframe><noscript><p><a href="%1$s">Open the Royal Glass PS1 application</a></p></noscript></div>',
        esc_url($application_url)
    );
}
add_shortcode('royal_glass_ps1', 'rg_ps1_shortcode');
