def solution(sec):
    h = int(sec / 3600)
    m = sec % 3600 // 60
    s = sec % 60
    return [h, m, s]
