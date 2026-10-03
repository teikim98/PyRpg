// 에셋 계약(design.md §9.8). 엔진과 콘텐츠는 논리 이름만 알고, 실제 파일 경로는 assets/manifest.json이 정한다.
// 에셋을 교체할 때는 파일을 바꾸거나 manifest.json의 경로만 고친다.
//
// 규칙(그래픽 개편 계약: docs/art-overhaul/plan.md §3, 화풍: docs/art-overhaul/style-guide.md. 검사: tools/art/check.py)
// - 지형 타일셋: 16×16, 가로 columns칸, manifest의 tiles 순서대로. 새 타일은 끝에만 추가한다.
// - 캐릭터(player, nuri, npc_*):
//   · 새 형식: 16×24 프레임(frameHeight 24), 6열 × 4행 = 24프레임(시트 96×96).
//     행 = 아래·왼쪽·오른쪽·위, 열 = 0 서기, 1 왼발, 2 서기, 3 오른발, 4 숨쉬기, 5 눈 깜빡임.
//     프레임 번호 = 행 × 6 + 열. 프레임 아래쪽 16px이 캐릭터가 선 타일 칸에 맞는다(머리 8px은 위 칸으로).
//   · 옛 형식(아직 지역 2~6 NPC): 16×16 프레임, 가로 8프레임 = 아래·왼쪽·오른쪽·위 방향 × 2프레임(걷기).
//   · manifest의 frameHeight(24 또는 16)로 형식을 구별한다.
// - 몬스터·오브젝트(monster_*, obj_*): 16×16 프레임, 가로 2개 또는 4개(제자리 애니메이션). 프레임 수 = 시트 너비 / 16.
//   obj_chest·obj_door는 [닫힘, 열림] 2프레임만.
// - 보스(boss_*): 32×32 프레임, 가로 2개 또는 4개.
// - 초상화(portrait_*): 64×64 한 장. 표정마다 파일 하나.
// - 타일 애니메이션(선택): manifest 최상위 `tileAnimations` = { 타일: { frames: [타일, 프레임 타일…], fps: 양수 } }.
//   프레임 타일은 타일셋 끝에 추가하고(기존 순서·맵 데이터 불변), 첫 프레임은 키 타일 자신이다.
import manifestJson from "../../assets/manifest.json";

export interface SpriteAsset {
  file: string;
  frameWidth: number;
  frameHeight: number;
}

export interface AssetManifest {
  tileSize: number;
  tilesets: Record<string, { file: string; columns: number; tiles: string[]; blocking: string[] }>;
  sprites: Record<string, SpriteAsset>;
  portraits: Record<string, { file: string; size: number }>;
}

export const manifest = manifestJson as AssetManifest;
export const TILE = manifest.tileSize;

/** 타일 이름 → 타일셋 인덱스(0부터). Tiled gid는 여기에 firstgid(1)를 더한 값 */
export function tileIndex(name: string, tileset = "overworld"): number {
  const i = manifest.tilesets[tileset].tiles.indexOf(name);
  if (i < 0) throw new Error(`unknown tile: ${name}`);
  return i;
}
