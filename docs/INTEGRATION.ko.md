# alio 웹사이트 ↔ 멍냥이 연동 가이드

alio 웹사이트(쇼핑몰) 개발 담당자를 위한 문서입니다. 아래 API를 연결하면 **회원가입 보너스 코드(5자리)** 와 **제품 코드(8자리, 새 친구 입양권)** 가 사람 손 없이 자동으로 발급됩니다.

> 관리자 페이지(`/admin`) → **alio 연동 가이드** 메뉴에서 실제 서버 주소와 API 키가 들어간 예시를 바로 복사할 수 있습니다.

---

## 1. 전체 흐름

### 회원가입 보너스 (500P)

```
[회원] alio 웹사이트 회원가입 완료
   │
   ▼
[alio 서버] POST /api/partner/v1/signup-codes  ──►  [멍냥이 서버] 5자리 코드 발급
   │                                                  (예: 48213)
   ▼
[alio] 가입 완료 화면 · 환영 메일에 코드와 바로가기 링크 표시
       https://멍냥이주소/?code=48213
   │
   ▼
[회원] 멍냥이에서 코드 입력 (링크로 들어오면 자동 입력) → 500P 지급, 코드 사용 처리
```

### 반려동물이 무지개다리를 건넌 뒤 (제품 코드)

반려동물을 7일 동안 돌보지 않으면 무지개다리를 건너고, **alio 제품을 새로 구매해 받은 코드**를 입력해야 새 친구를 입양할 수 있습니다. 제품 코드는 두 가지 방법으로 발급할 수 있습니다.

| 방법 | 언제 쓰나요 | 하는 일 |
|---|---|---|
| **A. 주문 시 자동 발급** | 온라인 스토어 주문 | 결제 완료 시 `POST /api/partner/v1/product-codes` 호출 → 주문 완료 화면·메일에 코드 표시 |
| **B. 미리 만들어 인쇄** | 오프라인 판매, 제품 박스 동봉 | 관리자 페이지 [코드 관리]에서 원하는 수량만큼 생성 → CSV로 내려받아 카드에 인쇄 |

---

## 2. 인증

모든 요청에 API 키를 헤더로 보냅니다.

```
X-API-Key: alio_xxxxxxxxxxxxxxxxxxxxxxxx
```

(`Authorization: Bearer alio_xxx...` 형식도 됩니다.)

- API 키는 **alio 서버에만** 보관하세요. 브라우저(자바스크립트)나 앱에 넣으면 누구나 코드를 발급받을 수 있습니다.
- 키가 노출되면 관리자 페이지 [alio 연동 가이드] → **새 키 만들기**로 즉시 교체할 수 있습니다. (서버 환경 변수 `PARTNER_API_KEY`로 지정한 경우에는 환경 변수를 바꿔 주세요.)
- 분당 600회까지 호출할 수 있습니다.

---

## 3. API

기본 주소: `https://<멍냥이 서버 주소>/api/partner/v1`

### 3-1. 회원가입 코드 발급

`POST /signup-codes`

| 필드 | 필수 | 설명 |
|---|---|---|
| `memberId` | 권장 | alio 회원번호. 같은 회원번호로 다시 호출하면 **이미 발급한 코드를 그대로** 돌려줍니다(중복 발급 방지, 재시도 안전). |
| `email` | 선택 | 넣으면 **같은 이메일로 가입한 멍냥이 계정에서만** 사용할 수 있습니다. 코드를 다른 사람이 쓰는 것을 막고 싶을 때 사용하세요. |

```bash
curl -X POST https://<서버>/api/partner/v1/signup-codes \
  -H "X-API-Key: $MUNGNYANG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"memberId": "alio-12345", "email": "member@example.com"}'
```

응답 `201 Created` (이미 발급된 코드를 돌려줄 때는 `200 OK`, `"reused": true`)

```json
{
  "code": "48213",
  "type": "signup",
  "status": "active",
  "email": "member@example.com",
  "ref": "alio-12345",
  "source": "api",
  "createdAt": 1761292800000,
  "expiresAt": 1763884800000,
  "redeemUrl": "https://<서버>/?code=48213"
}
```

- 시간 값은 모두 밀리초 단위 Unix 시간입니다.
- 코드 유효기간은 기본 30일이며 관리자 페이지 [게임 설정]에서 바꿀 수 있습니다.
- 회원 한 명(멍냥이 계정)은 가입 보너스를 **한 번만** 받을 수 있습니다.

### 3-2. 제품 코드 발급

`POST /product-codes`

| 필드 | 필수 | 설명 |
|---|---|---|
| `orderId` | 권장 | 주문번호. 같은 주문번호로 다시 호출하면 같은 코드를 돌려줍니다. 주문에 제품이 여러 개라면 `ORDER-1-1`, `ORDER-1-2`처럼 구분해 주세요. |
| `email` | 선택 | 넣으면 해당 이메일의 멍냥이 계정에서만 사용할 수 있습니다. |

```bash
curl -X POST https://<서버>/api/partner/v1/product-codes \
  -H "X-API-Key: $MUNGNYANG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORDER-20261024-001"}'
```

응답 예시: `{ "code": "7KQM-3XTP", "type": "product", "redeemUrl": "https://<서버>/?product=7KQM-3XTP", ... }`

제품 코드는 숫자 0/1과 헷갈리는 글자(O, I, L)를 쓰지 않아 인쇄해도 읽기 쉽습니다. 기본 유효기간은 365일입니다.

### 3-3. 코드 조회

`GET /codes/{code}` → 코드 상태(`active` 사용 가능 · `redeemed` 사용됨 · `revoked` 중지/만료), 사용 시각 등을 돌려줍니다.

### 3-4. 코드 중지 (환불 등)

`DELETE /codes/{code}` → 아직 사용하지 않은 코드를 사용할 수 없게 만듭니다. 이미 사용한 코드는 중지할 수 없습니다.

### 오류 응답

```json
{ "error": "사람이 읽을 수 있는 메시지", "code": "machine_readable_code" }
```

| HTTP | code | 의미 |
|---|---|---|
| 400 | `bad_email` | email 형식 오류 |
| 401 | `unauthorized` | API 키가 없거나 틀림 |
| 404 | `not_found` | 없는 코드 |
| 409 | `already_redeemed` | 이 회원번호로 발급된 가입 코드가 이미 사용됨 (보너스 지급 완료) |
| 429 | `rate_limited` | 호출 한도 초과, 잠시 후 재시도 |
| 503 | `code_space_full` | 미사용 가입 코드가 너무 많음 (아래 '보안' 참고) |

---

## 4. 언어별 예시

### Node.js

```js
// 회원가입 처리가 끝난 직후 (서버 코드)
async function issueMungnyangCode(member) {
  const res = await fetch(`${process.env.MUNGNYANG_URL}/api/partner/v1/signup-codes`, {
    method: 'POST',
    headers: { 'X-API-Key': process.env.MUNGNYANG_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: String(member.id), email: member.email }),
  });
  if (!res.ok) throw new Error(`멍냥이 코드 발급 실패: ${res.status}`);
  return res.json(); // { code, redeemUrl, expiresAt, ... }
}
```

### PHP

```php
$ch = curl_init(getenv('MUNGNYANG_URL') . '/api/partner/v1/signup-codes');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['X-API-Key: ' . getenv('MUNGNYANG_API_KEY'), 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['memberId' => (string)$member['id'], 'email' => $member['email']]),
  CURLOPT_TIMEOUT => 10,
]);
$result = json_decode(curl_exec($ch), true);
curl_close($ch);
// $result['code'], $result['redeemUrl']
```

### Python

```python
import os, requests

res = requests.post(
    f"{os.environ['MUNGNYANG_URL']}/api/partner/v1/signup-codes",
    headers={"X-API-Key": os.environ["MUNGNYANG_API_KEY"]},
    json={"memberId": str(member.id), "email": member.email},
    timeout=10,
)
res.raise_for_status()
code = res.json()["code"]
```

### 개발자가 없는 경우

- **자동화 도구**: Zapier, Make 같은 도구에서 "새 회원 가입" 이벤트 → "HTTP 요청(POST)" → "메일 보내기" 순서로 연결하면 코드 없이 자동화할 수 있습니다. HTTP 요청 단계에 위 주소, 헤더(`X-API-Key`), JSON 본문을 그대로 넣으면 됩니다.
- **미리 만든 코드 목록**: 관리자 페이지 [코드 관리]에서 가입 코드를 필요한 만큼 만들고 CSV로 내려받은 뒤, 메일 발송 도구의 "개인별 쿠폰 코드" 기능으로 한 명에게 하나씩 보낼 수 있습니다.

---

## 5. 회원에게 보여 줄 문구 예시

> 🎁 **alio 멍냥이 회원가입 보너스**
> 아래 코드를 alio 멍냥이에 입력하면 500P를 드려요!
> 코드: **48213** (30일 안에 사용해 주세요)
> [멍냥이에서 바로 받기] ← `redeemUrl` 링크

---

## 6. 보안 관련 참고

- 5자리 코드는 경우의 수가 9만 개뿐이라, 멍냥이 서버는 **계정당 30분에 5회, IP당 1시간에 20회**까지만 틀린 코드 입력을 허용합니다.
- 사용하지 않은 가입 코드가 2만 개를 넘으면 새 발급을 거절합니다(추측으로 맞힐 확률을 낮게 유지). 유효기간을 너무 길게 잡지 않으면 이 한도에 걸릴 일은 거의 없습니다.
- 코드 도용이 걱정되면 발급 시 `email`을 함께 보내 주세요.
