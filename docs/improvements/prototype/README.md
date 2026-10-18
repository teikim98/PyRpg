# 선행 지식 검사 프로토타입

개선안 ②(`../02-prerequisites.md` §4)의 선행 지식 검사를 2026-10-18에 이 PC에서 다시 만든 것입니다. 단위 3-B(`../../phase3/improvements-plan.md` §4)가 `tools/prereq.py`를 만들 때의 바탕입니다. 게임과 `npm run verify`는 이 폴더를 쓰지 않습니다.

| 파일 | 내용 |
|---|---|
| `tagger.py` | Python 코드에서 쓰인 문법·내장 함수·메서드·모듈을 태그로 뽑는 `ast` 태거(`code_features`, 레슨 코드 블록·인라인 코드 추출) |
| `prereq_proto.py` | 태거로 지역 1~6의 모범답안·레슨·힌트·보스 `slow.py`를 학습 시점과 대조해 오류·경고·정보(예제와 정답의 같은 조각)를 출력 |
| `introduces.json` | 2026-10-18 콘텐츠(`main` `c1844b6`) 기준 레슨 27개의 `introduces` 초안(121태그). `prereq_proto.py`를 실행하면 지금 콘텐츠로 다시 만들어집니다(`results.json`은 실행 결과, 커밋하지 않음). 묶음 A 전이라 L3-1의 `sum`/`max`/`min` 등은 아직 다른 레슨에 있음 |

실행(저장소 루트 기준 경로를 스스로 찾음, 0.1초):

```
cd docs/improvements/prototype
PYTHONUTF8=1 python prereq_proto.py
```

~~알려진 한계: 함수 안의 도우미 함수(재귀가 아닌 것, 예: P0610 `compress`)를 `nested-def`로 잡지 못했습니다.~~ 바로잡음(2026-10-18, 단위 3-B): 태거는 함수 안의 `def`에 모두 `nested-def`를 붙였고(`compress`는 재귀이기도 함), P0610이 위반으로 나오지 않은 것은 `starter.py`가 이미 `solution` 안의 `def compress`를 보여 주어 '시작 코드 태그 허용' 규칙으로 통과했기 때문입니다.

**3-B에서 `tools/prereq.py`로 대체됨**(레슨 `introduces`는 `lesson.json`으로 옮김). 이 폴더는 기록으로만 둡니다.
