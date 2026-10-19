def solution(s, k, b):
    value = int(s, k)
    if value == 0:
        return "0"
    out = []
    while value > 0:
        value, r = divmod(value, b)
        out.append(str(r))
    return "".join(out[::-1])
