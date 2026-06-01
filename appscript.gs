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

const PROP = PropertiesService.getScriptProperties();

function doGet() {
  const raw     = PROP.getProperty('honeymoon_data') || '{}';
  const gapiKey = PROP.getProperty('honeymoon_googlemap_key') || '';
  const data    = JSON.parse(raw);

  // 일정 데이터 + Google API 키 함께 반환
  return ContentService
    .createTextOutput(JSON.stringify({ ...data, _gapiKey: gapiKey }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Google API 키 분리 저장
    if (body._gapiKey !== undefined) {
      PROP.setProperty('honeymoon_googlemap_key', body._gapiKey);
      delete body._gapiKey;
    }

    // 일정 데이터 저장
    PROP.setProperty('honeymoon_data', JSON.stringify(body));

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
