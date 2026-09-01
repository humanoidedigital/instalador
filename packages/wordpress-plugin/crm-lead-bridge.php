<?php
/**
 * Plugin Name: CRM Lead Bridge
 * Description: Envia os leads dos formulários do site para o CRM, pelo servidor.
 * Version: 1.0.0
 * Requires PHP: 7.4
 *
 * Por que server-side: o envio sai do servidor do WordPress, então bloqueador
 * de anúncio no navegador do visitante não derruba o lead. É o caminho mais
 * confiável dos cinco descritos em docs/crm/03-captura-web.md.
 *
 * Rodar junto com o crm.js (modo B) é seguro: o CRM deduplica, e o script
 * é quem carrega os parâmetros de campanha.
 *
 * Configuração: Ajustes > CRM Lead Bridge
 */

defined('ABSPATH') || exit;

const CRM_OPT_ENDPOINT = 'crm_bridge_endpoint';
const CRM_OPT_SITE_KEY = 'crm_bridge_site_key';

/**
 * Envia um lead ao CRM.
 *
 * `blocking => false` é essencial: sem isso, uma lentidão do CRM vira
 * lentidão na página de obrigado que o visitante está esperando.
 */
function crm_bridge_enviar(array $campos, string $form_id = ''): void {
    $endpoint = trim((string) get_option(CRM_OPT_ENDPOINT));
    $site_key = trim((string) get_option(CRM_OPT_SITE_KEY));
    if ($endpoint === '' || $site_key === '') {
        return;
    }

    $campos = array_filter($campos, static function ($v) {
        return is_scalar($v) && $v !== '';
    });
    if (empty($campos)) {
        return;
    }

    $payload = [
        'site_key' => $site_key,
        'form_id'  => $form_id,
        'pagina'   => wp_get_referer() ?: home_url(),
        'campos'   => array_map('strval', $campos),
        // O cookie que o crm.js fez o servidor criar chega até aqui. É ele que
        // liga esta submissão server-side à sessão que trouxe o gclid/fbclid.
        'anonymous_id' => isset($_COOKIE['_crm_aid'])
            ? sanitize_text_field(wp_unslash($_COOKIE['_crm_aid']))
            : null,
    ];

    wp_remote_post(rtrim($endpoint, '/') . '/ingest/form', [
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode($payload),
    ]);
}

/* ------------------------------------------------------------------ *
 * Ganchos dos construtores de formulário mais usados.
 * Cada um entrega os campos num formato diferente.
 * ------------------------------------------------------------------ */

// Contact Form 7
add_action('wpcf7_mail_sent', static function ($form): void {
    if (!class_exists('WPCF7_Submission')) {
        return;
    }
    $envio = WPCF7_Submission::get_instance();
    if ($envio) {
        crm_bridge_enviar((array) $envio->get_posted_data(), 'cf7-' . $form->id());
    }
});

// Elementor Pro
add_action('elementor_pro/forms/new_record', static function ($registro): void {
    $campos = [];
    foreach ((array) $registro->get('fields') as $chave => $campo) {
        $campos[$campo['title'] ?: $chave] = $campo['value'];
    }
    crm_bridge_enviar($campos, 'elementor-' . $registro->get_form_settings('form_name'));
}, 10, 1);

// WPForms
add_action('wpforms_process_complete', static function ($fields, $entry, $form_data): void {
    $campos = [];
    foreach ((array) $fields as $campo) {
        $campos[$campo['name'] ?: $campo['id']] = $campo['value'];
    }
    crm_bridge_enviar($campos, 'wpforms-' . $form_data['id']);
}, 10, 3);

// Gravity Forms
add_action('gform_after_submission', static function ($entry, $form): void {
    $campos = [];
    foreach ((array) $form['fields'] as $campo) {
        $campos[$campo->label] = rgar($entry, (string) $campo->id);
    }
    crm_bridge_enviar($campos, 'gform-' . $form['id']);
}, 10, 2);

/* ------------------------------------------------------------------ *
 * Tela de ajustes
 * ------------------------------------------------------------------ */

add_action('admin_menu', static function (): void {
    add_options_page(
        'CRM Lead Bridge',
        'CRM Lead Bridge',
        'manage_options',
        'crm-lead-bridge',
        'crm_bridge_tela'
    );
});

add_action('admin_init', static function (): void {
    register_setting('crm_bridge', CRM_OPT_ENDPOINT, [
        'sanitize_callback' => 'esc_url_raw',
        'default'           => '',
    ]);
    register_setting('crm_bridge', CRM_OPT_SITE_KEY, [
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => '',
    ]);
});

function crm_bridge_tela(): void {
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>CRM Lead Bridge</h1>
        <p>Os formulários deste site passam a enviar os leads para o CRM.</p>
        <form method="post" action="options.php">
            <?php settings_fields('crm_bridge'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="crm_endpoint">Endereço do CRM</label></th>
                    <td>
                        <input type="url" id="crm_endpoint" class="regular-text"
                               name="<?php echo esc_attr(CRM_OPT_ENDPOINT); ?>"
                               value="<?php echo esc_attr(get_option(CRM_OPT_ENDPOINT)); ?>"
                               placeholder="https://t.seudominio.com.br">
                        <p class="description">O subdomínio de rastreamento, sem barra no fim.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="crm_site_key">Chave do site</label></th>
                    <td>
                        <input type="text" id="crm_site_key" class="regular-text"
                               name="<?php echo esc_attr(CRM_OPT_SITE_KEY); ?>"
                               value="<?php echo esc_attr(get_option(CRM_OPT_SITE_KEY)); ?>">
                        <p class="description">Copie do CRM em Ajustes &rsaquo; Sites.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
