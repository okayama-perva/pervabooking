<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (isset($data['filePath'])) {
        $filePath = $data['filePath'];
        if (file_exists($filePath)) {
            if (unlink($filePath)) {
                echo json_encode(['success' => true, 'message' => 'ファイルを削除しました']);
            } else {
                echo json_encode(['success' => false, 'message' => 'ファイル削除失敗']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'ファイルが存在しません']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'filePathがありません']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'POSTのみ受付']);
}
?>
