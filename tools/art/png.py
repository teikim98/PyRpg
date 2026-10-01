"""표준 라이브러리만 쓰는 최소 PNG 입출력(RGBA 8비트, 컬러 타입 6).

- write_png: 픽셀 행 목록을 PNG로 쓴다. 메타데이터(시간 등)를 넣지 않고 zlib 압축 수준을 고정하므로
  같은 입력이면 언제나 같은 바이트가 나온다.
- read_png: 비인터레이스 8비트 PNG(컬러 타입 2·6)를 읽어 (너비, 높이, RGBA 행 목록)을 돌려준다.
  검사·미리보기용이며, 이 도구가 쓴 파일을 읽는 데 충분하다.
"""
import struct
import zlib

Pixel = tuple  # (r, g, b, a)

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(kind: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", crc)


def encode_png(width: int, height: int, rows) -> bytes:
    """rows: 높이만큼의 행, 각 행은 (r, g, b, a) 튜플 width개."""
    if len(rows) != height:
        raise ValueError(f"row count {len(rows)} != height {height}")
    raw = bytearray()
    for y, row in enumerate(rows):
        if len(row) != width:
            raise ValueError(f"row {y} width {len(row)} != {width}")
        raw.append(0)  # 필터 없음: 결정적이고 단순하다
        for px in row:
            raw.extend(px)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        PNG_SIGNATURE
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _chunk(b"IEND", b"")
    )


def write_png(path: str, width: int, height: int, rows) -> None:
    data = encode_png(width, height, rows)
    with open(path, "wb") as f:
        f.write(data)


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def read_png(path: str):
    """(width, height, rows) 반환. rows[y][x] = (r, g, b, a)."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != PNG_SIGNATURE:
        raise ValueError(f"{path}: not a PNG")
    pos = 8
    idat = bytearray()
    width = height = None
    color_type = None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", body)
            if depth != 8 or color_type not in (2, 6) or interlace != 0:
                raise ValueError(f"{path}: unsupported PNG (depth={depth}, type={color_type}, interlace={interlace})")
        elif kind == b"IDAT":
            idat.extend(body)
        elif kind == b"IEND":
            break
    if width is None:
        raise ValueError(f"{path}: missing IHDR")
    bpp = 4 if color_type == 6 else 3
    raw = zlib.decompress(bytes(idat))
    stride = width * bpp
    prev = bytearray(stride)
    rows = []
    i = 0
    for _ in range(height):
        ftype = raw[i]
        line = bytearray(raw[i + 1 : i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if ftype == 1:
                line[x] = (line[x] + a) & 0xFF
            elif ftype == 2:
                line[x] = (line[x] + b) & 0xFF
            elif ftype == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 0xFF
            elif ftype == 4:
                line[x] = (line[x] + _paeth(a, b, c)) & 0xFF
            elif ftype != 0:
                raise ValueError(f"{path}: bad filter {ftype}")
        if bpp == 4:
            rows.append([tuple(line[x : x + 4]) for x in range(0, stride, 4)])
        else:
            rows.append([tuple(line[x : x + 3]) + (255,) for x in range(0, stride, 3)])
        prev = line
    return width, height, rows
