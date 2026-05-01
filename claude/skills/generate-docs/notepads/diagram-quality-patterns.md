# Diagram Quality Patterns (PlantUML — govt-grade CNTT)

**Purpose**: cookbook để doc-diagram + tdoc-* writer agents tạo diagram **chỉn chu, chuyên nghiệp, đạt chuẩn thẩm định viên CNTT chính phủ**. Nguồn lỗi phổ biến hiện tại: layout chồng chéo, không grouping, font lỗi diacritics, màu lộn xộn, quá nhiều đường giao cắt.

**Required reading before emitting any diagram source.**

---

## §1. Quality bar — 10 nguyên tắc bất di bất dịch

1. **Group / package / frame** — mọi node phải nằm trong package có label. Không có node lẻ.
2. **One direction per diagram** — chọn `top to bottom` HOẶC `left to right`, đừng để PlantUML auto-pick. **DEFAULT = `top to bottom direction`** vì layered architecture (4 lớp CPĐT, deployment zones, network tier) trông tự nhiên theo chiều dọc; chỉ chọn `left to right` cho use case (system boundary nằm giữa, actors trái) hoặc luồng nghiệp vụ tuyến tính ngắn.
3. **Orthogonal edges** — `skinparam linetype ortho` (đường thẳng góc, không đường chéo) cho mọi diagram cấu trúc; chỉ dùng `polyline` cho sequence.
4. **Whitespace** — `ranksep 60`, `nodesep 40`. Tuyệt đối không cho phép edge chéo qua node hoặc node sát mép node khác.
5. **Consistent shape ngữ nghĩa** — `database` = cylinder, `actor` = stickman, `component` = component, `node` = box 3D, `cloud` = cloud, `package` = labeled rect. KHÔNG dùng `rectangle` cho mọi thứ.
6. **Color palette ≤ 5** — dùng đúng palette gov ETC định nghĩa ở §2. Không hex tự chế.
7. **Times New Roman 12pt UTF-8** — bắt buộc `skinparam defaultFontName "Times New Roman"` + `-charset UTF-8` (engine đã set sẵn) để diacritics tiếng Việt không vỡ.
8. **Edge labels ngắn** — `: HTTPS`, `: gRPC`, `: SQL` — không câu prose dài. Nếu phải giải thích → `note on link`.
9. **Title + caption** — `title <b>Hình X.Y</b>: <tên>` ở đầu; nếu cần version/ngày → `caption` dưới.
10. **Số node mỗi diagram ≤ 25** — vượt → tách thành 2-3 diagram. Diagram dày = không đọc được.

---

## §2. Professional skinparam preset (BẮT BUỘC)

Mỗi PlantUML source PHẢI bắt đầu bằng preset này (hoặc subset áp dụng tuỳ loại). Đây là **chữ ký chất lượng** — agent vi phạm = reject ở doc-reviewer.

```plantuml
@startuml
'─── Govt-grade skinparam preset (ETC standard) ─────────────────
!$navy      = "#1F3864"
!$blue      = "#2E75B6"
!$lightBlue = "#DEEBF7"
!$accent    = "#C00000"
!$orange    = "#ED7D31"
!$grayDark  = "#404040"
!$grayLight = "#F2F2F2"

skinparam backgroundColor          white
skinparam defaultFontName          "Times New Roman"
skinparam defaultFontSize          12
skinparam defaultFontColor         $navy
skinparam shadowing                false
skinparam roundCorner              6
skinparam arrowThickness           1.1
skinparam arrowFontSize            10
skinparam arrowColor               $grayDark
skinparam linetype                 ortho
skinparam ranksep                  80
skinparam nodesep                  50
skinparam padding                  4
skinparam wrapWidth                220
skinparam maxMessageSize           220
skinparam packageStyle             rectangle

skinparam package {
  BackgroundColor $grayLight
  BorderColor     $navy
  FontStyle       bold
  FontSize        13
  FontColor       $navy
}
skinparam rectangle {
  BackgroundColor $lightBlue
  BorderColor     $blue
  BorderThickness 1.2
  FontColor       $navy
}
skinparam component {
  BackgroundColor $lightBlue
  BorderColor     $blue
  BorderThickness 1.2
  FontColor       $navy
}
skinparam node {
  BackgroundColor #FFF2CC
  BorderColor     #BF9000
  FontColor       $navy
}
skinparam database {
  BackgroundColor #FBE5D5
  BorderColor     #C55A11
  FontColor       $navy
}
skinparam cloud {
  BackgroundColor #E2EFDA
  BorderColor     #548235
  FontColor       $navy
}
skinparam actor {
  BackgroundColor white
  BorderColor     $navy
  FontColor       $navy
}
skinparam frame {
  BackgroundColor white
  BorderColor     $accent
  BorderThickness 1.5
  FontStyle       bold
  FontColor       $accent
}
skinparam note {
  BackgroundColor #FFF2CC
  BorderColor     $orange
  FontColor       $navy
}
'──────────────────────────────────────────────────────────────────
@enduml
```

**Color semantics (đừng phá):**
- **xanh nhạt** (`$lightBlue`) — ứng dụng / service / component thuần
- **vàng** — node hạ tầng (server, máy chủ vật lý)
- **cam** — database, lưu trữ
- **xanh lá nhạt** — cloud / external service
- **đỏ + frame** — security boundary / DMZ / vùng cấm
- **xám đậm** (`$grayDark`) — edge / arrow màu mặc định

---

## §3. Pattern A — Deployment diagram (NCKT §7.4 mô hình vật lý)

**Use case**: TKCS hạ tầng, NCKT mô hình vật lý vùng trong/ngoài, sơ đồ TTDL.

```plantuml
@startuml
<<insert §2 preset>>

title <b>Hình 7.4.1</b>: Mô hình vật lý hạ tầng vùng trong (Cục C10)
left to right direction

cloud "Internet" as INET #White

frame "Vùng ngoài (DMZ)" as DMZ {
  node "WAF" as WAF
  node "Reverse Proxy\n(NGINX)" as RP
  node "API Gateway\n(Kong 3.x)" as GW
}

frame "Vùng trung gian (Service Mesh)" as MID {
  node "Ingress Controller" as INGRESS
  node "Identity Provider\n(Keycloak)" as IDP
}

frame "Vùng trong (Inner Zone)" as INNER {
  package "Cụm máy chủ ứng dụng" {
    node "App Server 01\n(2 x Xeon Gold, 128GB RAM)" as APP1
    node "App Server 02\n(2 x Xeon Gold, 128GB RAM)" as APP2
    node "App Server 03\n(2 x Xeon Gold, 128GB RAM)" as APP3
  }
  package "Cụm máy chủ CSDL" {
    database "PostgreSQL 16\n(Primary)" as DB1
    database "PostgreSQL 16\n(Standby)" as DB2
  }
  package "Hệ thống lưu trữ" {
    database "SAN Storage\n6 × SSD 7.68TB\n9 × HDD 12TB" as SAN
    database "Backup Library\n(Veeam + LTO-9)" as BK
  }
}

INET --> WAF        : HTTPS/443
WAF  --> RP         : HTTPS/443
RP   --> GW         : HTTPS/443
GW   --> INGRESS    : mTLS
INGRESS --> APP1
INGRESS --> APP2
INGRESS --> APP3
APP1 --> DB1        : SQL/5432
APP2 --> DB1
APP3 --> DB1
DB1  --> DB2        : streaming replication
DB1  --> SAN        : iSCSI/10G
DB2  --> SAN
SAN  --> BK         : daily snapshot
IDP  --> APP1       : OIDC
@enduml
```

**Quality wins**: 4 zones rõ ràng (frame stereotypes), grouping bằng package, thông số TSKT trong label, edge có protocol, replication rõ.

---

## §4. Pattern B — Component diagram (NCKT §7.2 kiến trúc nghiệp vụ)

```plantuml
@startuml
<<insert §2 preset>>

title <b>Hình 7.2</b>: Kiến trúc nghiệp vụ Hệ thống CĐS THAHS

package "Nhóm nghiệp vụ chính" as BIZ {
  [Tiếp nhận hồ sơ]    as M01
  [Quản lý phạm nhân]  as M02
  [Quản lý chấp hành án] as M03
  [Báo cáo thống kê]   as M04
}

package "Nhóm dịch vụ dùng chung" as SHARED {
  [OCR & Số hoá]       as M11
  [Workflow Engine]    as M12
  [Lưu trữ hồ sơ ĐT]   as M07
  [Quản trị hệ thống]  as M08
  [Định danh tập trung] as M09
}

package "Nhóm tích hợp" as INTEG {
  [Cổng kết nối CSDLQGDC] as I01
  [Cổng kết nối VNeID]    as I02
  [LGSP Bộ Công an]       as I03
}

package "Lớp dữ liệu" as DATA {
  database "CSDL Phạm nhân"   as DBP
  database "CSDL Hồ sơ"       as DBH
  database "Kho hồ sơ điện tử (S3)" as STORE
}

M01 --> M11         : số hoá
M01 --> M12         : khởi tạo workflow
M02 --> M03
M02 --> DBP
M02 --> DBH
M03 --> DBH
M04 --> DBP
M04 --> DBH
M07 --> STORE
M02 ..> M09         : SSO
M03 ..> M09         : SSO
M02 ..> I01         : tra cứu CCCD
M02 ..> I02         : xác thực
I01 --> I03
I02 --> I03
@enduml
```

**Quality wins**: 4 packages có tên Việt, mã module ngắn (M01..M12) ≠ tên hiển thị dài; phân biệt edge thực (`-->`) vs phụ thuộc (`..>`); annotate purpose của edge.

---

## §5. Pattern C — Sequence diagram (TKCT API flow)

```plantuml
@startuml
<<insert §2 preset>>
skinparam linetype polyline   ' override — sequence dùng polyline đẹp hơn ortho
skinparam sequenceMessageAlign center
skinparam sequenceArrowThickness 1.3
skinparam ParticipantBorderThickness 1.2

title <b>Hình 8.3</b>: Luồng tạo hồ sơ THA mới (M-01)

actor "Cán bộ tiếp nhận" as User
boundary "Web UI\n(React 18)"   as UI
control  "API Gateway\n(Kong)"   as GW
participant "Service: Tiếp nhận\n(Spring Boot)" as Svc
participant "Service: Định danh\n(Keycloak)"    as IDP
database "PostgreSQL\nho_so" as DB
queue    "Kafka\nworkflow.events" as MQ

== Xác thực ==
User -> UI         : đăng nhập (CCCD + OTP)
UI   -> IDP        : POST /token
IDP  --> UI        : access_token (JWT, 30 phút)

== Tạo hồ sơ ==
User -> UI         : nhập biểu mẫu
UI   -> GW         : POST /api/v1/ho-so\nAuthorization: Bearer
GW   -> Svc        : forward (verify JWT)
Svc  -> DB         : INSERT INTO ho_so RETURNING id
DB   --> Svc       : id = 12345
Svc  -> MQ         : publish "ho_so.created"
Svc  --> GW        : 201 Created\n{id, ma_ho_so}
GW   --> UI        : 201 Created
UI   --> User      : Hiển thị mã HS-2026-12345

== Lỗi nghiệp vụ ==
note over Svc, DB
  Nếu CCCD đã tồn tại → 409 Conflict
  Nếu thiếu trường bắt buộc → 422 Unprocessable
end note
@enduml
```

**Quality wins**: actor/boundary/control/participant/database/queue với role rõ; grouping bằng `== ... ==`; auth flow tách riêng; error case có note.

---

## §6. Pattern D — ERD (TKCT thiết kế CSDL)

```plantuml
@startuml
<<insert §2 preset>>
hide circle
skinparam linetype ortho
skinparam class {
  BackgroundColor #DEEBF7
  BorderColor     #2E75B6
  ArrowColor      #404040
  FontColor       #1F3864
}

title <b>Hình 8.5</b>: Mô hình CSDL nghiệp vụ (cấp độ logic)

entity "pham_nhan" as PN {
  *id : bigint <<PK>>
  --
  ma_pn : varchar(20) <<unique>>
  ho_ten : varchar(255)
  cccd : varchar(12)
  ngay_sinh : date
  gioi_tinh : char(1)
  noi_giam_giu_id : bigint <<FK>>
  trang_thai : varchar(20)
  created_at : timestamp
}

entity "trai_giam" as TG {
  *id : bigint <<PK>>
  --
  ma_trai : varchar(10) <<unique>>
  ten_trai : varchar(255)
  dia_chi : varchar(500)
  cap_quan_ly : varchar(20)
}

entity "ho_so" as HS {
  *id : bigint <<PK>>
  --
  ma_ho_so : varchar(50) <<unique>>
  pham_nhan_id : bigint <<FK>>
  loai_ho_so : varchar(30)
  trang_thai : varchar(20)
  ngay_tao : timestamp
  ngay_cap_nhat : timestamp
}

entity "buoc_xu_ly" as BXL {
  *id : bigint <<PK>>
  --
  ho_so_id : bigint <<FK>>
  bac : int
  ten_buoc : varchar(255)
  trang_thai : varchar(20)
  nguoi_xu_ly_id : bigint <<FK>>
  ngay_thuc_hien : timestamp
}

entity "tai_lieu_dinh_kem" as TL {
  *id : bigint <<PK>>
  --
  ho_so_id : bigint <<FK>>
  ten_tai_lieu : varchar(500)
  loai : varchar(30)
  duong_dan_s3 : varchar(1000)
  hash_sha256 : varchar(64)
  kich_thuoc : bigint
}

entity "nguoi_dung" as ND {
  *id : bigint <<PK>>
  --
  username : varchar(100) <<unique>>
  ho_ten : varchar(255)
  email : varchar(255)
  trai_giam_id : bigint <<FK>>
  vai_tro : varchar(50)
}

TG ||--o{ PN  : "giam giữ"
PN ||--o{ HS  : "có"
HS ||--o{ BXL : "có các bước"
HS ||--o{ TL  : "có tài liệu"
TG ||--o{ ND  : "thuộc"
ND ||--o{ BXL : "xử lý"
@enduml
```

**Quality wins**: 6 entity với đầy đủ thuộc tính + kiểu dữ liệu chuẩn SQL; PK/FK/unique markers; cardinality cụ thể (`||--o{`).

---

## §7. Pattern E — Network topology (Phụ lục PL.2)

```plantuml
@startuml
<<insert §2 preset>>

title <b>Hình PL.2</b>: Sơ đồ nguyên lý mạng triển khai
top to bottom direction

cloud "Internet" as INET

frame "Vùng DMZ" as DMZ #FFE6E6 {
  node "Cluster Firewall\n(2 x NGFW Active-Active)" as FW1
  node "WAF Cluster\n(2 x WAF)" as WAFC
  node "DDoS Mitigation" as DDOS
}

frame "Vùng vận hành (Mgmt)" as MGMT #FFF2CC {
  node "SIEM\n(SolarWinds)"    as SIEM
  node "NMS\n(PRTG)"           as NMS
  node "Bastion Host"          as BAST
}

frame "Vùng lõi (Core)" as CORE #DEEBF7 {
  node "Spine Switch 01" as SP1
  node "Spine Switch 02" as SP2
  node "Leaf Switch 01"  as LF1
  node "Leaf Switch 02"  as LF2
  node "Leaf Switch 03"  as LF3
}

frame "Vùng lưu trữ (Storage)" as STO #FBE5D5 {
  node "SAN Switch 01" as SS1
  node "SAN Switch 02" as SS2
  database "All-Flash SAN" as SAN
}

frame "Vùng tính toán (Compute)" as COMP #E2EFDA {
  node "Hypervisor 01\n(VMware ESXi 8)" as H1
  node "Hypervisor 02\n(VMware ESXi 8)" as H2
  node "Hypervisor 03\n(VMware ESXi 8)" as H3
}

INET --> DDOS : "BGP / 100Gbps"
DDOS --> FW1
FW1  --> WAFC
WAFC --> SP1  : "10Gbps L3"
WAFC --> SP2
SP1  -- SP2   : "MLAG"
SP1  --> LF1
SP1  --> LF2
SP1  --> LF3
SP2  --> LF1
SP2  --> LF2
SP2  --> LF3
LF1  --> H1   : "25Gbps"
LF2  --> H2
LF3  --> H3
H1   --> SS1  : "FC 32Gbps"
H2   --> SS1
H3   --> SS2
SS1  --> SAN
SS2  --> SAN
BAST -[#blue,dashed]-> H1 : "SSH/RDP"
SIEM -[#gray,dotted]-> SP1
NMS  -[#gray,dotted]-> SP1
@enduml
```

**Quality wins**: 5 vùng phân biệt bằng màu frame (theo zone semantic), bandwidth label trên edge, MLAG/replication links, mgmt traffic dotted để không nhầm với data path.

---

## §8. Pattern F — Use case diagram (NCKT §4 mục tiêu cụ thể)

```plantuml
@startuml
<<insert §2 preset>>
left to right direction
skinparam usecase {
  BackgroundColor #DEEBF7
  BorderColor     #2E75B6
}

title <b>Hình 4.1.2</b>: Sơ đồ Use Case nhóm nghiệp vụ chính

actor "Cán bộ Cục C10"     as A1
actor "Cán bộ Trại giam"   as A2
actor "Lãnh đạo Bộ"        as A3
actor "Hệ thống CSDLQGDC"  as S1 <<system>>
actor "Hệ thống VNeID"     as S2 <<system>>

rectangle "Hệ thống CĐS THAHS" {
  usecase "UC-01: Tiếp nhận hồ sơ"           as UC01
  usecase "UC-02: Quản lý phạm nhân"         as UC02
  usecase "UC-03: Cấp Giấy chứng nhận"       as UC03
  usecase "UC-04: Quản lý chấp hành án"      as UC04
  usecase "UC-05: Báo cáo thống kê tổng hợp" as UC05
  usecase "UC-06: Tra cứu CCCD"              as UC06
  usecase "UC-07: Xác thực sinh trắc"        as UC07
  usecase "UC-08: Quản trị tài khoản"        as UC08
}

A2 --> UC01
A2 --> UC02
A1 --> UC03
A2 --> UC04
A3 --> UC05
A1 --> UC08

UC01 ..> UC06 : <<include>>
UC01 ..> UC07 : <<include>>
UC02 ..> UC06 : <<include>>
UC06 --> S1
UC07 --> S2
@enduml
```

**Quality wins**: actor con người vs `<<system>>` actor; system boundary; `<<include>>` relationships đúng UML; usecase đánh số UC-NN khớp với feature catalog.

---

## §9. Pattern G — Activity / Workflow diagram (TKCT module flow)

```plantuml
@startuml
<<insert §2 preset>>
skinparam activity {
  BackgroundColor #DEEBF7
  BorderColor     #2E75B6
  DiamondBackgroundColor #FFF2CC
  DiamondBorderColor     #BF9000
}

title <b>Hình 7.3.M02</b>: Luồng nghiệp vụ Quản lý phạm nhân (M-02)

|Cán bộ tiếp nhận|
start
:Quét CCCD phạm nhân;
:Hệ thống tra cứu CSDLQGDC;
if (Đã có hồ sơ?) then (có)
  :Cập nhật thông tin;
else (không)
  :Tạo hồ sơ mới;
  :Số hoá tài liệu kèm theo;
endif
:Phân loại đối tượng;

|Cán bộ chấp hành án|
:Tiếp nhận phân công;
:Phê duyệt phương án giam giữ;
if (Đặc biệt nguy hiểm?) then (có)
  :Áp dụng quy trình ANQP riêng;
  :Báo cáo Lãnh đạo;
endif

|Hệ thống|
:Sinh mã hồ sơ HS-YYYY-NNNNN;
:Lưu vào CSDL Phạm nhân;
:Đẩy event vào Kafka;
:Gửi thông báo Lãnh đạo;
stop
@enduml
```

**Quality wins**: swimlane theo actor (`|...|`); decision diamond; happy path + alternate flow; system actions cuối swimlane.

---

## §10. Pattern H — Swimlane (HDSD / TKCT module flow chuyên biệt)

**Use case**: HDSD module flow nhiều actor; quy trình nghiệp vụ chính phủ phân theo vai trò.
**Lưu ý**: PlantUML là engine duy nhất render được swimlane đẹp — Mermaid KHÔNG hỗ trợ native.

```plantuml
@startuml
<<insert §2 preset>>

title <b>Hình M-02.1</b>: Quy trình Quản lý phạm nhân (Swimlane 4 lane)

|#DEEBF7|Cán bộ tiếp nhận|
start
:Quét CCCD phạm nhân;
:Hệ thống tra cứu CSDLQGDC;
if (Đã có hồ sơ?) then (có)
  :Cập nhật thông tin;
else (không)
  :Tạo hồ sơ mới;
  :Số hoá tài liệu kèm theo;
endif
:Phân loại đối tượng;

|#FFF2CC|Cán bộ chấp hành án|
:Tiếp nhận phân công;
:Phê duyệt phương án giam giữ;
if (Đặc biệt nguy hiểm?) then (có)
  :Áp dụng quy trình ANQP riêng;
  :Báo cáo Lãnh đạo;
endif

|#FBE5D5|Hệ thống|
:Sinh mã hồ sơ HS-YYYY-NNNNN;
:Lưu vào CSDL Phạm nhân;
:Đẩy event vào Kafka;

|#E2EFDA|Lãnh đạo Trại|
:Nhận thông báo;
:Phê duyệt cuối cùng;
stop
@enduml
```

**Quy tắc swimlane**:
- Mỗi lane là 1 actor/role/system, mở bằng `|#color|Lane Name|` trên dòng riêng.
- Activity step trong lane theo cú pháp `:text;`.
- Decision diamond: `if (?) then (yes) ... else (no) ... endif`.
- Tách nội dung sang lane khác: chỉ cần đặt `|#color|NewLane|` rồi tiếp tục activity steps.
- ≤ 5 lanes/diagram, mỗi lane ≤ 8 activities — nếu vượt → tách thành 2 swimlane.

---

## §10b. Pattern I — Class diagram (TKCT §8.6 mô hình lớp nghiệp vụ)

```plantuml
@startuml
<<insert §2 preset>>
skinparam classAttributeIconSize 0

title <b>Hình 8.6</b>: Mô hình lớp nghiệp vụ Quản lý phạm nhân

abstract class HoSoBase {
  # id : Long
  # ma_ho_so : String
  --
  + tao() : void
  {abstract} validate() : boolean
}

class HoSoPhamNhan {
  - cccd : String
  --
  + xacThucCCCD() : boolean
}

enum TrangThai { MOI; DANG_XU_LY; HOAN_THANH; HUY }

HoSoBase <|-- HoSoPhamNhan
HoSoPhamNhan "*" o-- "1" TraiGiam
HoSoPhamNhan --> TrangThai
@enduml
```

**Quy tắc**:
- `abstract class` cho base class; in nghiêng tự động.
- Visibility prefix: `+` public, `-` private, `#` protected, `~` package.
- `{abstract}` cho method abstract; `{static}` cho static.
- Cardinality + relationship: `<|--` inheritance, `*--` composition (strong), `o--` aggregation (weak), `-->` association.
- `enum` riêng với mỗi value 1 dòng.

---

## §10c. Pattern J — State machine (TKCT vòng đời thực thể)

```plantuml
@startuml
<<insert §2 preset>>

title <b>Hình 8.7</b>: Vòng đời hồ sơ thi hành án

[*] --> Moi : tạo hồ sơ
state Moi : Hồ sơ vừa nhập\nChưa số hoá
state DangSoHoa : Đang OCR + đối chiếu
state ChoDuyet : Chờ lãnh đạo phê duyệt
state DangXuLy : Đã duyệt — đang thi hành
state HoanThanh : Đã chấp hành xong
state Huy : Bị huỷ bỏ

Moi --> DangSoHoa : số hoá tài liệu
DangSoHoa --> ChoDuyet : OCR thành công
DangSoHoa --> Moi : OCR lỗi
ChoDuyet --> DangXuLy : phê duyệt
ChoDuyet --> Huy : từ chối
DangXuLy --> HoanThanh : hết thời hạn
DangXuLy --> Huy : có quyết định huỷ
HoanThanh --> [*]
Huy --> [*]

note right of ChoDuyet : SLA 48h
@enduml
```

**Quy tắc**:
- `[*]` = entry/exit point.
- `state X : description` để gắn description nhiều dòng vào state.
- Edge label = trigger event hoặc condition.
- `note right of X : ...` cho SLA / business rule.

---

## §10d. Pattern K — Mindmap (Đề án CĐS phân rã mục tiêu)

```plantuml
@startmindmap
<<insert §2 preset>>

title <b>Sơ đồ phân rã mục tiêu</b>: Đề án CĐS THAHS

* Đề án CĐS THAHS
** Mục tiêu chiến lược
*** Số hoá 100% hồ sơ
*** Liên thông CSDLQGDC + VNeID
** Trục nghiệp vụ
*** Quản lý phạm nhân
**** Tiếp nhận
**** Theo dõi giam giữ
*** Báo cáo thống kê
** Trục hạ tầng
*** TTDL Cục C10
*** ATTT cấp độ 3
@endmindmap
```

**Quy tắc**:
- `*` đánh dấu node — số `*` = depth level (1=root, 2=branch chính, 3=sub-branch).
- Tối đa 4 level — nhiều hơn → đọc khó.
- Mỗi node ≤ 5 từ; thông tin dài → tách thành sub-branch.
- Use case: NCKT §4.1 mục tiêu, Đề án CĐS phân rã initiative, ToC/scope tổng quan.

---

## §10e. Pattern L — WBS (cấu trúc phân rã công việc)

```plantuml
@startwbs
<<insert §2 preset minus skinparam class/component blocks>>

title <b>WBS</b>: Cấu trúc phân rã công việc dự án CĐS

* Dự án CĐS THAHS
** 1. Khảo sát + Phân tích
*** 1.1 Khảo sát hiện trạng
*** 1.2 Phân tích yêu cầu
** 2. Thiết kế
*** 2.1 TKCS
*** 2.2 TKCT
** 3. Thực thi
*** 3.1 Đấu thầu
*** 3.2 Lắp đặt hạ tầng
**** 3.2.1 PCCN
**** 3.2.2 Mạng + máy chủ
*** 3.3 Phát triển PM
** 4. Triển khai + Đào tạo
** 5. Nghiệm thu + Bàn giao
@endwbs
```

**Quy tắc**:
- Cú pháp giống mindmap nhưng layout dạng cây dọc xuống (project tree).
- Số thứ tự WBS code: `1.`, `1.1`, `1.1.1` viết trong text node.
- Use case: NCKT §13 work breakdown trước Gantt, Đề án CĐS roadmap, kế hoạch dự án.

---

## §10f. Pattern M — Gantt (NCKT §13 tiến độ thực hiện)

**⚠ BẮT BUỘC `printscale weekly`** (hoặc `monthly`/`quarterly`) — không có sẽ render 1 ngày = 1 cột → 8000+ pixel rộng, không đọc được.

```plantuml
@startgantt
skinparam defaultFontName "Times New Roman"
skinparam defaultFontSize 11
skinparam shadowing false
printscale weekly
project starts 2026-06-01
saturday  are closed
sunday    are closed

[Khảo sát hiện trạng]   lasts 4 weeks
[Khảo sát hiện trạng]   is colored in $lightBlue/$blue

[Lập TKCS]              lasts 6 weeks
[Lập TKCS]              starts at [Khảo sát hiện trạng]'s end
[Lập TKCS]              is colored in $lightBlue/$blue

[Thẩm định TKCS]        lasts 3 weeks
[Thẩm định TKCS]        starts at [Lập TKCS]'s end

[Lập TKCT + Dự toán]    lasts 8 weeks
[Lập TKCT + Dự toán]    starts at [Thẩm định TKCS]'s end

[Đấu thầu]              lasts 6 weeks
[Đấu thầu]              starts at [Lập TKCT + Dự toán]'s end

[Triển khai PCCN + lắp đặt] lasts 14 weeks
[Triển khai PCCN + lắp đặt] starts at [Đấu thầu]'s end

[Phát triển PM nội bộ]  lasts 24 weeks
[Phát triển PM nội bộ]  starts at [Đấu thầu]'s end

[Đào tạo + chuyển giao] lasts 4 weeks
[Đào tạo + chuyển giao] starts at [Phát triển PM nội bộ]'s end

[Vận hành thử]          lasts 8 weeks
[Vận hành thử]          starts at [Đào tạo + chuyển giao]'s end

[Nghiệm thu, bàn giao]  lasts 4 weeks
[Nghiệm thu, bàn giao]  starts at [Vận hành thử]'s end
@endgantt
```

---

## §11. Anti-patterns (TUYỆT ĐỐI TRÁNH)

❌ **Forest hub-and-spoke** — 1 node trung tâm với 15 nhánh toả ra. → tách thành 3 group, đặt grouping bằng package.

❌ **Spaghetti edges** — edges chéo qua node, đan chéo nhau. → fix bằng `together { … }`, `-[hidden]->`, hoặc đổi `top to bottom` ↔ `left to right`.

❌ **Nested rectangle without semantic** — `rectangle "vùng X" { rectangle "vùng Y" { rectangle ... } }` 4-5 cấp lồng. → thay bằng `package` / `frame` / `node` đúng ngữ nghĩa.

❌ **Unicode emoji + ASCII art trong label** — vỡ hoàn toàn ở Times New Roman. → text thuần, dấu Việt OK.

❌ **`note` thừa** — cứ box nào cũng note giải thích → loãng. → chỉ note khi label không đủ chứa thông tin quan trọng.

❌ **Mỗi diagram dùng 10+ màu** — chrome rainbow → reject. → ≤ 5 màu theo §2 palette.

❌ **`@startuml` không có `skinparam` preset** → font default Helvetica xấu, diacritics có thể vỡ → reject.

❌ **Edge label dạng paragraph** — `: "Cán bộ gửi yêu cầu kèm theo file đính kèm để hệ thống xử lý"` → cụt thành `: "yêu cầu + file"` hoặc note.

❌ **Trộn `graph TD` (Mermaid syntax) trong PlantUML source** — engine từ chối. Auto-detect theo `@startuml` → kiểm tra prefix.

❌ **Thiếu title** — diagram render PNG không có chú thích → `title <b>Hình X.Y</b>: ...`.

---

## §12. Pre-flight checklist (writer agent BẮT BUỘC tự kiểm trước khi emit)

Trước khi đặt source vào `diagrams.{key}`, agent PHẢI tick từng item:

- [ ] Source bắt đầu `@startuml` (hoặc `@startgantt`/`@startmindmap` cho special)
- [ ] Có khối `skinparam defaultFontName "Times New Roman"` + `skinparam shadowing false` + `skinparam linetype ortho` (trừ sequence dùng polyline)
- [ ] Có `title <b>Hình X.Y</b>: <tên cụ thể>` ngay sau preset
- [ ] Có hướng explicit: `top to bottom direction` HOẶC `left to right direction`
- [ ] Mọi node nằm trong `package`/`frame`/`node` có label
- [ ] ≤ 25 nodes; nếu quá → tách thành nhiều diagram (X.Y.1, X.Y.2)
- [ ] Shape semantic đúng: `database` cho CSDL, `cloud` cho external, `actor` cho người, `node` cho máy chủ, `component` cho service
- [ ] Edges có label ngắn (giao thức/dữ liệu) khi có thể: `: HTTPS`, `: SQL/5432`, `: gRPC`
- [ ] Phân biệt edge thực `-->` vs phụ thuộc `..>`
- [ ] Color palette ≤ 5 màu, dùng đúng `$navy/$blue/$lightBlue/$accent/$orange` từ §2 preset
- [ ] Dùng tên thật từ intel (component / entity / actor name) — không placeholder "User → System → DB"
- [ ] Edge label không quá 4 từ; thông tin dài → `note on link`
- [ ] Source kết thúc `@enduml` (hoặc tương ứng)
- [ ] Test render trước (nếu có tool local) — kiểm tra zero crossing edge, không có node tràn khỏi frame

**Doc-reviewer agent sẽ reject diagrams thiếu ≥3 items.**

---

## §13. Layout control tricks (khi auto-layout không đẹp)

### Trick 1 — `together { }` để giữ nodes cùng nhóm
```plantuml
together {
  [Service A] --> [Service B]
  [Service B] --> [Service C]
}
```
→ A, B, C luôn cạnh nhau, không bị tách rải.

### Trick 2 — Hidden edges để force order
```plantuml
[A] -[hidden]-> [B]
[B] -[hidden]-> [C]
```
→ A trên B trên C dù logic không có edge thật.

### Trick 3 — `rank` hint cho component
```plantuml
[Frontend] --> [Backend]
[Frontend] -[hidden]right-> [Mobile]
```
→ Mobile cùng hàng với Frontend.

### Trick 4 — `skinparam packageStyle rectangle` cho package "phẳng"
Nếu package mặc định trông như folder tab xấu → set thành rectangle đơn.

### Trick 5 — Tăng `nodesep` / `ranksep` khi crowded
Default nodesep=35 nodesep=55 (preset §2). Nếu vẫn đè → bump lên 50/80. Nếu thưa → giảm xuống 25/40.

### Trick 6 — Đổi engine layout cho graphviz
```plantuml
' Trước @startuml
'@unstartuml
'@startuml
!pragma layout smetana   ' hoặc dot/elk (default = dot — tốt nhất cho structure)
```

### Trick 7 — Sequence diagram quá dài
```plantuml
skinparam maxMessageSize 200
skinparam wrapWidth 180
autonumber
```

---

## §14. C4 Model (cao cấp — cho TKKT context/container diagrams)

Khi cần diagram cao cấp theo chuẩn Simon Brown C4, có thể tham khảo offline include (đã được bake vào image production trong tương lai). Hiện tại fallback bằng PlantUML thuần với stereotype:

```plantuml
@startuml
<<insert §2 preset>>
skinparam component {
  BackgroundColor<<external>>  #E2EFDA
  BackgroundColor<<container>> #DEEBF7
  BackgroundColor<<datastore>> #FBE5D5
}

title <b>Hình 1.2</b>: Sơ đồ ngữ cảnh hệ thống (C4 Level 1)

actor "Cán bộ THAHS" as User
component "Hệ thống CĐS THAHS" <<container>> as SYS
component "CSDLQGDC" <<external>> as CSDLQG
component "VNeID" <<external>> as VNEID
component "LGSP Bộ CA" <<external>> as LGSP
database "Lưu trữ S3" <<datastore>> as STORE

User --> SYS    : "đăng nhập, nhập liệu"
SYS  --> CSDLQG : "tra cứu CCCD\n(REST/JSON)"
SYS  --> VNEID  : "xác thực sinh trắc\n(OAuth2)"
SYS  --> LGSP   : "trao đổi văn bản\n(SOAP)"
SYS  --> STORE  : "tài liệu đính kèm"
@enduml
```

---

## §15. Tóm tắt cho writer agent

**Mặc định viết PlantUML cho mọi diagram TKCS / TKKT / TKCT / NCKT / Đề án CĐS với 3 yêu cầu cốt lõi:**

1. **Bắt đầu bằng skinparam preset §2** — chữ ký chất lượng.
2. **Chọn pattern §3-§10 phù hợp loại diagram cần vẽ** — không tự bịa layout.
3. **Tick checklist §12 trước khi emit** — 13 items.

**Diagram đạt chuẩn = đọc được trong 30 giây, có grouping rõ, edges không chéo, label cụ thể, palette nhất quán.**
