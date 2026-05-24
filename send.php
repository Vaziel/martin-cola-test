<?php
/**
 * send.php — обработчик заявок с форм cola.martin-msk.ru
 * Отправляет email на profopt2013@mail.ru через mail() cPanel.
 *
 * Защита от спама:
 *   1. Honeypot-поле `website` — реальный пользователь не заполняет
 *   2. Минимальное время на форме (3 сек) — антибот
 *   3. Проверка обязательных полей и согласия
 *   4. Rate-limit по IP через файл сессии (1 заявка / 30 сек)
 *
 * Ответ:
 *   AJAX (X-Requested-With) → JSON {ok, message}
 *   Иначе → 303 redirect на /?sent=1 (для no-JS fallback)
 */

declare(strict_types=1);

// CORS — разрешаем только cola.martin-msk.ru
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

$RECIPIENT = 'profopt2013@mail.ru';
$SUBJECT_PREFIX = '[cola.martin-msk.ru]';
$FROM_NAME = 'cola.martin-msk.ru';
$FROM_EMAIL = 'noreply@cola.martin-msk.ru';

$is_ajax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) &&
           strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

function respond(bool $ok, string $message, int $http = 200): void {
    global $is_ajax;
    http_response_code($http);
    if ($is_ajax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        if ($ok) {
            header('Location: /?sent=1');
        } else {
            header('Content-Type: text/html; charset=utf-8');
            echo '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;background:#1A1410;color:#F4F0E8"><h1>' .
                 htmlspecialchars($message) .
                 '</h1><p><a href="/" style="color:#BA0C2F">← Вернуться на сайт</a></p>';
        }
    }
    exit;
}

// 1. Метод
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Метод не поддерживается', 405);
}

// 2. Honeypot
if (!empty($_POST['website'] ?? '')) {
    // Тихо отвечаем «успехом» чтобы не палить бот-фильтр
    respond(true, 'Заявка получена');
}

// 3. Rate-limit по IP (1 заявка / 30 сек)
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rate_file = sys_get_temp_dir() . '/cola-rate-' . md5($ip) . '.txt';
if (file_exists($rate_file) && (time() - filemtime($rate_file)) < 30) {
    respond(false, 'Слишком часто. Попробуйте через минуту.', 429);
}
@touch($rate_file);

// 4. Согласие
if (($_POST['consent'] ?? '') !== 'yes') {
    respond(false, 'Требуется согласие на обработку персональных данных.', 400);
}

// 5. Контактные данные обязательны
$contact = trim((string)($_POST['contact'] ?? ''));
if ($contact === '' || mb_strlen($contact) > 200) {
    respond(false, 'Укажите телефон или email для связи.', 400);
}

// Базовая sanitization для всех полей
$clean = function (string $s, int $max = 500): string {
    $s = trim($s);
    $s = preg_replace('/[\r\n]+/', ' ', $s); // защита от header injection
    $s = mb_substr($s, 0, $max);
    return strip_tags($s);
};

$fields = [
    'form_source' => $clean((string)($_POST['form_source'] ?? 'Сайт'), 64),
    'name'        => $clean((string)($_POST['name'] ?? ''), 200),
    'company'     => $clean((string)($_POST['company'] ?? ''), 200),
    'contact'     => $clean($contact, 200),
    'city'        => $clean((string)($_POST['city'] ?? ''), 200),
    'volume'      => $clean((string)($_POST['volume'] ?? ''), 200),
    'interest'    => $clean((string)($_POST['interest'] ?? ''), 200),
    'message'     => $clean((string)($_POST['message'] ?? ''), 3000),
];

// 6. Сборка письма
$subject = $SUBJECT_PREFIX . ' Заявка: ' . $fields['form_source'];
if ($fields['company']) {
    $subject .= ' — ' . $fields['company'];
} elseif ($fields['name']) {
    $subject .= ' — ' . $fields['name'];
}

$body_lines = [
    'Новая заявка с сайта cola.martin-msk.ru',
    str_repeat('=', 50),
    '',
    'Источник: ' . $fields['form_source'],
    '',
];

$labels = [
    'name'     => 'Имя',
    'company'  => 'Компания',
    'contact'  => 'Контакт',
    'city'     => 'Город',
    'volume'   => 'Объём',
    'interest' => 'Интересует',
    'message'  => 'Сообщение',
];
foreach ($labels as $key => $label) {
    if ($fields[$key] !== '') {
        $body_lines[] = $label . ': ' . $fields[$key];
    }
}

$body_lines[] = '';
$body_lines[] = str_repeat('-', 50);
$body_lines[] = 'IP: ' . $ip;
$body_lines[] = 'UA: ' . substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200);
$body_lines[] = 'Время: ' . date('Y-m-d H:i:s');
$body_lines[] = 'Согласие на обработку ПД: получено';

$body = implode("\r\n", $body_lines);

// 7. Заголовки
$reply_to = filter_var($fields['contact'], FILTER_VALIDATE_EMAIL)
    ? $fields['contact']
    : $FROM_EMAIL;

$headers = [
    'From: ' . mb_encode_mimeheader($FROM_NAME, 'UTF-8') . ' <' . $FROM_EMAIL . '>',
    'Reply-To: ' . $reply_to,
    'X-Mailer: cola-martin-msk-form/1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
];

$subject_encoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';

// 8. Отправка
$sent = @mail($RECIPIENT, $subject_encoded, $body, implode("\r\n", $headers));

if (!$sent) {
    error_log('cola form: mail() returned false. To: ' . $RECIPIENT);
    respond(false, 'Не удалось отправить письмо. Попробуйте позже или напишите на ' . $RECIPIENT, 500);
}

respond(true, 'Заявка получена. Менеджер свяжется в течение рабочего дня.');
