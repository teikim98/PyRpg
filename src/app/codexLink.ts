// 기록관의 안경(design.md §7.3, docs/phase3/region04-spec.md §6): 에러 해설 규칙의 lesson → 코덱스 바로가기.
import type { ItemDef, Lesson, TracebackRule } from "../contracts/content";
import type { PyError } from "../contracts/runner";
import type { SaveData } from "../contracts/state";
import { lessonForError } from "../python/explain";
import { equipmentEffects } from "../systems";

export interface CodexLinkContext {
  rules: TracebackRule[];
  lessons: Lesson[];
  items: ItemDef[];
  save: Pick<SaveData, "equipment" | "lessonsCompleted">;
}

/**
 * 안경을 끼고 있고, 이 에러의 해설 규칙에 lesson이 있고, 그 레슨을 이미 배웠으면 그 레슨(버튼에 보일 제목 포함).
 * 하나라도 아니면 undefined(전투 메시지는 안경이 없을 때와 똑같다)
 */
export function codexLinkFor(error: PyError, ctx: CodexLinkContext): { id: string; title: string } | undefined {
  if (!equipmentEffects(ctx.save, ctx.items).codexLinks) return undefined;
  const id = lessonForError(error, ctx.rules);
  if (!id || !ctx.save.lessonsCompleted.includes(id)) return undefined;
  const lesson = ctx.lessons.find((l) => l.id === id);
  return lesson ? { id: lesson.id, title: lesson.title } : undefined;
}
