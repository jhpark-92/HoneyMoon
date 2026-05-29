// =============================================
//  신혼여행 플래너 - Google Apps Script 백엔드
//  사용법:
//  1. script.google.com 에서 새 프로젝트 생성
//  2. 이 코드 전체 붙여넣기
//  3. 배포 > 새 배포 > 웹 앱 선택
//     - 다음 사용자로 실행: 나 (본인 계정)
//     - 액세스 권한: 모든 사용자
//  4. 배포 후 나오는 URL을 앱의 ⚙️ 설정에 붙여넣기
// =============================================

const DATA_KEY = 'honeymoon_data';

function doGet() {
  const data = PropertiesService.getScriptProperties().getProperty(DATA_KEY) || '{}';
  return ContentService
    .createTextOutput(data)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    PropertiesService.getScriptProperties().setProperty(DATA_KEY, e.postData.contents);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
