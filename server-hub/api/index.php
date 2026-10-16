<?php
/**
 * Digital Treasure Hunters - Backend Multijugador (2 o 4 Equipos, Salas Abiertas/Privadas, Perfiles y Estadísticas)
 * Hosting: IONOS (www.forgeprojects.es/digital-treasure-hunters/api/)
 *
 * Incluye:
 * - Pantalla Principal con Creación de Partida (2 o 4 equipos, nombre personalizado o por defecto en listado abierto)
 * - Partidas Abiertas (públicas) y Partidas Privadas por código/nombre
 * - Registro/Login (Google, Meta, Email o Invitado sin registro) con estadísticas individuales y de equipos
 * - Reparto dinámico de los 5 roles entre los miembros presentes de cada equipo
 * - Capturas rivales difuminadas por equipo hasta que ese equipo acierte
 * - Modo 2 o 4 equipos: la partida empieza cuando todos los equipos han subido captura, rellenado datos y confirmado equipo completo;
 *   el primer equipo en adivinar las capturas de todos los equipos rivales gana la partida.
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
$ALL_TEAMS_4 = ['team-alpha', 'team-beta', 'team-gamma', 'team-delta'];
$TEAM_LABELS = [
    'team-alpha' => '⚔️ Equipo Alpha',
    'team-beta'  => '🛡️ Equipo Beta',
    'team-gamma' => '⚡ Equipo Gamma',
    'team-delta' => '🔥 Equipo Delta'
];

function getTeamsForMax(int $maxTeams): array {
    return $maxTeams === 4
        ? ['team-alpha', 'team-beta', 'team-gamma', 'team-delta']
        : ['team-alpha', 'team-beta'];
}

function createDefaultRoom(string $code, string $name = '', int $maxTeams = 2, bool $isPublic = true): array {
    $maxTeams = ($maxTeams === 4) ? 4 : 2;
    $teams = getTeamsForMax($maxTeams);
    if (trim($name) === '') {
        $name = "Expedición Digital #$code";
    }

    $teamReady = [];
    $teamScores = [];
    $chats = [];

    foreach ($teams as $t) {
        $teamReady[$t] = false;
        $teamScores[$t] = 0;
        $label = $GLOBALS['TEAM_LABELS'][$t] ?? $t;
        $chats[$t] = [
            [
                'id' => 'welcome_' . $t,
                'senderId' => 'system',
                'senderName' => 'Control de Mando',
                'type' => 'text',
                'text' => "🔒 Canal encriptado de {$label} activo. Solo tu escuadrón puede leer o escuchar este chat.",
                'timestamp' => time() * 1000
            ]
        ];
    }

    return [
        'code' => $code,
        'name' => $name,
        'maxTeams' => $maxTeams,
        'isPublic' => $isPublic,
        'createdAt' => time() * 1000,
        'matchStatus' => 'setup', // 'setup' | 'hunting' | 'finished'
        'winnerTeam' => null,
        'winnerAt' => null,
        'teamReady' => $teamReady,
        'teamScores' => $teamScores,
        'players' => [],
        'challenges' => [],
        'chats' => $chats
    ];
}

// Cargar o inicializar almacén
$store = [];
if (file_exists($dataFile)) {
    $raw = @file_get_contents($dataFile);
    $store = json_decode($raw, true);
}
if (!is_array($store)) {
    $store = [];
}
if (!isset($store['rooms']) || !is_array($store['rooms'])) {
    $store['rooms'] = [
        'SALA-1' => createDefaultRoom('SALA-1', 'Caza Abierta Oficial #1 (2 Equipos)', 2, true),
        'SALA-4X' => createDefaultRoom('SALA-4X', 'Batalla Cuádruple #2 (4 Equipos)', 4, true)
    ];
}
if (!isset($store['users']) || !is_array($store['users'])) {
    $store['users'] = [];
}
if (!isset($store['globalTeamStats']) || !is_array($store['globalTeamStats'])) {
    $store['globalTeamStats'] = [
        'team-alpha' => ['matchesWon' => 0, 'capturesSolved' => 0, 'challengesHidden' => 0],
        'team-beta'  => ['matchesWon' => 0, 'capturesSolved' => 0, 'challengesHidden' => 0],
        'team-gamma' => ['matchesWon' => 0, 'capturesSolved' => 0, 'challengesHidden' => 0],
        'team-delta' => ['matchesWon' => 0, 'capturesSolved' => 0, 'challengesHidden' => 0]
    ];
}

/**
 * Normaliza estructura de una sala existente (retrocompatibilidad con salas creadas antes)
 */
function normalizeRoom(array &$room): void {
    $maxTeams = intval($room['maxTeams'] ?? 2);
    $room['maxTeams'] = ($maxTeams === 4) ? 4 : 2;
    if (!isset($room['isPublic'])) {
        $room['isPublic'] = true;
    }
    if (!isset($room['winnerTeam'])) {
        $room['winnerTeam'] = null;
    }
    $teams = getTeamsForMax($room['maxTeams']);
    if (!isset($room['teamReady']) || !is_array($room['teamReady'])) {
        $room['teamReady'] = [];
    }
    if (!isset($room['teamScores']) || !is_array($room['teamScores'])) {
        $room['teamScores'] = [];
    }
    if (!isset($room['chats']) || !is_array($room['chats'])) {
        $room['chats'] = [];
    }
    foreach ($teams as $t) {
        if (!array_key_exists($t, $room['teamReady'])) {
            $room['teamReady'][$t] = false;
        }
        if (!array_key_exists($t, $room['teamScores'])) {
            $room['teamScores'][$t] = 0;
        }
        if (!isset($room['chats'][$t])) {
            $label = $GLOBALS['TEAM_LABELS'][$t] ?? $t;
            $room['chats'][$t] = [[
                'id' => 'welcome_' . $t,
                'senderId' => 'system',
                'senderName' => 'Control de Mando',
                'type' => 'text',
                'text' => "🔒 Canal encriptado de {$label} activo.",
                'timestamp' => time() * 1000
            ]];
        }
    }
}

/**
 * Reparte siempre los 5 roles entre los jugadores de un equipo en esa sala.
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

    usort($teamPlayerIds, function ($a, $b) use ($players) {
        return ($players[$a]['joinedAt'] ?? 0) <=> ($players[$b]['joinedAt'] ?? 0);
    });

    $assigned = [];
    $usedRoles = [];

    foreach ($teamPlayerIds as $pid) {
        $pref = $players[$pid]['preferredRole'] ?? 'decoder';
        if (!in_array($pref, $allRoles, true)) {
            $pref = 'decoder';
        }
        $assigned[$pid] = [];
        if (!in_array($pref, $usedRoles, true)) {
            $assigned[$pid][] = $pref;
            $usedRoles[] = $pref;
        }
    }

    $remainingRoles = array_values(array_diff($allRoles, $usedRoles));

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

    $idx = 0;
    while (!empty($remainingRoles)) {
        $r = array_shift($remainingRoles);
        $targetPid = $teamPlayerIds[$idx % $count];
        if (!in_array($r, $assigned[$targetPid], true)) {
            $assigned[$targetPid][] = $r;
        }
        $idx++;
    }

    foreach ($teamPlayerIds as $pid) {
        $players[$pid]['assignedRoles'] = $assigned[$pid];
    }
}

function recalculateRoomRoles(array &$room, array $allRoles): void {
    normalizeRoom($room);
    if (!isset($room['players']) || !is_array($room['players'])) {
        $room['players'] = [];
    }
    $cutoff = (time() * 1000) - (6 * 3600 * 1000);
    foreach ($room['players'] as $pid => $p) {
        if (($p['lastSeen'] ?? 0) < $cutoff) {
            unset($room['players'][$pid]);
        }
    }

    $teams = getTeamsForMax($room['maxTeams']);
    foreach ($teams as $t) {
        assignRolesForTeam($room['players'], $t, $allRoles);
    }
}

/**
 * Calcula qué equipos ya subieron su captura y si la partida debe pasar a 'hunting'
 */
function evaluateRoomMatchStatus(array &$room): array {
    normalizeRoom($room);
    $teams = getTeamsForMax($room['maxTeams']);
    $teamHasChallenge = [];
    foreach ($teams as $t) {
        $teamHasChallenge[$t] = false;
    }

    foreach ($room['challenges'] ?? [] as $c) {
        $ct = $c['teamId'] ?? '';
        if (isset($teamHasChallenge[$ct])) {
            $teamHasChallenge[$ct] = true;
        }
    }

    // Si la partida ya terminó con un ganador, mantener 'finished' hasta nueva ronda
    if (($room['matchStatus'] ?? '') === 'finished' && !empty($room['winnerTeam'])) {
        return $teamHasChallenge;
    }

    $allReadyAndUploaded = true;
    foreach ($teams as $t) {
        if (empty($teamHasChallenge[$t]) || empty($room['teamReady'][$t])) {
            $allReadyAndUploaded = false;
            break;
        }
    }

    $room['matchStatus'] = $allReadyAndUploaded ? 'hunting' : 'setup';
    return $teamHasChallenge;
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
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) DigitalTreasureHunters/3.0\r\nAccept-Language: es-ES,es;q=0.9,en;q=0.8\r\n"
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

    // Listado de salas abiertas y estadísticas globales para la Pantalla Principal (Lobby)
    if ($action === 'roomsList' || $action === 'lobbyData') {
        $roomsSummary = [];
        foreach ($store['rooms'] as $code => &$r) {
            normalizeRoom($r);
            $teamHasChallenge = evaluateRoomMatchStatus($r);
            $teamsReadyCount = 0;
            foreach (getTeamsForMax($r['maxTeams']) as $t) {
                if (!empty($teamHasChallenge[$t]) && !empty($r['teamReady'][$t])) {
                    $teamsReadyCount++;
                }
            }
            $roomsSummary[] = [
                'code' => $code,
                'name' => $r['name'] ?? $code,
                'maxTeams' => $r['maxTeams'],
                'isPublic' => (bool)($r['isPublic'] ?? true),
                'matchStatus' => $r['matchStatus'] ?? 'setup',
                'winnerTeam' => $r['winnerTeam'] ?? null,
                'playersCount' => count($r['players'] ?? []),
                'teamsReadyCount' => $teamsReadyCount,
                'activeChallenges' => count($r['challenges'] ?? []),
                'teamScores' => $r['teamScores'],
                'createdAt' => $r['createdAt'] ?? (time() * 1000)
            ];
        }
        unset($r);

        // Ordenar salas abiertas más recientes primero
        usort($roomsSummary, fn($a, $b) => ($b['createdAt'] ?? 0) <=> ($a['createdAt'] ?? 0));

        // Top jugadores registrados
        $leaderboard = array_values($store['users'] ?? []);
        usort($leaderboard, function ($a, $b) {
            $scoreA = (($a['stats']['matchesWon'] ?? 0) * 3) + ($a['stats']['capturesSolved'] ?? 0);
            $scoreB = (($b['stats']['matchesWon'] ?? 0) * 3) + ($b['stats']['capturesSolved'] ?? 0);
            return $scoreB <=> $scoreA;
        });

        echo json_encode([
            'success' => true,
            'rooms' => $roomsSummary,
            'openRooms' => array_values(array_filter($roomsSummary, fn($rm) => $rm['isPublic'])),
            'leaderboard' => array_slice($leaderboard, 0, 15),
            'globalTeamStats' => $store['globalTeamStats']
        ]);
        exit;
    }

    if ($action === 'roomState' || $action === 'challenges') {
        if (!isset($store['rooms'][$roomCode])) {
            $store['rooms'][$roomCode] = createDefaultRoom($roomCode, "Expedición Digital #$roomCode", 2, true);
        }

        $room = &$store['rooms'][$roomCode];
        normalizeRoom($room);
        $validTeams = getTeamsForMax($room['maxTeams']);

        $playerId = trim($_GET['playerId'] ?? '');
        $teamId = trim($_GET['teamId'] ?? 'team-alpha');
        if (!in_array($teamId, $validTeams, true)) {
            $teamId = 'team-alpha';
        }

        if ($playerId !== '' && isset($room['players'][$playerId])) {
            $room['players'][$playerId]['lastSeen'] = time() * 1000;
            $teamId = $room['players'][$playerId]['team'] ?? $teamId;
        }

        recalculateRoomRoles($room, $ALL_ROLES);
        $teamHasChallenge = evaluateRoomMatchStatus($room);

        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        // Para cada reto: se mantiene difuminado para un equipo cazador mientras ESE equipo aún no lo haya resuelto
        $publicChallenges = array_map(function ($ch) use ($teamId) {
            $copy = $ch;
            $solvedByTeams = $copy['solvedByTeams'] ?? [];
            if (!is_array($solvedByTeams)) {
                $solvedByTeams = [];
            }
            $isOwnTeam = (($copy['teamId'] ?? '') === $teamId);
            $hasMyTeamSolvedIt = in_array($teamId, $solvedByTeams, true) || (($copy['status'] ?? '') === 'solved' && ($copy['solvedByTeam'] ?? '') === $teamId);

            $copy['solvedByMyTeam'] = $hasMyTeamSolvedIt;
            $copy['solvedByTeams'] = $solvedByTeams;

            if (!$isOwnTeam && !$hasMyTeamSolvedIt) {
                unset($copy['url']);
                unset($copy['secretLabel']);
                unset($copy['targetPoint']);
                if (!empty($copy['blurredScreenshot'])) {
                    $copy['screenshot'] = $copy['blurredScreenshot'];
                    $copy['isBlurred'] = true;
                }
            }
            unset($copy['blurredScreenshot']);
            return $copy;
        }, array_slice($room['challenges'] ?? [], 0, 25));

        $teamChat = $room['chats'][$teamId] ?? [];

        echo json_encode([
            'success' => true,
            'roomCode' => $roomCode,
            'roomName' => $room['name'] ?? $roomCode,
            'maxTeams' => $room['maxTeams'],
            'isPublic' => (bool)($room['isPublic'] ?? true),
            'matchStatus' => $room['matchStatus'],
            'winnerTeam' => $room['winnerTeam'] ?? null,
            'teamReady' => $room['teamReady'],
            'teamHasChallenge' => $teamHasChallenge,
            'teamScores' => $room['teamScores'],
            'players' => array_values($room['players'] ?? []),
            'challenges' => $publicChallenges,
            'teamChat' => array_slice($teamChat, -35),
            'globalTeamStats' => $store['globalTeamStats']
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

    // 0. Registro / Inicio de Sesión (Google, Meta, E-mail o Invitado sin registro)
    if ($action === 'authUser') {
        $provider = strtolower(trim($input['provider'] ?? 'guest'));
        if (!in_array($provider, ['google', 'meta', 'email', 'guest'], true)) {
            $provider = 'guest';
        }
        $name = htmlspecialchars(mb_substr(trim($input['name'] ?? 'Explorador'), 0, 28));
        $email = strtolower(trim($input['email'] ?? ''));
        $userId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $input['userId'] ?? '');

        if ($provider !== 'guest' && $email !== '') {
            $userId = 'usr_' . substr(md5($provider . ':' . $email), 0, 12);
        } elseif ($userId === '') {
            $userId = 'gst_' . substr(md5(uniqid('', true)), 0, 10);
        }

        if (!isset($store['users'][$userId])) {
            $store['users'][$userId] = [
                'id' => $userId,
                'name' => $name ?: 'Explorador',
                'email' => $email,
                'provider' => $provider,
                'isRegistered' => ($provider !== 'guest'),
                'createdAt' => time() * 1000,
                'stats' => [
                    'matchesPlayed' => 0,
                    'matchesWon' => 0,
                    'capturesSolved' => 0,
                    'challengesHidden' => 0
                ]
            ];
        } else {
            if ($name !== '') {
                $store['users'][$userId]['name'] = $name;
            }
            if ($provider !== 'guest') {
                $store['users'][$userId]['provider'] = $provider;
                $store['users'][$userId]['isRegistered'] = true;
            }
        }

        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        echo json_encode(['success' => true, 'user' => $store['users'][$userId]]);
        exit;
    }

    // 0b. Crear Nueva Partida desde la Pantalla Principal (2 o 4 equipos, con o sin nombre personalizado)
    if ($action === 'createRoom') {
        $maxTeams = intval($input['maxTeams'] ?? 2) === 4 ? 4 : 2;
        $customName = trim($input['roomName'] ?? '');
        $forcePrivate = isset($input['isPrivate']) ? (bool)$input['isPrivate'] : false;

        // Si el jugador no le da ningún nombre a la sala, el juego le asigna uno por defecto y aparece en Partidas Abiertas
        if ($customName === '') {
            $num = rand(100, 999);
            $code = 'ABIERTA-' . $num;
            $roomName = ($maxTeams === 4)
                ? "Expedición Abierta #{$num} (4 Equipos)"
                : "Expedición Abierta #{$num} (2 Equipos)";
            $isPublic = true;
        } else {
            $cleanName = htmlspecialchars(mb_substr($customName, 0, 40));
            $slug = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $customName) ?: $customName));
            $code = ($slug !== '' ? substr($slug, 0, 10) : 'SALA') . '-' . rand(10, 99);
            $roomName = $cleanName;
            $isPublic = !$forcePrivate;
        }

        $store['rooms'][$code] = createDefaultRoom($code, $roomName, $maxTeams, $isPublic);
        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'room' => $store['rooms'][$code]
        ]);
        exit;
    }

    // Buscar sala por código o por nombre (para Unirse a Partida Privada o Abierta)
    $rawQueryRoom = trim($input['roomCode'] ?? ($_GET['room'] ?? 'SALA-1'));
    $roomCode = strtoupper(preg_replace('/[^A-Z0-9\-_]/', '', $rawQueryRoom));
    if ($roomCode === '') {
        $roomCode = 'SALA-1';
    }

    // Si el usuario escribió el nombre de la sala en vez del código, buscar coincidencia por nombre
    if (!isset($store['rooms'][$roomCode]) && $rawQueryRoom !== '') {
        foreach ($store['rooms'] as $cCode => $rData) {
            if (mb_strtolower(trim($rData['name'] ?? '')) === mb_strtolower($rawQueryRoom)) {
                $roomCode = $cCode;
                break;
            }
        }
    }

    if (!isset($store['rooms'][$roomCode])) {
        $maxTeamsReq = intval($input['maxTeams'] ?? 2) === 4 ? 4 : 2;
        $roomName = htmlspecialchars(trim($input['roomName'] ?? ''));
        $store['rooms'][$roomCode] = createDefaultRoom($roomCode, $roomName, $maxTeamsReq, true);
    }

    $room = &$store['rooms'][$roomCode];
    normalizeRoom($room);
    $validTeams = getTeamsForMax($room['maxTeams']);

    // 1. Unirse a sala / Cambiar de equipo o de rol preferido / Heartbeat
    if ($action === 'joinRoom') {
        $playerId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $input['playerId'] ?? ('p_' . uniqid()));
        $name = htmlspecialchars(mb_substr(trim($input['name'] ?? 'Agente'), 0, 24));
        $requestedTeam = $input['team'] ?? 'team-alpha';
        $team = in_array($requestedTeam, $validTeams, true) ? $requestedTeam : 'team-alpha';

        $preferredRole = $input['preferredRole'] ?? 'decoder';
        if (!in_array($preferredRole, $ALL_ROLES, true)) {
            $preferredRole = 'decoder';
        }

        $existingJoinedAt = $room['players'][$playerId]['joinedAt'] ?? (time() * 1000);
        $isNewInRoom = !isset($room['players'][$playerId]);

        $room['players'][$playerId] = [
            'id' => $playerId,
            'name' => $name ?: 'Agente',
            'team' => $team,
            'preferredRole' => $preferredRole,
            'assignedRoles' => [$preferredRole],
            'joinedAt' => $existingJoinedAt,
            'lastSeen' => time() * 1000
        ];

        if ($isNewInRoom && isset($store['users'][$playerId])) {
            $store['users'][$playerId]['stats']['matchesPlayed'] = ($store['users'][$playerId]['stats']['matchesPlayed'] ?? 0) + 1;
        }

        recalculateRoomRoles($room, $ALL_ROLES);
        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'roomCode' => $roomCode,
            'roomName' => $room['name'],
            'maxTeams' => $room['maxTeams'],
            'player' => $room['players'][$playerId],
            'players' => array_values($room['players'])
        ]);
        exit;
    }

    // 2. Enviar mensaje de texto o nota de voz (Walkie-Talkie) al chat privado del equipo
    if ($action === 'sendTeamMessage') {
        $reqTeam = $input['teamId'] ?? 'team-alpha';
        $teamId = in_array($reqTeam, $validTeams, true) ? $reqTeam : 'team-alpha';
        $senderId = htmlspecialchars($input['playerId'] ?? 'anon');
        $senderName = htmlspecialchars(mb_substr(trim($input['senderName'] ?? 'Agente'), 0, 24));
        $msgType = ($input['type'] ?? 'text') === 'audio' ? 'audio' : 'text';
        $text = htmlspecialchars(mb_substr(trim($input['text'] ?? ''), 0, 500));
        $audioData = $input['audioData'] ?? null;

        if ($msgType === 'text' && $text === '') {
            echo json_encode(['success' => false, 'error' => 'Mensaje vacío']);
            exit;
        }

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
        $reqTeam = $ch['teamId'] ?? 'team-alpha';
        $teamOfChallenge = in_array($reqTeam, $validTeams, true) ? $reqTeam : 'team-alpha';
        $ch['teamId'] = $teamOfChallenge;
        $ch['solvedByTeams'] = [];

        // Reemplazar reto anterior de este mismo equipo en la ronda actual para que haya 1 captura por equipo
        $room['challenges'] = array_values(array_filter($room['challenges'] ?? [], function ($existing) use ($teamOfChallenge) {
            return ($existing['teamId'] ?? '') !== $teamOfChallenge;
        }));

        array_unshift($room['challenges'], $ch);
        $room['challenges'] = array_slice($room['challenges'], 0, 25);

        if (!empty($input['teamReady'])) {
            $room['teamReady'][$teamOfChallenge] = true;
        }

        // Estadísticas de creación de reto
        $creatorId = $input['playerId'] ?? '';
        if ($creatorId !== '' && isset($store['users'][$creatorId])) {
            $store['users'][$creatorId]['stats']['challengesHidden'] = ($store['users'][$creatorId]['stats']['challengesHidden'] ?? 0) + 1;
        }
        if (isset($store['globalTeamStats'][$teamOfChallenge])) {
            $store['globalTeamStats'][$teamOfChallenge]['challengesHidden'] = ($store['globalTeamStats'][$teamOfChallenge]['challengesHidden'] ?? 0) + 1;
        }

        $teamHasChallenge = evaluateRoomMatchStatus($room);
        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'challenge' => $ch,
            'matchStatus' => $room['matchStatus'],
            'teamReady' => $room['teamReady'],
            'teamHasChallenge' => $teamHasChallenge,
            'teamScores' => $room['teamScores']
        ]);
        exit;
    }

    // 3b. Confirmar / cambiar estado de "Equipo Completo y Listo"
    if ($action === 'setTeamReady') {
        $reqTeam = $input['teamId'] ?? 'team-alpha';
        $teamId = in_array($reqTeam, $validTeams, true) ? $reqTeam : 'team-alpha';
        $ready = isset($input['ready']) ? (bool)$input['ready'] : true;
        $room['teamReady'][$teamId] = $ready;

        $teamHasChallenge = evaluateRoomMatchStatus($room);
        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'matchStatus' => $room['matchStatus'],
            'teamReady' => $room['teamReady'],
            'teamHasChallenge' => $teamHasChallenge
        ]);
        exit;
    }

    if ($action === 'newRound') {
        $room['matchStatus'] = 'setup';
        $room['winnerTeam'] = null;
        $room['winnerAt'] = null;
        foreach ($validTeams as $t) {
            $room['teamReady'][$t] = false;
        }
        $room['challenges'] = [];
        file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        echo json_encode(['success' => true, 'matchStatus' => 'setup', 'teamReady' => $room['teamReady']]);
        exit;
    }

    // 4. Verificar intento de resolución (en 2 o 4 equipos: hay que adivinar las capturas de todos los equipos rivales; el primero en completarlas todas gana)
    if ($action === 'verifyAttempt' && !empty($input['challengeId'])) {
        if (($room['matchStatus'] ?? 'setup') === 'setup') {
            $numT = $room['maxTeams'];
            echo json_encode([
                'success' => false,
                'error' => "⏳ La partida aún no ha comenzado. Los {$numT} equipos deben subir su captura, rellenar los datos y confirmar que los equipos están completos."
            ]);
            exit;
        }
        $challengeId = $input['challengeId'];
        $attemptUrl = strtolower(trim($input['attemptUrl'] ?? ''));
        $attemptKeyword = mb_strtolower(trim($input['attemptKeyword'] ?? ''));
        $clickX = isset($input['clickX']) ? floatval($input['clickX']) : null;
        $clickY = isset($input['clickY']) ? floatval($input['clickY']) : null;
        $reqSolverTeam = $input['solverTeam'] ?? 'team-beta';
        $solverTeam = in_array($reqSolverTeam, $validTeams, true) ? $reqSolverTeam : 'team-beta';
        $solverName = htmlspecialchars($input['solverName'] ?? 'Agente');
        $solverId = $input['playerId'] ?? '';

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

        $target = &$room['challenges'][$foundIndex];

        if (($target['teamId'] ?? '') === $solverTeam) {
            echo json_encode(['success' => false, 'error' => '⚠️ No puedes resolver la captura de tu propio equipo. ¡Investiga las capturas de los equipos rivales!']);
            exit;
        }

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

        if (!isset($target['solvedByTeams']) || !is_array($target['solvedByTeams'])) {
            $target['solvedByTeams'] = [];
        }

        $alreadySolvedByThisTeam = in_array($solverTeam, $target['solvedByTeams'], true);

        if (!$alreadySolvedByThisTeam) {
            $target['solvedByTeams'][] = $solverTeam;
            $target['solvedAt'] = time() * 1000;
            $target['solvedByTeam'] = $solverTeam;
            $target['solvedByName'] = $solverName;

            if (!isset($room['teamScores'][$solverTeam])) {
                $room['teamScores'][$solverTeam] = 0;
            }
            $room['teamScores'][$solverTeam]++;

            // Actualizar estadísticas del jugador y del equipo
            if ($solverId !== '' && isset($store['users'][$solverId])) {
                $store['users'][$solverId]['stats']['capturesSolved'] = ($store['users'][$solverId]['stats']['capturesSolved'] ?? 0) + 1;
            }
            if (isset($store['globalTeamStats'][$solverTeam])) {
                $store['globalTeamStats'][$solverTeam]['capturesSolved'] = ($store['globalTeamStats'][$solverTeam]['capturesSolved'] ?? 0) + 1;
            }

            // Comprobar cuántas capturas rivales lleva resueltas este equipo en la ronda actual
            $rivalChallengesCount = 0;
            $solvedRivalCount = 0;
            foreach ($room['challenges'] as $chItem) {
                if (($chItem['teamId'] ?? '') !== $solverTeam) {
                    $rivalChallengesCount++;
                    $sbt = $chItem['solvedByTeams'] ?? [];
                    if (in_array($solverTeam, $sbt, true)) {
                        $solvedRivalCount++;
                    }
                }
            }

            // En 2 equipos hay que resolver 1 captura rival; en 4 equipos hay que resolver las 3 capturas rivales
            $neededToWin = max(1, $room['maxTeams'] - 1);
            $teamWonMatch = false;

            if ($solvedRivalCount >= $neededToWin && $rivalChallengesCount >= $neededToWin && empty($room['winnerTeam'])) {
                $room['matchStatus'] = 'finished';
                $room['winnerTeam'] = $solverTeam;
                $room['winnerAt'] = time() * 1000;
                $teamWonMatch = true;

                if (isset($store['globalTeamStats'][$solverTeam])) {
                    $store['globalTeamStats'][$solverTeam]['matchesWon'] = ($store['globalTeamStats'][$solverTeam]['matchesWon'] ?? 0) + 1;
                }
                // Sumar victoria a todos los miembros del equipo ganador en la sala
                foreach ($room['players'] as $pid => $pData) {
                    if (($pData['team'] ?? '') === $solverTeam && isset($store['users'][$pid])) {
                        $store['users'][$pid]['stats']['matchesWon'] = ($store['users'][$pid]['stats']['matchesWon'] ?? 0) + 1;
                    }
                }
            }

            $winLabel = $GLOBALS['TEAM_LABELS'][$solverTeam] ?? $solverTeam;
            $msgText = $teamWonMatch
                ? "🏆🎉 ¡VICTORIA TOTAL! {$solverName} ha descifrado la última captura rival ({$solvedRivalCount}/{$neededToWin}). ¡{$winLabel} GANA LA PARTIDA!"
                : "🎯 ¡{$solverName} ha descifrado la captura de un equipo rival! Progreso de victoria: {$solvedRivalCount}/{$neededToWin} capturas rivales completadas.";

            $room['chats'][$solverTeam][] = [
                'id' => 'msg_win_' . round(microtime(true) * 1000),
                'senderId' => 'system',
                'senderName' => 'Control de Mando',
                'type' => 'text',
                'text' => $msgText,
                'timestamp' => time() * 1000
            ];

            file_put_contents($dataFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }

        echo json_encode([
            'success' => true,
            'solved' => true,
            'matchStatus' => $room['matchStatus'],
            'winnerTeam' => $room['winnerTeam'],
            'teamScores' => $room['teamScores'],
            'challenge' => $target
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Acción POST no válida']);
    exit;
}
