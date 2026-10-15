<?php
/**
 * Digital Treasure Hunters - Backend Multijugador por Salas, Equipos y Roles Dinámicos
 * Hosting: IONOS (www.forgeprojects.es/digital-treasure-hunters/api/)
 *
 * Incluye:
 * - Salas de partida independientes (con código de sala, ej. SALA-PRINCIPAL o salas privadas)
 * - Reparto automático e inteligente de los 5 roles entre los miembros de cada equipo
 *   (si hay menos de 5 jugadores en un equipo, se reparten varios roles por jugador automáticamente)
 * - Chat privado por equipo (Texto + Notas de Voz Walkie-Talkie + Canal de Voz en vivo)
 * - Inspector de URLs + Retos Alpha vs Beta con IA gratuita
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/data_store.json';
$ALL_ROLES = ['decoder', 'navigator', 'historian', 'translator', 'visual-analyst'];

function createDefaultRoom(string $code, string $name = 'Partida Principal ForgeProjects'): array {
    return [
        'code' => $code,
        'name' => $name,
        'createdAt' => time() * 1000,
        'matchStatus' => 'setup', // 'setup' (preparación) | 'hunting' (partida en curso) | 'finished'
        'teamReady' => [
            'team-alpha' => false,
            'team-beta' => false
        ],
        'teamScores' => [
            'team-alpha' => 0,
            'team-beta' => 0
        ],
        'players' => [],
        'challenges' => [],
        'chats' => [
            'team-alpha' => [
                [
                    'id' => 'welcome_alpha',
                    'senderId' => 'system',
                    'senderName' => 'Control de Mando',
                    'type' => 'text',
                    'text' => 'Canal encriptado del Equipo Alpha activo. Solo los miembros de Alpha pueden leer o escuchar este chat.',
                    'timestamp' => time() * 1000
                ]
            ],
            'team-beta' => [
                [
                    'id' => 'welcome_beta',
                    'senderId' => 'system',
                    'senderName' => 'Control de Mando',
                    'type' => 'text',
                    'text' => 'Canal encriptado del Equipo Beta activo. Solo los miembros de Beta pueden leer o escuchar este chat.',
                    'timestamp' => time() * 1000
                ]
            ]
        ]
    ];
}

// Cargar o inicializar almacén
$store = [];
if (file_exists($dataFile)) {
    $raw = @file_get_contents($dataFile);
    $store = json_decode($raw, true);
}
if (!is_array($store) || !isset($store['rooms'])) {
    $store = [
        'rooms' => [
            'SALA-1' => createDefaultRoom('SALA-1', 'Sala Oficial #1 — Alpha vs Beta')
        ]
    ];
    file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

/**
 * Reparte siempre los 5 roles entre los jugadores de un equipo en esa sala.
 * - Si hay 1 jugador en el equipo: recibe los 5 roles.
 * - Si hay 2 jugadores: uno recibe 3 roles y el otro 2 roles.
 * - Si hay 3 jugadores: dos reciben 2 roles y uno recibe 1 rol.
 * - Si hay 4 jugadores: uno recibe 2 roles y tres reciben 1 rol.
 * - Si hay 5 o más: cada uno recibe su rol preferido (y todos los 5 roles quedan cubiertos).
 */
function assignRolesForTeam(array &$players, string $teamId, array $allRoles): void {
    $teamPlayerIds = [];
    foreach ($players as $pid => $p) {
        if (($p['team'] ?? '') === $teamId) {
            $teamPlayerIds[] = $pid;
        }
    }

    $count = count($teamPlayerIds);
    if ($count === 0) {
        return;
    }

    // Ordenar de forma estable por orden de llegada (joinedAt)
    usort($teamPlayerIds, function ($a, $b) use ($players) {
        return ($players[$a]['joinedAt'] ?? 0) <=> ($players[$b]['joinedAt'] ?? 0);
    });

    // Inicializar lista de roles asignados a cada miembro con su rol preferido primero
    $assigned = [];
    $usedRoles = [];

    foreach ($teamPlayerIds as $pid) {
        $pref = $players[$pid]['preferredRole'] ?? 'decoder';
        if (!in_array($pref, $allRoles, true)) {
            $pref = 'decoder';
        }
        $assigned[$pid] = [];
        // Si ese rol preferido aún no está cubierto en el equipo, dárselo como principal
        if (!in_array($pref, $usedRoles, true)) {
            $assigned[$pid][] = $pref;
            $usedRoles[] = $pref;
        }
    }

    // Roles que faltan por cubrir de los 5 obligatorios
    $remainingRoles = array_values(array_diff($allRoles, $usedRoles));

    // Primero dar 1 rol a cualquier jugador que aún tenga 0 (porque su preferido estaba repetido)
    foreach ($teamPlayerIds as $pid) {
        if (empty($assigned[$pid])) {
            if (!empty($remainingRoles)) {
                $r = array_shift($remainingRoles);
                $assigned[$pid][] = $r;
                $usedRoles[] = $r;
            } else {
                $assigned[$pid][] = $players[$pid]['preferredRole'] ?? 'decoder';
            }
        }
    }

    // Si quedan roles sin cubrir (porque hay menos de 5 jugadores en el equipo),
    // repartirlos equitativamente en rueda (round-robin) entre los miembros del equipo
    $idx = 0;
    while (!empty($remainingRoles)) {
        $r = array_shift($remainingRoles);
        $targetPid = $teamPlayerIds[$idx % $count];
        if (!in_array($r, $assigned[$targetPid], true)) {
            $assigned[$targetPid][] = $r;
        }
        $idx++;
    }

    // Guardar en cada jugador sus roles asignados
    foreach ($teamPlayerIds as $pid) {
        $players[$pid]['assignedRoles'] = $assigned[$pid];
    }
}

function recalculateRoomRoles(array &$room, array $allRoles): void {
    if (!isset($room['players']) || !is_array($room['players'])) {
        $room['players'] = [];
    }
    // Limpiar jugadores inactivos de hace más de 6 horas
    $cutoff = (time() * 1000) - (6 * 3600 * 1000);
    foreach ($room['players'] as $pid => $p) {
        if (($p['lastSeen'] ?? 0) < $cutoff) {
            unset($room['players'][$pid]);
        }
    }

    assignRolesForTeam($room['players'], 'team-alpha', $allRoles);
    assignRolesForTeam($room['players'], 'team-beta', $allRoles);
}

/**
 * Inspecciona una URL remota para extraer metadatos reales para la IA
 */
function inspectRemoteUrl(string $url): array {
    $parsed = parse_url($url);
    $hostname = $parsed['host'] ?? 'sitio-web';
    $pathname = $parsed['path'] ?? '/';

    $result = [
        'url' => $url,
        'hostname' => $hostname,
        'pathname' => $pathname,
        'pageTitle' => $hostname,
        'headings' => [],
        'years' => [],
        'lang' => 'es',
        'linksCount' => 0
    ];

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 5,
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) DigitalTreasureHunters/2.0\r\nAccept-Language: es-ES,es;q=0.9,en;q=0.8\r\n"
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    $html = @file_get_contents($url, false, $ctx, 0, 220000);
    if (!$html) {
        return $result;
    }

    if (preg_match('/<html[^>]*lang=["\']?([a-zA-Z\-]+)["\']?/i', $html, $m)) {
        $result['lang'] = strtolower($m[1]);
    }
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
        $result['pageTitle'] = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    if (preg_match_all('/<h[1-3][^>]*>(.*?)<\/h[1-3]>/is', $html, $matches)) {
        $headings = [];
        foreach ($matches[1] as $h) {
            $clean = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($h), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            if (mb_strlen($clean) > 3 && count($headings) < 6) {
                $headings[] = $clean;
            }
        }
        $result['headings'] = array_values(array_unique($headings));
    }

    $textOnly = strip_tags($html);
    if (preg_match_all('/\b(1[0-9]{3}|20[0-2][0-9])\b/', $textOnly, $yearMatches)) {
        $result['years'] = array_slice(array_values(array_unique($yearMatches[1])), 0, 6);
    }

    $result['linksCount'] = substr_count(strtolower($html), '<a ');
    return $result;
}

$action = $_GET['action'] ?? 'status';
$roomCode = strtoupper(trim($_GET['room'] ?? 'SALA-1'));
if ($roomCode === '') {
    $roomCode = 'SALA-1';
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'inspectUrl') {
        $url = trim($_GET['url'] ?? '');
        if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
            echo json_encode(['success' => false, 'error' => 'URL no válida']);
            exit;
        }
        echo json_encode(['success' => true, 'metadata' => inspectRemoteUrl($url)]);
        exit;
    }

    if ($action === 'roomsList') {
        $summary = [];
        foreach ($store['rooms'] as $code => $r) {
            $summary[] = [
                'code' => $code,
                'name' => $r['name'] ?? $code,
                'playersCount' => count($r['players'] ?? []),
                'activeChallenges' => count(array_filter($r['challenges'] ?? [], fn($c) => ($c['status'] ?? '') === 'active')),
                'teamScores' => $r['teamScores'] ?? ['team-alpha' => 0, 'team-beta' => 0]
            ];
        }
        echo json_encode(['success' => true, 'rooms' => $summary]);
        exit;
    }

    if ($action === 'roomState' || $action === 'challenges') {
        if (!isset($store['rooms'][$roomCode])) {
            $store['rooms'][$roomCode] = createDefaultRoom($roomCode, "Partida $roomCode");
        }

        $room = &$store['rooms'][$roomCode];
        $playerId = trim($_GET['playerId'] ?? '');
        $teamId = trim($_GET['teamId'] ?? 'team-alpha');

        if ($playerId !== '' && isset($room['players'][$playerId])) {
            $room['players'][$playerId]['lastSeen'] = time() * 1000;
            $teamId = $room['players'][$playerId]['team'] ?? $teamId;
        }

        recalculateRoomRoles($room, $ALL_ROLES);

        // Asegurar estructura de estado de partida
        if (!isset($room['teamReady']) || !is_array($room['teamReady'])) {
            $room['teamReady'] = ['team-alpha' => false, 'team-beta' => false];
        }
        $hasAlphaChallenge = false;
        $hasBetaChallenge = false;
        foreach ($room['challenges'] ?? [] as $c) {
            if (($c['teamId'] ?? '') === 'team-alpha' && ($c['status'] ?? 'active') === 'active') {
                $hasAlphaChallenge = true;
            }
            if (($c['teamId'] ?? '') === 'team-beta' && ($c['status'] ?? 'active') === 'active') {
                $hasBetaChallenge = true;
            }
        }
        $teamHasChallenge = [
            'team-alpha' => $hasAlphaChallenge,
            'team-beta'  => $hasBetaChallenge
        ];

        // La partida empieza automáticamente cuando ambos equipos han subido su captura, rellenado los datos y confirmado equipos completos
        if ($hasAlphaChallenge && $hasBetaChallenge && !empty($room['teamReady']['team-alpha']) && !empty($room['teamReady']['team-beta'])) {
            $room['matchStatus'] = 'hunting';
        } else {
            $room['matchStatus'] = $room['matchStatus'] ?? 'setup';
            if ($room['matchStatus'] === 'hunting' && (!$hasAlphaChallenge || !$hasBetaChallenge || empty($room['teamReady']['team-alpha']) || empty($room['teamReady']['team-beta']))) {
                // Si aún no se cumplen las condiciones de inicio
                $room['matchStatus'] = 'setup';
            }
        }

        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        // Ocultar URL exacta y usar captura difuminada en retos activos de rivales hasta que se acierte
        $publicChallenges = array_map(function ($ch) use ($teamId) {
            $copy = $ch;
            $isSolved = (($copy['status'] ?? 'active') === 'solved');
            $isOwnTeam = (($copy['teamId'] ?? '') === $teamId);

            if (!$isSolved) {
                unset($copy['url']);
                if (!$isOwnTeam) {
                    unset($copy['secretLabel']);
                    unset($copy['targetPoint']);
                    // Si existe versión difuminada (blurredScreenshot), enviarla en lugar de la original hasta que acierten
                    if (!empty($copy['blurredScreenshot'])) {
                        $copy['screenshot'] = $copy['blurredScreenshot'];
                        $copy['isBlurred'] = true;
                    }
                }
            }
            unset($copy['blurredScreenshot']);
            return $copy;
        }, array_slice($room['challenges'] ?? [], 0, 25));

        // Enviar únicamente el chat privado del equipo al que pertenece el jugador
        $teamChat = $room['chats'][$teamId] ?? [];

        echo json_encode([
            'success' => true,
            'roomCode' => $roomCode,
            'roomName' => $room['name'] ?? $roomCode,
            'matchStatus' => $room['matchStatus'],
            'teamReady' => $room['teamReady'],
            'teamHasChallenge' => $teamHasChallenge,
            'teamScores' => $room['teamScores'] ?? ['team-alpha' => 0, 'team-beta' => 0],
            'players' => array_values($room['players'] ?? []),
            'challenges' => $publicChallenges,
            'teamChat' => array_slice($teamChat, -35)
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'service' => 'Digital Treasure Hunters Multiplayer Hub API',
        'host' => 'forgeprojects.es',
        'roomsCount' => count($store['rooms'])
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $roomCode = strtoupper(trim($input['roomCode'] ?? ($_GET['room'] ?? 'SALA-1')));
    $roomCode = preg_replace('/[^A-Z0-9\-_]/', '', $roomCode);
    if ($roomCode === '') {
        $roomCode = 'SALA-1';
    }

    if (!isset($store['rooms'][$roomCode])) {
        $roomName = htmlspecialchars(trim($input['roomName'] ?? "Sala $roomCode"));
        $store['rooms'][$roomCode] = createDefaultRoom($roomCode, $roomName);
    }

    $room = &$store['rooms'][$roomCode];

    // 1. Unirse a sala / Cambiar de equipo o de rol preferido / Heartbeat
    if ($action === 'joinRoom') {
        $playerId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $input['playerId'] ?? ('p_' . uniqid()));
        $name = htmlspecialchars(mb_substr(trim($input['name'] ?? 'Agente'), 0, 24));
        $team = ($input['team'] ?? 'team-alpha') === 'team-beta' ? 'team-beta' : 'team-alpha';
        $preferredRole = $input['preferredRole'] ?? 'decoder';
        if (!in_array($preferredRole, $ALL_ROLES, true)) {
            $preferredRole = 'decoder';
        }

        $existingJoinedAt = $room['players'][$playerId]['joinedAt'] ?? (time() * 1000);

        $room['players'][$playerId] = [
            'id' => $playerId,
            'name' => $name ?: 'Agente',
            'team' => $team,
            'preferredRole' => $preferredRole,
            'assignedRoles' => [$preferredRole],
            'joinedAt' => $existingJoinedAt,
            'lastSeen' => time() * 1000
        ];

        recalculateRoomRoles($room, $ALL_ROLES);
        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'roomCode' => $roomCode,
            'player' => $room['players'][$playerId],
            'players' => array_values($room['players'])
        ]);
        exit;
    }

    // 2. Enviar mensaje de texto o nota de voz (Walkie-Talkie) al chat privado del equipo
    if ($action === 'sendTeamMessage') {
        $teamId = ($input['teamId'] ?? 'team-alpha') === 'team-beta' ? 'team-beta' : 'team-alpha';
        $senderId = htmlspecialchars($input['playerId'] ?? 'anon');
        $senderName = htmlspecialchars(mb_substr(trim($input['senderName'] ?? 'Agente'), 0, 24));
        $msgType = ($input['type'] ?? 'text') === 'audio' ? 'audio' : 'text';
        $text = htmlspecialchars(mb_substr(trim($input['text'] ?? ''), 0, 500));
        $audioData = $input['audioData'] ?? null;

        if ($msgType === 'text' && $text === '') {
            echo json_encode(['success' => false, 'error' => 'Mensaje vacío']);
            exit;
        }

        // Validar que el audio sea un data URL razonable (< 350 KB)
        if ($msgType === 'audio') {
            if (!is_string($audioData) || strpos($audioData, 'data:audio/') !== 0 || strlen($audioData) > 480000) {
                echo json_encode(['success' => false, 'error' => 'Nota de voz demasiado larga o formato inválido']);
                exit;
            }
        }

        if (!isset($room['chats'][$teamId])) {
            $room['chats'][$teamId] = [];
        }

        $newMsg = [
            'id' => 'msg_' . round(microtime(true) * 1000) . '_' . rand(10, 99),
            'senderId' => $senderId,
            'senderName' => $senderName,
            'type' => $msgType,
            'text' => $text,
            'audioData' => $msgType === 'audio' ? $audioData : null,
            'timestamp' => time() * 1000
        ];

        $room['chats'][$teamId][] = $newMsg;
        // Mantener los últimos 30 mensajes por equipo para que el JSON sea rápido
        $room['chats'][$teamId] = array_slice($room['chats'][$teamId], -30);

        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'message' => $newMsg,
            'teamChat' => $room['chats'][$teamId]
        ]);
        exit;
    }

    // 3. Crear o actualizar el reto del equipo y marcar si el equipo está completo/listo
    if ($action === 'createChallenge' && !empty($input['challenge'])) {
        $ch = $input['challenge'];
        $ch['id'] = $ch['id'] ?? ('ch_' . round(microtime(true) * 1000));
        $ch['createdAt'] = time() * 1000;
        $ch['status'] = 'active';
        $ch['roomCode'] = $roomCode;
        $teamOfChallenge = ($ch['teamId'] ?? 'team-alpha') === 'team-beta' ? 'team-beta' : 'team-alpha';
        $ch['teamId'] = $teamOfChallenge;

        // Reemplazar reto activo anterior de este mismo equipo en la ronda actual para mantener 1 objetivo activo por equipo
        $room['challenges'] = array_values(array_filter($room['challenges'] ?? [], function ($existing) use ($teamOfChallenge) {
            return !(($existing['teamId'] ?? '') === $teamOfChallenge && ($existing['status'] ?? 'active') === 'active');
        }));

        array_unshift($room['challenges'], $ch);
        $room['challenges'] = array_slice($room['challenges'], 0, 25);

        if (!isset($room['teamReady']) || !is_array($room['teamReady'])) {
            $room['teamReady'] = ['team-alpha' => false, 'team-beta' => false];
        }
        if (!empty($input['teamReady'])) {
            $room['teamReady'][$teamOfChallenge] = true;
        }

        // Comprobar si ambos equipos ya tienen captura + datos y han confirmado equipos completos
        $hasAlpha = false;
        $hasBeta  = false;
        foreach ($room['challenges'] as $c) {
            if (($c['teamId'] ?? '') === 'team-alpha' && ($c['status'] ?? 'active') === 'active') $hasAlpha = true;
            if (($c['teamId'] ?? '') === 'team-beta' && ($c['status'] ?? 'active') === 'active') $hasBeta = true;
        }
        if ($hasAlpha && $hasBeta && !empty($room['teamReady']['team-alpha']) && !empty($room['teamReady']['team-beta'])) {
            $room['matchStatus'] = 'hunting';
        } else {
            $room['matchStatus'] = 'setup';
        }

        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'challenge' => $ch,
            'matchStatus' => $room['matchStatus'],
            'teamReady' => $room['teamReady'],
            'teamScores' => $room['teamScores']
        ]);
        exit;
    }

    // 3b. Confirmar / cambiar estado de "Equipo Completo y Listo" o iniciar nueva ronda
    if ($action === 'setTeamReady') {
        $teamId = ($input['teamId'] ?? 'team-alpha') === 'team-beta' ? 'team-beta' : 'team-alpha';
        $ready = isset($input['ready']) ? (bool)$input['ready'] : true;
        if (!isset($room['teamReady']) || !is_array($room['teamReady'])) {
            $room['teamReady'] = ['team-alpha' => false, 'team-beta' => false];
        }
        $room['teamReady'][$teamId] = $ready;

        $hasAlpha = false;
        $hasBeta  = false;
        foreach ($room['challenges'] ?? [] as $c) {
            if (($c['teamId'] ?? '') === 'team-alpha' && ($c['status'] ?? 'active') === 'active') $hasAlpha = true;
            if (($c['teamId'] ?? '') === 'team-beta' && ($c['status'] ?? 'active') === 'active') $hasBeta = true;
        }
        if ($hasAlpha && $hasBeta && !empty($room['teamReady']['team-alpha']) && !empty($room['teamReady']['team-beta'])) {
            $room['matchStatus'] = 'hunting';
        } else {
            $room['matchStatus'] = 'setup';
        }

        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'matchStatus' => $room['matchStatus'],
            'teamReady' => $room['teamReady']
        ]);
        exit;
    }

    if ($action === 'newRound') {
        $room['matchStatus'] = 'setup';
        $room['teamReady'] = ['team-alpha' => false, 'team-beta' => false];
        $room['challenges'] = [];
        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        echo json_encode(['success' => true, 'matchStatus' => 'setup', 'teamReady' => $room['teamReady']]);
        exit;
    }

    // 4. Verificar intento de resolución (URL + punto en la captura o palabra clave)
    if ($action === 'verifyAttempt' && !empty($input['challengeId'])) {
        if (($room['matchStatus'] ?? 'setup') !== 'hunting') {
            echo json_encode([
                'success' => false,
                'error' => '⏳ La partida aún no ha comenzado. Ambos equipos deben subir su captura, rellenar los datos y confirmar que los equipos están completos.'
            ]);
            exit;
        }
        $challengeId = $input['challengeId'];
        $attemptUrl = strtolower(trim($input['attemptUrl'] ?? ''));
        $attemptKeyword = mb_strtolower(trim($input['attemptKeyword'] ?? ''));
        $clickX = isset($input['clickX']) ? floatval($input['clickX']) : null;
        $clickY = isset($input['clickY']) ? floatval($input['clickY']) : null;
        $solverTeam = ($input['solverTeam'] ?? 'team-beta') === 'team-alpha' ? 'team-alpha' : 'team-beta';
        $solverName = htmlspecialchars($input['solverName'] ?? 'Agente');

        $foundIndex = -1;
        foreach ($room['challenges'] as $idx => $ch) {
            if (($ch['id'] ?? '') === $challengeId) {
                $foundIndex = $idx;
                break;
            }
        }

        if ($foundIndex === -1) {
            echo json_encode(['success' => false, 'error' => 'Reto no encontrado en esta sala']);
            exit;
        }

        $target = $room['challenges'][$foundIndex];

        $targetUrl = strtolower(trim($target['url'] ?? ''));
        $targetHost = strtolower(preg_replace('/^www\./', '', parse_url($targetUrl, PHP_URL_HOST) ?? ($target['hostname'] ?? '')));
        $attemptHost = strtolower(preg_replace('/^www\./', '', parse_url($attemptUrl, PHP_URL_HOST) ?? $attemptUrl));

        $cleanTargetUrl = rtrim(preg_replace('/^https?:\/\/(www\.)?/', '', $targetUrl), '/');
        $cleanAttemptUrl = rtrim(preg_replace('/^https?:\/\/(www\.)?/', '', $attemptUrl), '/');

        $urlMatches = ($cleanTargetUrl !== '' && $cleanAttemptUrl === $cleanTargetUrl) ||
                      ($targetHost !== '' && $attemptHost === $targetHost && strpos($cleanAttemptUrl, $targetHost) !== false);

        $targetPoint = $target['targetPoint'] ?? null;
        $coordMatches = false;
        if ($targetPoint && $clickX !== null && $clickY !== null) {
            $dist = hypot($clickX - floatval($targetPoint['x']), $clickY - floatval($targetPoint['y']));
            $coordMatches = ($dist <= 18.0);
        } elseif (!$targetPoint) {
            $coordMatches = true;
        }

        $targetSecret = mb_strtolower(trim($target['secretLabel'] ?? ''));
        $keywordMatches = ($targetSecret !== '' && $attemptKeyword !== '' && (
            mb_strpos($targetSecret, $attemptKeyword) !== false ||
            mb_strpos($attemptKeyword, $targetSecret) !== false
        ));

        if (!$urlMatches && !$keywordMatches) {
            echo json_encode([
                'success' => true,
                'solved' => false,
                'hint' => '❌ La URL o dominio no coincide con el lugar donde se tomó la captura. Consulta por el chat o voz con el Decodificador y el Navegador de tu equipo.'
            ]);
            exit;
        }

        if ($urlMatches && !$coordMatches && !$keywordMatches) {
            echo json_encode([
                'success' => true,
                'solved' => false,
                'partialUrlMatch' => true,
                'hint' => '⚠️ ¡Acertaste la web! Pero no marcaste el punto exacto en la captura ni la palabra clave. Pregunta al Analista Visual de tu equipo.'
            ]);
            exit;
        }

        if (($room['challenges'][$foundIndex]['status'] ?? '') !== 'solved') {
            $room['challenges'][$foundIndex]['status'] = 'solved';
            $room['challenges'][$foundIndex]['solvedAt'] = time() * 1000;
            $room['challenges'][$foundIndex]['solvedByTeam'] = $solverTeam;
            $room['challenges'][$foundIndex]['solvedByName'] = $solverName;

            if (!isset($room['teamScores'][$solverTeam])) {
                $room['teamScores'][$solverTeam] = 0;
            }
            $room['teamScores'][$solverTeam]++;

            // Publicar aviso automático en el chat del equipo ganador
            $room['chats'][$solverTeam][] = [
                'id' => 'msg_win_' . time(),
                'senderId' => 'system',
                'senderName' => 'Control de Mando',
                'type' => 'text',
                'text' => "🏆 ¡{$solverName} ha resuelto el objetivo y suma +1 punto para el equipo!",
                'timestamp' => time() * 1000
            ];

            file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }

        echo json_encode([
            'success' => true,
            'solved' => true,
            'teamScores' => $room['teamScores'],
            'challenge' => $room['challenges'][$foundIndex]
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Acción POST no válida']);
    exit;
}
