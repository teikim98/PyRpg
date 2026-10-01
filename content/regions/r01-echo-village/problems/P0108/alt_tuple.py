def solution(sec):
    h = sec // 3600
    m = sec % 3600 // 60
    s = sec % 60
    return h, m, s


if __name__ == "__main__":
    print(solution(3661))
