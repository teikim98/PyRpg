// 에셋 계약(design.md §9.8). 엔진과 콘텐츠는 논리 이름만 알고, 실제 파일 경로는 assets/manifest.json이 정한다.
// 에셋을 교체할 때는 파일을 바꾸거나 manifest.json의 경로만 고친다.
//
// 규칙
// - 지형 타일셋: 16×16, 가로 columns칸, manifest의 tiles 순서대로. 새 타일은 끝에만 추가한다.
// - 캐릭터(player, nuri, npc_*): 16×16 프레임, 가로 8프레임 = 아래·왼쪽·오른쪽·위 방향 × 2프레임(걷기).
// - 몬스터·오브젝트(monster_*, obj_*): 16×16 프레임 2개(제자리 애니메이션). obj_chest·obj_door는 [닫힘, 열림].
// - 보스(boss_*): 32×32 프레임 2개.
// - 초상화(portrait_*): 64×64 한 장. 표정마다 파일 하나.
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
