# Brief: xây dựng game tu tiên 2D bằng Unity

## Mục tiêu

Xây dựng một game mới có cơ chế tương tự game tu tiên 2D top-down: di chuyển,
chiến đấu, trồng cây, lấy nước, câu cá, chế tạo đan và làm nhiệm vụ nhiều bước.
Không sao chép mã nguồn, giao thức riêng, dữ liệu tài khoản, tài nguyên đồ hoạ,
âm thanh hoặc toàn bộ nội dung nhiệm vụ của game tham khảo nếu chưa được phép.
Đây là game Unity mới, không phải chuyển extension auto hiện tại sang Unity.

## Tech stack khởi đầu

| Phần | Đề xuất | Khi nào cần |
|---|---|---|
| Engine | Unity 6 LTS, template 2D | Ngay từ đầu; chọn bản LTS còn được hỗ trợ khi cài |
| Ngôn ngữ | C# | Logic game |
| Map | 2D Tilemap, Tilemap Collider 2D, Physics 2D | Bản đồ, vật cản |
| Nhập liệu | Unity Input System | Keyboard, chuột; mở rộng joystick mobile |
| UI | uGUI + TextMeshPro | HUD, quest tracker, túi đồ, hội thoại |
| Dữ liệu thiết kế | ScriptableObject | Item, enemy, recipe, quest definition |
| Dữ liệu runtime | Class C# + JSON | Save/load tiến độ offline; không sửa asset làm save |
| Quản lý mã | Git, Git LFS cho asset lớn | Ngay từ đầu; không commit Library/Temp/secret |
| Kiểm thử | Unity Test Framework | EditMode logic và PlayMode tương tác |
| Online sau MVP | Backend Node.js/TypeScript + WebSocket + PostgreSQL | Khi bản offline đã chơi ổn |
| AI | State machine/behaviour logic trước; A* nếu cần auto đi đường | Quái, NPC; chưa cần LLM/RL |

Đây là stack đề xuất, không khẳng định game tham khảo sử dụng Unity hay các công nghệ này.
Không cần Ollama, LLM, Docker hoặc cloud để làm bản offline đầu tiên.

## Phạm vi MVP bắt buộc

Chỉ làm một khu nhỏ, một nhân vật, một NPC và một loại quái trước.

1. Nhân vật đi 8 hướng, camera theo người chơi, va chạm không xuyên tường.
2. Đòn đánh có windup, thời điểm phát đòn và cooldown; HP, chết và hồi sinh.
3. Hệ thống tương tác: chọn mục tiêu → đi đủ gần → kiểm tra điều kiện → thực hiện.
4. Một túi đồ chứa nguyên liệu và sản phẩm.
5. Một quest nhiều bước: nhận việc → thu nguyên liệu → lấy nước → gieo/tưới cây →
   thu hoạch → mở công thức → luyện đan → giao NPC.
6. Save/load giữ đúng tiến độ, cây đang lớn và vật phẩm.
7. Log trạng thái quest để chẩn đoán bước đang kẹt.

Chưa làm tông môn, PvP, chợ, nhiều server, 32 quest hoặc monetization trong MVP.

## Cấu trúc project

```text
Assets/Game/
  Art/                     # Asset tự tạo hoặc được cấp phép
  Audio/
  Scenes/                  # Bootstrap, MainMenu, Village
  Prefabs/                 # Player, Enemy, NPC, Interactable
  Data/                    # ScriptableObject assets
  Scripts/
    Core/                  # Bootstrap, clock, save service, events
    Character/             # Movement, stats, combat, death, meditation
    World/                 # Map, interaction, spawning, navigation
    Inventory/             # Item definition, stack, inventory service
    Crafting/              # Recipe, material validation, craft transaction
    Farming/               # Plot, growth, watering, harvesting
    Quests/                # Definition, objective, progress, evaluator
    UI/                    # HUD, dialogs, inventory, quest journal
    Networking/            # Chưa triển khai trong MVP offline
  Tests/
    EditMode/
    PlayMode/
```

Tránh dồn logic vào một MonoBehaviour/GameManager. Dữ liệu, luật game và UI tách riêng.
UI chỉ gửi yêu cầu; service kiểm tra luật và trả kết quả.

## Luật tương tác quan trọng

- Tách `selectionRadius` và `interactionRange`: chọn được từ xa không có nghĩa làm được.
- Chọn điểm đứng hợp lệ ở ngoài collider của hồ/cây/NPC, không ép đi vào tâm vật cản.
- Đứng đúng tầm, kiểm tra vật cản nếu cơ chế yêu cầu, rồi mới tương tác.
- Khi khoảng cách không đủ, trả `TooFar`; không mở hộp rỗng chỉ có nút quay lại.
- Khi thiếu nguyên liệu, trả tên và số lượng còn thiếu.
- Không chạy việc di chuyển, đánh và thiền cạnh tranh điều khiển nhau.
- State machine nhân vật: Idle, Moving, Attacking, Interacting, Meditating, Dead.
- Hồi sinh xong phải reset target/path và trạng thái cũ.

## Thiết kế quest

`QuestDefinition` là dữ liệu bất biến. `QuestProgress` là dữ liệu theo nhân vật.
Mỗi objective có id ổn định, loại hành động, targetId, số lượng và điều kiện trước đó.
Không lưu lựa chọn bằng vị trí nút số 1/2; dùng actionId và recipeId.

Các event ví dụ: ItemCollected, EnemyKilled, CropWatered, CropHarvested,
RecipeInspected, ItemCrafted, NPCInteracted. Chỉ cập nhật từ sự kiện đã xác nhận.
Mở công thức không có nghĩa luyện thành công; quái chết gần người chơi không có
nghĩa người chơi được tính kill. Khi online, server quyết định attribution.

Ví dụ dữ liệu thiết kế; đây không phải JSON import trực tiếp của Unity:

```json
{
  "id": "intro_alchemy",
  "title": "Mẻ đan đầu tiên",
  "objectives": [
    {"id": "collect", "type": "collect_item", "targetId": "herb_a", "count": 3},
    {"id": "water", "type": "collect_water", "count": 1, "requires": ["collect"]},
    {"id": "inspect", "type": "inspect_recipe", "targetId": "beginner_pill", "requires": ["water"]},
    {"id": "craft", "type": "craft_item", "targetId": "beginner_pill", "count": 1, "requires": ["inspect"]},
    {"id": "return", "type": "talk_npc", "targetId": "mentor", "requires": ["craft"]}
  ]
}
```

## Online: thực hiện sau khi MVP offline đạt

- Server authoritative: kiểm tra damage, cooldown, khoảng cách, inventory và quest reward.
- Client gửi ý định hành động, không gửi “tôi đã có 1000 tiền” làm dữ liệu tin cậy.
- Lệnh craft/giao quest cần idempotency để retry không nhân đôi vật phẩm/phần thưởng.
- PostgreSQL lưu nhân vật, inventory và quest; không lưu mật khẩu dạng plaintext.
- Web build cần transport tương thích trình duyệt. Unity Web không dùng socket .NET
  trực tiếp như desktop; chọn tích hợp WebSocket phù hợp và kiểm thử browser sớm.
- Cloudflare Pages có thể phục vụ file build Web, nhưng không tự thay thế server game.
- Không chọn giải pháp host realtime dài hạn trước khi đo tick rate và tải thực tế.

## Tiêu chí nghiệm thu trước khi mở rộng

- Chơi từ nhận quest đến giao quest thành công, không chỉnh save bằng tay.
- Tương tác hồ/cây từ xa không gây thao tác sai; tự tiếp cận không xuyên collider.
- Craft thất bại không mất nguyên liệu; craft thành công chỉ trừ/nhận đúng một lần.
- Save/load giữa từng bước không mất tiến độ hoặc tạo duplicate item.
- Chết/hồi sinh/thiền không khiến nhân vật bị giữ trong state cũ.
- Test logic độc lập khỏi scene; có PlayMode test cho khoảng cách tương tác.

## Prompt để bắt đầu với coding agent trong repository Unity mới

> Hãy đọc UNITY_GAME_BRIEF.md và triển khai milestone 1: project 2D top-down offline
> gồm một map Tilemap, nhân vật di chuyển 8 hướng, camera và collision. Tách module
> đúng cấu trúc brief, dùng Input System, không thêm networking hoặc AI/LLM lúc này.
> Nếu chưa có Unity project, hướng dẫn tôi tạo project rồi mới viết script phụ thuộc
> package. Không dùng asset game tham khảo chưa được phép. Thêm test và ghi rõ phần
> nào đã chạy trong Unity Editor, phần nào chưa kiểm chứng. Không chuyển đổi hoặc
> ghi đè repository extension auto hiện tại.

## Tài liệu chính thức

- Tilemap: https://docs.unity3d.com/6000.0/Documentation/Manual/tilemaps/tilemaps-landing.html
- ScriptableObject: https://docs.unity3d.com/6000.0/Documentation/Manual/class-ScriptableObject.html
- Web networking: https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-networking.html
