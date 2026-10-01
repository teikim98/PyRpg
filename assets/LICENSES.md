# 에셋 출처와 라이선스

design.md §9.8의 에셋 정책에 따라 게임에 들어가는 그림과 폰트의 출처를 적습니다.

## 1. 도트 아트(PNG): 프로젝트 자체 제작

`assets/` 아래의 PNG 파일은 모두 이 프로젝트를 위해 새로 그린 **프로젝트 자체 제작** 그림입니다. 외부 에셋(Kenney, OpenGameArt 등)은 쓰지 않았고, 기존 게임·작품의 캐릭터나 그림을 따라 그리지 않았습니다.

- 만든 방법: `tools/art/build.py`가 `tools/art/`의 팔레트 문자 그리드와 도형 코드로 PNG를 생성합니다. 같은 코드에서는 언제나 같은 바이트가 나옵니다(`tools/art/check.py`로 확인).
- 라이선스: 프로젝트와 같은 조건을 따릅니다(외부 저작물이 섞이지 않았으므로 필요하면 CC0로 공개해도 됩니다).
- 대상 파일(`assets/manifest.json` 기준)

| 파일 | 내용 |
|---|---|
| `tiles/overworld.png` | 지형 타일 36종(16×16, 8열): 지역 1 24종 + 지역 2 숲 타일 12종 |
| `sprites/player.png`, `sprites/nuri.png`, `sprites/npc_merchant.png`, `sprites/npc_villager.png`, `sprites/npc_child.png`, `sprites/npc_traveler.png`, `sprites/npc_woodcutter.png` | 캐릭터(16×16 × 8프레임) |
| `sprites/monster_*.png` | 지역 1 몬스터 6종 + 지역 2 몬스터 6종(16×16 × 2프레임) |
| `sprites/obj_*.png` | 상자·표지판·캠프파이어·비석·문(16×16 × 2프레임) |
| `sprites/boss_stair_mimic.png` | 지역 1 보스 계단 미믹(32×32 × 2프레임) |
| `sprites/boss_crossroad_tree.png` | 지역 2 보스 갈림길 수호목(32×32 × 2프레임) |
| `portraits/nuri_*.png` | 누리 초상화 5종(64×64) |

## 2. 폰트

폰트 파일은 저장소에 복사하지 않고 npm 패키지(`package.json`의 `dependencies`)에서 불러옵니다. 둘 다 SIL Open Font License 1.1이므로 게임에 포함해 배포할 수 있고, 폰트만 따로 판매하거나 OFL이 아닌 라이선스로 재배포하는 것은 허용되지 않습니다.

| 폰트 | npm 패키지 | 버전 | 라이선스 | 저작권 | 출처 |
|---|---|---|---|---|---|
| Galmuri(갈무리) | `galmuri` | 2.40.3 | SIL OFL 1.1 | © 2019–2025 Lee Minseo | https://galmuri.quiple.dev , https://github.com/quiple/galmuri |
| Neo둥근모 Code | `@kfonts/neodgm-code` | 0.5.0 | SIL OFL 1.1 | © 2017–2024 Eunbin Jeong | https://neodgm.dalgona.dev , https://github.com/neodgm/neodgm/blob/main/LICENSE.txt |

OFL 전문은 각 패키지에 들어 있습니다(`node_modules/galmuri/ofl.md`, Neo둥근모는 위 LICENSE.txt). 배포판을 만들 때는 이 전문을 함께 넣습니다.

## 3. 외부 에셋

현재 없습니다. 추가할 때는 아래 형식으로 한 줄씩 적습니다(CC0만 사용, design.md §9.8).

| 파일 | 출처 URL | 라이선스 | 내려받은 날짜 | 수정 여부 |
|---|---|---|---|---|
