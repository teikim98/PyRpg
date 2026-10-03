// 에셋 계약(design.md §9.8). 엔진과 콘텐츠는 논리 이름만 알고, 실제 파일 경로는 assets/manifest.json이 정한다.
// 에셋을 교체할 때는 파일을 바꾸거나 manifest.json의 경로만 고친다.
//
// 규칙(docs/art-overhaul/plan.md §3, 화풍: docs/art-overhaul/style-guide.md, 검사: tools/art/check.py. 엔진은 새 형식과 옛 형식을 모두 읽는다)
// - 지형 타일셋: 16×16, 가로 columns칸, manifest의 tiles 순서대로. 새 타일은 끝에만 추가한다.
// - 타일 애니메이션(선택): tileAnimations = { "water": { "frames": ["water", "water_a1", "water_a2"], "fps": 3 } }.
//   키는 맵에 칠하는 타일 이름(= frames[0]). 나머지 프레임 타일은 타일셋 tiles 끝에 추가한다(맵 데이터는 그대로).
//   같은 이름의 타일은 맵 어디서나 같은 순간에 같은 프레임을 보인다.
// - 캐릭터(player, nuri, npc_*)
//   · 새 형식: 16×24 프레임(frameWidth 16, frameHeight 24), 가로 6열 × 세로 4행 = 96×96 이미지.
//     행 = 아래·왼쪽·오른쪽·위, 열 = 0 서기, 1 왼발, 2 서기, 3 오른발, 4 숨쉬기, 5 눈 깜빡임. 프레임 번호 = 행 × 6 + 열.
//     발 딛는 프레임(1, 3)에서는 엔진이 스프라이트 전체를 1px 올린다(그림에 몸 전체 오르내림을 또 넣지 않는다).
//     발은 프레임 맨 아래 줄에 닿게 그린다(기준점 = 프레임 아래 가운데 = 칸의 아래 가운데).
//   · 옛 형식: 16×16 프레임, 가로 8프레임 = 아래·왼쪽·오른쪽·위 × [서기, 걸음]. 숨쉬기·깜빡임은 서기로 대신한다.
//   엔진은 실제 이미지의 프레임 크기(세로가 더 길고 24프레임 이상이면 새 형식)로 구별한다.
// - 몬스터·오브젝트(monster_*, obj_*): 16×16 프레임, 가로 4프레임(제자리 루프 0→1→2→3) 또는 옛 2프레임.
//   엔진은 이미지 너비로 프레임 수를 안다. obj_chest·obj_door는 [닫힘, 열림] 2프레임 그대로.
// - 보스(boss_*): 32×32 프레임, 가로 4프레임 또는 옛 2프레임.
// - 초상화(portrait_*): 64×64 한 장. 표정마다 파일 하나.
import manifestJson from "../../assets/manifest.json";

export interface SpriteAsset {
  file: string;
  frameWidth: number;
  frameHeight: number;
}

/** 타일 애니메이션 하나. frames[0]이 맵에 칠하는 타일 */
export interface TileAnimationDef {
  frames: string[];
  fps: number;
}

export interface AssetManifest {
  tileSize: number;
  tilesets: Record<
    string,
    {
      file: string;
      columns: number;
      tiles: string[];
      blocking: string[];
      /**
       * 캐릭터보다 위에 그릴 타일(선택). 없으면 이름이 _roof로 끝나는 타일.
       * 16×24 캐릭터가 문간에 서면 머리가 위 칸의 지붕 처마 밑으로 들어가 보이게 한다
       */
      overhead?: string[];
    }
  >;
  /** 타일 이름 → 애니메이션(선택. 모든 타일셋에 같은 이름으로 적용) */
  tileAnimations?: Record<string, TileAnimationDef>;
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
