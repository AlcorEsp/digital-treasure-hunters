<?php
/**
 * Auto-Deploy Ligero desde GitHub a IONOS (Sin requerir SFTP/SSH)
 * Cuando haces git push a la rama main en GitHub (AlcorEsp/digital-treasure-hunters),
 * este script descarga automáticamente la última versión de server-hub/index.html y server-hub/api/index.php
 * directamente en tu carpeta /digital-treasure-hunters/ de IONOS.
 *
 * También se puede ejecutar manualmente abriendo en el navegador:
 * https://www.forgeprojects.es/digital-treasure-hunters/api/deploy.php
 */

header('Content-Type: application/json; charset=utf-8');

$repoOwner = 'AlcorEsp';
$repoName  = 'digital-treasure-hunters';
$branch    = 'main';

$filesToSync = [
    'server-hub/index.html'     => dirname(__DIR__) . '/index.html',
    'server-hub/api/index.php'  => __DIR__ . '/index.php',
    'server-hub/api/deploy.php' => __DIR__ . '/deploy.php'
];

$ctx = stream_context_create([
    'http' => [
        'method'  => 'GET',
        'timeout' => 10,
        'header'  => "User-Agent: ForgeProjects-IONOS-AutoDeploy/1.0\r\nCache-Control: no-cache\r\n"
    ],
    'ssl' => [
        'verify_peer'      => false,
        'verify_peer_name' => false
    ]
]);

$updated = [];
$errors  = [];

foreach ($filesToSync as $repoPath => $localDest) {
    $rawUrl = "https://raw.githubusercontent.com/{$repoOwner}/{$repoName}/{$branch}/{$repoPath}?t=" . time();
    $content = @file_get_contents($rawUrl, false, $ctx);

    if ($content !== false && strlen($content) > 50) {
        $dir = dirname($localDest);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        if (@file_put_contents($localDest, $content, LOCK_EX) !== false) {
            $updated[] = $repoPath;
        } else {
            $errors[] = "No se pudo escribir en: {$localDest}";
        }
    } else {
        $errors[] = "No se pudo descargar desde GitHub: {$repoPath}";
    }
}

echo json_encode([
    'success'   => empty($errors),
    'timestamp' => date('c'),
    'repository'=> "{$repoOwner}/{$repoName} ({$branch})",
    'updated'   => $updated,
    'errors'    => $errors
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
