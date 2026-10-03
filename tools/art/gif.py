"""표준 라이브러리만 쓰는 최소 애니메이션 GIF 쓰기(검토용 미리보기). 색은 256개 이하, 투명 없음.

    write_gif(path, frames, delay_cs=12)   # frames: [Canvas], 모두 같은 크기, delay_cs: 프레임 간격(1/100초)
"""
import struct


def _lzw(indices, min_code):
    clear = 1 << min_code
    eoi = clear + 1
    out = bytearray()
    bits = 0
    nbits = 0
    size = min_code + 1

    def emit(code):
        nonlocal bits, nbits
        bits |= code << nbits
        nbits += size
        while nbits >= 8:
            out.append(bits & 0xFF)
            bits >>= 8
            nbits -= 8

    table = {(i,): i for i in range(clear)}
    nxt = eoi + 1
    emit(clear)
    w = ()
    for k in indices:
        wk = w + (k,)
        if wk in table:
            w = wk
            continue
        emit(table[w])
        if nxt < 4096:
            table[wk] = nxt
            nxt += 1
            if nxt > (1 << size) and size < 12:
                size += 1
        else:
            emit(clear)
            table = {(i,): i for i in range(clear)}
            nxt = eoi + 1
            size = min_code + 1
        w = (k,)
    if w:
        emit(table[w])
    emit(eoi)
    if nbits:
        out.append(bits & 0xFF)
    return bytes(out)


def encode_gif(frames, delay_cs=12):
    w, h = frames[0].width, frames[0].height
    colors = {}
    for f in frames:
        for row in f.px:
            for p in row:
                rgb = p[:3] if p[3] else (0, 0, 0)
                if rgb not in colors:
                    colors[rgb] = len(colors)
    if len(colors) > 256:
        raise ValueError(f"too many colors for GIF: {len(colors)}")
    depth = max(1, (len(colors) - 1).bit_length())
    pal = bytearray()
    for rgb in sorted(colors, key=colors.get):
        pal.extend(rgb)
    pal.extend(b"\0" * (3 * (1 << depth) - len(pal)))
    out = bytearray(b"GIF89a")
    out += struct.pack("<HHBBB", w, h, 0x80 | ((depth - 1) << 4) | (depth - 1), 0, 0)
    out += pal
    out += b"\x21\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00"  # 무한 반복
    min_code = max(2, depth)
    for f in frames:
        idx = [colors[p[:3] if p[3] else (0, 0, 0)] for row in f.px for p in row]
        out += b"\x21\xf9\x04\x00" + struct.pack("<H", delay_cs) + b"\x00\x00"
        out += b"\x2c" + struct.pack("<HHHHB", 0, 0, w, h, 0)
        data = _lzw(idx, min_code)
        out.append(min_code)
        for i in range(0, len(data), 255):
            chunk = data[i:i + 255]
            out.append(len(chunk))
            out += chunk
        out.append(0)
    out.append(0x3B)
    return bytes(out)


def write_gif(path, frames, delay_cs=12):
    with open(path, "wb") as f:
        f.write(encode_gif(frames, delay_cs))
