def solution(cargo):
    for x in cargo:
        if cargo.count(x) > 1:
            return x
    return -1
