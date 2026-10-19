DIGITS = "0123456789ABCDEF"


def solution(s, k, b):
    value = int(s, k)
    if value == 0:
        return "0"
    out = []
    while value > 0:
        value, r = divmod(value, b)
        out.append(DIGITS[r])
    return "".join(out)
