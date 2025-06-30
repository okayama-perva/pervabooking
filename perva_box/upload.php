<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $fileType = $_FILES['file']['type'];

    if (!in_array($fileType, $allowedTypes)) {
        echo json_encode([
            'success' => false,
            'message' => '許可されていないファイル形式です（JPEG, PNG, GIF, WEBPのみ）'
        ]);
        exit;
    }

    $uploadDir = 'img/';
    $fileName = time() . '_' . basename($_FILES['file']['name']);
    $targetFile = $uploadDir . $fileName;

    if (move_uploaded_file($_FILES['file']['tmp_name'], $targetFile)) {
        echo json_encode(['success' => true, 'filePath' => $targetFile]);
    } else {
        echo json_encode(['success' => false, 'message' => 'ファイル保存に失敗しました']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'ファイルが見つかりません']);
}
?>
